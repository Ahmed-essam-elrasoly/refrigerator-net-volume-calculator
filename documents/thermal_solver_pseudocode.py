"""
================================================================================
REFRIGERATOR THERMAL SOLVER + UI LAYER — COMPREHENSIVE PSEUDOCODE
================================================================================
PART I  (Sections 0-6):   live solve path + offline compressor fitting —
    constants.js, defaultComponents.js, geometry.js, evaporator.js, heatLoad.js,
    condenser.js, CompressorPerformance.js, solver.js, index.js.
PART II (Sections 7-15):  UI layer + volume/IO subsystem —
    compressorManager.js, settings.js, main.js, thermoUI.js, schematic.js,
    graphUI.js, traversal.js, calc.js, io.js.

Both parts are pseudocode, not runnable code. Python-style syntax (def/if/for)
is used for control flow; math is written as plain formulas in comments/
expressions next to the code that uses them. Physical units are noted where
they matter. Every module listed above has been checked against its actual
source (not diagrams or guesses) — see the VERIFICATION STATUS blocks at the
end of each Part for exactly what's confirmed vs. still open, and the
CONFIRMED BUGS / DEAD CODE lists for real defects found while transcribing.
validateHeatLoad.js is intentionally excluded throughout (dead code, never
called in the live path).
================================================================================
"""

# ==============================================================================
# SECTION 0 — PHYSICAL CONSTANTS  (constants.js)  — verbatim
# ------------------------------------------------------------------------------
# Model-independent empirical constants: air properties, insulation conductivities
# (used as a FALLBACK reference value — heatLoad.js actually computes urethane's
# lambda dynamically per-wall via lambda_urethane(), see Section 2; the "urethane"
# entry here is not what k_exterior/k_interior use), and surface film coefficients.
# ==============================================================================

PC = {
    "air": {
        "density": 1.365,   # kg/m^3
        "cp": 1.0048,       # kJ/(kg*K)
    },
    "insulation": {
        "urethane": 0.0192,     # W/(m*C) — static reference value (heatLoad.js uses
                                 # the temperature-dependent lambda_urethane() instead)
        "polystyrene": 0.0407,  # W/(m*C), EPS
        "packing": 0.035,       # W/(m*C), door gasket/packing material
    },
    "surfaceCoefficients": {
        "outside": 6.977,   # W/(m^2*C), ambient air <-> cabinet outer skin
        "inside": 11.628,   # W/(m^2*C), cabinet interior air <-> inner liner
    },
}


# ==============================================================================
# SECTION 0b — DEFAULT COMPONENT PRESETS  (defaultComponents.js)  — verbatim
# ------------------------------------------------------------------------------
# Bootstrapping/fallback data only — not part of the live math, but referenced
# by build_default_config() in Section 6 and useful as worked examples of the
# shape compParams / condenserConfig / electrical / evapGeom actually take.
# ==============================================================================

SJ54H_COMPONENTS = {
    # baseline: top-freezer, CONSTANT-SPEED compressor
    "compressor": {
        "name": "EGX80CLC 100V 50Hz",
        "rpm": 2900, "rpm0": 2900,
        "Vc": 11.14,          # cylinder displacement, cm^3
        "T_suction": 30,      # fixed suction reference temp, C
        "volEffCoeffs": {"A": 0.9260142251566365, "B": -0.01221312333322575, "C": -0.0023789273042382304},
        "powerCoeffs": {"AW": 135.175, "BW": 2.6366666666666667, "CW": 0.975, "DW": 0.02, "EW": 0.016666666666666666},
    },
    "fan": {"diameter_mm": 100, "speed_rpm": 2550, "inputPower_W": 2.1,
            "totalAirflow_m3h": 59.5, "fanAirflow_CFM": 59.5 / 1.699},
    "electrical": {"pwbOn_W": 2, "pwbOff_W": 1, "defrostHeater_W": 140,
                   "timerPeriod_h": 10.5, "defrostOn_min": 20},
    "condenser": {"sidePipePitch_mm": 150, "backPipePitch_mm": 200,
                  "K_side_kcalhm2C": 5.395, "K_back_kcalhm2C": 4.17, "backCondenserEfficiency": 0.7,
                  "k_RFront1": 0.3405, "k_RFront2": 0.03322,
                  "k_FRPartition1": 0.1984, "k_FRPartition2": 0.1219,
                  "k_FFront1": 0.3395, "k_FFront2": 0.0344},
    "subcool_K": 10, "dischargeTemp_C": 60,
    "evapGeom": {"evapWidth_mm": 460, "evapDepth_mm": 60, "evapArea_m2": 1.754},
    "initialTE": -25.7,
}

SJ_PV73K_COMPONENTS = {
    # advanced: bottom-freezer, INVERTER compressor with a real 35-point fit dataset
    "compressor": {
        "name": "DZ90A1X Inverter", "isInverter": True,
        "rpmMin": 1600, "rpmMax": 4500, "normalizeRPM": 4320,
        "centerTE": -25.0, "centerTC": 45.0, "refrigerantIndex": 2,   # R-600a
        "compressorModel": None,   # populated at runtime via fit_inverter_coefficients()
        "dataPoints": [
            # {RPM, TE, TC, W(power,Watts), Q(capacity,Watts)} — 35 points across
            # 4 RPM levels (4320/3000/1620/1320) x 3 TC levels (35/45/55) x 3 TE levels (-35/-25/-15)
            # ... (35 measured test points; omitted here for brevity, present verbatim in source)
        ],
    },
    "fan": {"diameter_mm": 100, "speed_rpm": 2850, "inputPower_W": 2.4, "totalAirflow_m3h": 146.4},
    "electrical": {"pwbOn_W": 2, "pwbOff_W": 1, "defrostHeater_W": 112,
                   "timerPeriod_h": 10.5, "defrostOn_min": 0},
    "condenser": {"sidePipePitch_mm": 150, "backPipePitch_mm": 200,
                  "K_side_kcalhm2C": 5.395, "K_back_kcalhm2C": 4.17, "backCondenserEfficiency": 0.7,
                  "k_RFront1": 0.3405, "k_RFront2": 0.03322,
                  "k_FRPartition1": 0.1984, "k_FRPartition2": 0.1219,
                  "k_FFront1": 0.3395, "k_FFront2": 0.0344},
    "subcool_K": 10, "dischargeTemp_C": 60,
    "evapGeom": {"evapWidth_mm": 440.5, "evapDepth_mm": 58, "evapArea_m2": 1.2985},
    "freezerPosition": "bottom", "initialTE": -22.7,
}

INVERTER_EXAMPLE_COMPONENTS = SJ_PV73K_COMPONENTS   # alias, as in source


# ==============================================================================
# SECTION 0c — CABINET GEOMETRY  (geometry.js)  — verbatim
# ------------------------------------------------------------------------------
# Bridges the UI's unified geometry object into the flat schema heatLoad.js /
# condenser.js actually consume (Sections 2-3). to_thermal_format() is the
# function that fills in the tFtop/tFbottom/tRtop/tRfloor "which wall is the
# partition" logic referenced throughout Section 2.
# ==============================================================================

DEFAULT_CABINET = {
    "H": 1680, "W": 800, "D": 630,
    "Hb": 260, "Db1": 210, "Db2": 230,
    "doorGap": 10, "packingPos": 15, "airGap": 5,
    "walls": {
        "freezer": {"top": 59.4, "bottom": 70, "left": 59.4, "right": 59.4, "door": 59.4, "rear": 60},
        "refrigerator": {"top": 70, "bottom1": 40, "bottom2": 40, "bottom3": 40,
                          "left": 40, "right": 40, "door": 40, "rear": 60},
    },
}


def to_volume_format(geom: dict) -> dict:
    """
    Reshapes the unified geometry object into the { external, wallThicknessesByType }
    schema used by the (separate, volume-calculation) legacy engine — NOT used by the
    thermal solver pipeline; included here only because it lives in the same file.
    """
    H, W, D, walls = geom["H"], geom["W"], geom["D"], geom["walls"]
    t = {
        "fresh": {"top": walls["refrigerator"]["top"], "bottom": walls["refrigerator"]["bottom1"],
                  "left": walls["refrigerator"]["left"], "right": walls["refrigerator"]["right"],
                  "rear": walls["refrigerator"]["rear"], "door": walls["refrigerator"]["door"]},
        "freezer": {"top": walls["freezer"]["top"], "bottom": walls["freezer"]["bottom"],
                    "left": walls["freezer"]["left"], "right": walls["freezer"]["right"],
                    "rear": walls["freezer"]["rear"], "door": walls["freezer"]["door"]},
    }
    return {"external": {"height": H, "width": W, "depth": D}, "wallThicknessesByType": t, "airGap": 0}


def to_thermal_format(geom: dict) -> dict:
    """
    NOTE: DEFAULT_CABINET (Section 0c) does NOT itself define `Hf`/`Hr` (freezer/
    fridge compartment heights) — only overall H/W/D, Hb, Db1/Db2, and walls. If
    to_thermal_format(DEFAULT_CABINET) were called with nothing else merged in first,
    Hf and Hr would come through as missing/undefined. build_default_config() below
    calls exactly that (`to_thermal_format(DEFAULT_CABINET)`) with no visible
    augmentation step — so either something upstream in the UI layer normally merges
    Hf/Hr into the cabinet object before this runs, or this is a real gap in the
    bootstrapping path. Flagging rather than silently assuming one or the other.

    Translates the UI's unified geometry object into the FLAT schema Section 2
    (calc_heat_loads) and Section 3 (calc_QCout) actually consume — resolving which
    physical wall the shared freezer/fridge partition maps to, depending on layout.
    """
    H, W, D = geom["H"], geom["W"], geom["D"]
    Hf, Hr, Hb, Db1, Db2 = geom["Hf"], geom["Hr"], geom["Hb"], geom["Db1"], geom["Db2"]
    door_gap, packing_pos, walls = geom["doorGap"], geom["packingPos"], geom["walls"]
    divider_thickness = geom.get("dividerThickness")
    divider_insulation_type = geom.get("dividerInsulationType", "PU")

    # Layout is inferred from the FIRST (topmost) compartment in the ordered list.
    compartments = geom.get("_compartments")
    is_bottom_freezer = bool(compartments) and compartments[0]["type"] == "fresh"
    is_top_freezer = bool(compartments) and compartments[0]["type"] == "freezer"

    # Fallback to 60mm when layout data isn't present (e.g. DEFAULT_CABINET has no
    # `_compartments`, so BOTH is_bottom_freezer and is_top_freezer are False here —
    # meaning tFtop/tFbottom/tRtop/tRfloor all fall through to their plain `walls.*`
    # values below rather than ever receiving `div_thick`).
    div_thick = divider_thickness if divider_thickness is not None else 60

    return {
        "H": H, "W": W, "D": D, "Hf": Hf, "Hr": Hr, "Hb": Hb, "Db1": Db1, "Db2": Db2,
        "doorGap": door_gap, "packingPos": packing_pos, "dividerInsulationType": divider_insulation_type,

        # Freezer walls: the shared partition becomes tFtop for a bottom-freezer layout,
        # or tFbottom for a top-freezer layout.
        "tFtop": div_thick if is_bottom_freezer else walls["freezer"]["top"],
        "tFleft": walls["freezer"]["left"],
        "tFright": walls["freezer"]["right"],
        "tFbottom": div_thick if is_top_freezer else walls["freezer"]["bottom"],
        "tFdoor": walls["freezer"]["door"],
        "tFback": walls["freezer"]["rear"],
        "tEvaBack": walls["freezer"]["rear"],   # NOTE: reuses the freezer's rear wall thickness verbatim

        # Refrigerator walls: the shared partition becomes tRtop for a top-freezer layout,
        # or tRfloor for a bottom-freezer layout.
        "tRtop": div_thick if is_top_freezer else walls["refrigerator"]["top"],
        "tRleft": walls["refrigerator"]["left"],
        "tRright": walls["refrigerator"]["right"],
        "tRback": walls["refrigerator"]["rear"],
        "tRdoor": walls["refrigerator"]["door"],

        "tRbottom1": walls["refrigerator"]["bottom1"],
        "tRbottom2": walls["refrigerator"]["bottom2"],
        "tRbottom3": walls["refrigerator"]["bottom3"],

        # Exterior stepped-floor thickness for the freezer compartment specifically —
        # falls back to the refrigerator's bottom-zone thicknesses if the freezer's own
        # aren't defined (which is always the case for DEFAULT_CABINET: it has no
        # walls.freezer.bottom1/2/3 at all, only a single walls.freezer.bottom).
        "tFfloor1": walls["freezer"].get("bottom1", walls["refrigerator"]["bottom1"]),
        "tFfloor2": walls["freezer"].get("bottom2", walls["refrigerator"]["bottom2"]),
        "tFfloor3": walls["freezer"].get("bottom3", walls["refrigerator"]["bottom3"]),

        "tRfloor": div_thick if is_bottom_freezer else walls["refrigerator"]["bottom1"],
    }


def upgrade_config(old_config: dict) -> dict:
    """
    Migrates a legacy v1.0 saved-project schema to the current v2.0 unified schema.
    Not part of the thermal solve path — a one-time file-format migration utility.
    """
    if not old_config or "cabinet" not in old_config:
        raise ValueError("Invalid old config")

    external = old_config["cabinet"]["external"]
    wall_types = old_config["cabinet"].get("wallThicknessesByType", {})
    air_gap = old_config["cabinet"].get("airGap")
    layout = old_config["cabinet"].get("layout")
    d = DEFAULT_CABINET

    walls = {
        "freezer": {
            "top": wall_types.get("freezer", {}).get("top", d["walls"]["freezer"]["top"]),
            "bottom": wall_types.get("freezer", {}).get("bottom", d["walls"]["freezer"]["bottom"]),
            "left": wall_types.get("freezer", {}).get("left", d["walls"]["freezer"]["left"]),
            "right": wall_types.get("freezer", {}).get("right", d["walls"]["freezer"]["right"]),
            "door": wall_types.get("freezer", {}).get("door", d["walls"]["freezer"]["door"]),
            "rear": d["walls"]["freezer"]["rear"],   # old format had no "rear" for the freezer at all
        },
        "refrigerator": {
            "top": wall_types.get("fresh", {}).get("top", d["walls"]["refrigerator"]["top"]),
            "bottom1": wall_types.get("fresh", {}).get("bottom", d["walls"]["refrigerator"]["bottom1"]),
            "bottom2": d["walls"]["refrigerator"]["bottom2"],
            "bottom3": d["walls"]["refrigerator"]["bottom3"],
            "left": wall_types.get("fresh", {}).get("left", d["walls"]["refrigerator"]["left"]),
            "right": wall_types.get("fresh", {}).get("right", d["walls"]["refrigerator"]["right"]),
            "door": wall_types.get("fresh", {}).get("door", d["walls"]["refrigerator"]["door"]),
            "rear": d["walls"]["refrigerator"]["rear"],
        },
    }

    geom = {
        "H": external["height"], "W": external["width"], "D": external["depth"],
        "Hf": d["Hf"], "Hr": d["Hr"], "Hb": d["Hb"], "Db1": d["Db1"], "Db2": d["Db2"],
        "doorGap": d["doorGap"], "packingPos": d["packingPos"],
        "airGap": air_gap if air_gap is not None else d["airGap"],
        "dividerInsulationType": "PU",
        "walls": walls,
    }

    return {
        "schemaVersion": "2.0",
        "meta": {**old_config.get("meta", {}), "updatedAt": now_iso(), "upgradedFrom": old_config.get("schemaVersion")},
        "cabinet": {"geometry": geom, "layout": layout},
        "thermal": old_config.get("thermal"),   # preserved without modification
    }


# ==============================================================================
# SECTION 1 — EVAPORATOR GEOMETRY & THERMAL HELPERS  (evaporator.js)  — verbatim-faithful
# ------------------------------------------------------------------------------
# Called from THREE places:
#   1) inline (simplified) inside solveInner()'s residual function F()
#   2) evaluateSafetyCheckpoints() for the 43C peak-margin check
#   3) UI post-solve display (out of scope here)
# ==============================================================================

def compute_evaporator_area(evap: dict) -> float:
    """
    Total heat-transfer area of the evaporator coil (fins + tubes + side plates).
    Returns A_total in m^2.
    """
    tube_cross_area = PI * (evap["tubeOD_mm"] / 2) ** 2                    # mm^2
    fin_area_per_fin = (
        evap["finLength_mm"] * evap["finHeight_mm"] - tube_cross_area * evap["layers"]
    ) * 2 / 1e6                                                            # m^2, both faces of one fin
    total_fin_area = fin_area_per_fin * evap["numFins"]

    tube_area = (
        PI * evap["tubeOD_mm"] * evap["width_mm"]
    ) * evap["rows"] * evap["layers"] / 1e6

    side_plate_area = (
        evap["height_mm"] * evap["depth_mm"] * evap["sidePlateNo"]
        - tube_cross_area * evap["rows"] * evap["layers"]
    ) * 2 / 1e6

    return total_fin_area + tube_area + side_plate_area  # m^2


def air_speed(fan_param: dict, evap: dict) -> dict:
    """
    Face air velocity across the evaporator coil, from fan geometry + RPM.

    SOURCE-CODE NOTE: only `tipDiam_mm` and `fanRPM` are actually validated —
    there is NO hub-diameter or pitch-angle field, and no hub<tip check. (An
    earlier draft of this pseudocode had invented both; that was wrong and is
    corrected here to match the real source exactly.)
    """
    tip_diam_mm, fan_rpm = fan_param.get("tipDiam_mm"), fan_param.get("fanRPM")

    if fan_param is None or not isinstance(fan_param, dict):
        raise ValueError("fanParam is missing or invalid")
    if tip_diam_mm is None or is_nan(tip_diam_mm) or fan_rpm is None or is_nan(fan_rpm):
        raise ValueError("fanParam missing required fields: tipDiam_mm, fanRPM")

    tip_diam_m = tip_diam_mm / 1000
    R = tip_diam_m / 2   # fan swept-disc radius, m

    # Empirical axial-fan flow-rate approximation (RPM/tip-diameter scaling, calibrated
    # against a 3000 RPM / 100mm reference fan)
    Q_m3s = 70 * fan_rpm / 3000 * ((tip_diam_mm / 100) ** 2) / 3600
    fan_airflow_m3h = Q_m3s * 3600

    # fan_air_speed uses the FAN'S OWN swept-disc area (pi*R^2) — this is a distinct
    # quantity from v_ms below, which uses the EVAPORATOR'S rectangular face area.
    # They are not interchangeable; both are returned separately.
    fan_air_speed = fan_airflow_m3h / (PI * R ** 2) / 3600

    front_area_m2 = (evap["width_mm"] * evap["depth_mm"]) / 1e6
    if front_area_m2 <= 0:
        raise ValueError("Evaporator face area is zero or negative")

    v_ms = fan_airflow_m3h / front_area_m2 / 3600
    fan_airflow_cfm = fan_airflow_m3h * 0.588578   # m^3/h -> CFM

    return {
        "v_ms": v_ms,
        "fanAirflow_m3h": fan_airflow_m3h,
        "fanAirflow_cfm": fan_airflow_cfm,
        "fanAirSpeed": fan_air_speed,   # NOTE: != v_ms, see comment above
    }


def evaporator_alpha(v_ms: float) -> float:
    """
    Convective heat-transfer coefficient, air side (W/m^2K), empirical fit.
    """
    return 12.93 * (v_ms ** 0.415) * 1.16279   # last factor: kcal/h -> W unit correction folded in


def lmtd(T1: float, T2: float, TE: float) -> float:
    """
    Log-mean temperature difference between air stream (T1 in / T2 out)
    and evaporating refrigerant at TE.
    Raises RangeError if TE is not strictly below both air temperatures
    (refrigerant must physically be colder than the air on both sides).
    """
    dT1 = T1 - TE
    dT2 = T2 - TE

    if dT1 <= 1e-4 or dT2 <= 1e-4:
        raise RangeError(f"LMTD Undefined: TE ({TE}) >= Air Temps (T1:{T1}, T2:{T2})")

    ratio = dT1 / dT2
    if abs(ratio - 1.0) < 1e-6:
        # L'Hopital limit as dT1 -> dT2: LMTD -> dT1
        return dT1

    return (dT1 - dT2) / ln(ratio)


def evaporator_capacity(alpha: float, area: float, LMTD: float) -> float:
    """Cooling capacity delivered by the coil, Watts."""
    return alpha * area * LMTD


# ==============================================================================
# SECTION 2 — HEAT LOAD MODEL  (heatLoad.js)  — verbatim-faithful to source
# ------------------------------------------------------------------------------
# calcHeatLoads() builds up QF (freezer), QR (refrigerator), and QEV (parasitic:
# evaporator-back conduction + fan heat + defrost heat) from cabinet geometry,
# fixed set-point temperatures, and current PR (running ratio) / duty cycle.
# ==============================================================================

def lambda_urethane(T_in: float, T_out: float) -> float:
    """
    Thermal conductivity (lambda) of PU foam, W/(m*C).
    IMPORTANT: this is TEMPERATURE-DEPENDENT — lambda worsens (increases) as the
    average wall temperature rises. Every k_exterior/k_interior call below
    therefore implicitly depends on the two temperatures either side of that
    specific wall, not a single fixed insulation constant.
    """
    T_avg = (T_in + T_out) / 2
    return (0.0165 + 0.00011 * (T_avg - 25)) * 1.16279   # kcal/h basis -> W/(m*C)


def k_exterior(thk_mm: float, T_in: float, T_out: float) -> float:
    """U-value (W/m^2K) for an exterior wall: inside film + wall + outside film resistances in series."""
    lam = lambda_urethane(T_in, T_out)
    return 1 / (
        1 / PC["surfaceCoefficients"]["outside"]
        + 1 / PC["surfaceCoefficients"]["inside"]
        + (thk_mm / 1000) / lam
    )


def k_interior(thk_mm: float, T1: float, T2: float, insulation_type: str = "PU") -> float:
    """U-value (W/m^2K) for an internal partition: both faces see 'inside' film coefficient."""
    lam = 0.035 if insulation_type == "EPS" else lambda_urethane(T1, T2)
    return 1 / (
        1 / PC["surfaceCoefficients"]["inside"]
        + 1 / PC["surfaceCoefficients"]["inside"]
        + (thk_mm / 1000) / lam
    )


def calc_heat_loads(geom, temps, electrical, PIPEPITCH,
                     back_condenser_efficiency=0, fan_input_power_w=None,
                     freezer_position="top", back_condenser="No") -> dict:

    # geom fields used below (flat schema):
    # H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    # tFtop, tFleft, tFright, tFbottom, tFdoor, tFback, tEvaBack,
    # tRtop, tRleft, tRright, tRback, tRdoor,
    # tRbottom1, tRbottom2, tRbottom3, tFfloor1, tFfloor2, tFfloor3, tRfloor,
    # dividerInsulationType (default 'PU')

    W, D, Hf, Hr, Hb, Db1, Db2 = geom["W"], geom["D"], geom["Hf"], geom["Hr"], geom["Hb"], geom["Db1"], geom["Db2"]
    doorGap, packingPos = geom["doorGap"], geom["packingPos"]
    divider_insulation_type = geom.get("dividerInsulationType", "PU")

    T0, TF, TR, T2, TC, PR, TE = (
        temps["T0"], temps["TF"], temps["TR"], temps["T2"], temps["TC"], temps["PR"], temps["TE"]
    )

    # --- pipe-pitch correction factors (empirical quadratic, same form as condenser.js)
    K_side = 1.0738 - 0.004152 * PIPEPITCH["side"] + 0.00000482 * PIPEPITCH["side"] ** 2
    K_back = 1.0738 - 0.004152 * PIPEPITCH["back"] + 0.00000482 * PIPEPITCH["back"] ** 2

    T_compZone = T0 + (TC - T0) * PR             # duty-cycle-averaged compressor-compartment temp
    TRise_side = (TC - T0) * K_side
    TRise_back = (TC - T0) * K_back
    T_wallSide = T0 + TRise_side * PR             # NOTE: scaled by PR (duty-cycle-averaged skin temp)
    T_wallBack = T0 + TRise_back * PR

    is_top_freezer = (freezer_position == "top")
    is_back_condenser_absent = (back_condenser != "Yes")
    has_freezer = Hf > 0
    has_fresh = Hr > 0

    # ------------------------------------------------------------------ 1. FREEZER
    QF = 0.0

    if has_freezer:
        AFtop = (W - (geom["tFleft"] + geom["tFright"]) / 2) * (D - geom["tFback"] / 2) / 1e6
        AFdoor = (Hf - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6
        AFpackin = ((Hf - 2 * packingPos) + (W - 2 * packingPos)) * 2 / 1000

        if is_top_freezer:
            AFleft1 = (D - geom["tEvaBack"]) * (Hf - (geom["tFtop"] + geom["tFbottom"]) / 2) / 1e6
            AFleft2 = geom["tEvaBack"] * (Hf - (geom["tFtop"] + geom["tFbottom"]) / 2) / 1e6
            AFright1, AFright2 = AFleft1, AFleft2
        else:
            # bottom-freezer: subtract compressor-step (Db1/Db2/Hb) intrusion from the side wall
            f_side_height = Hf - (geom["tFtop"] + geom["tFfloor1"]) / 2
            AFleft1 = (
                f_side_height * (D - geom["tFback"] / 2)
                - (Db1 + Db2) * Hb / 2
                - geom["tEvaBack"] * (f_side_height - Hb)
            ) / 1e6
            AFleft2 = geom["tEvaBack"] * (f_side_height - Hb) / 1e6
            AFright1, AFright2 = AFleft1, AFleft2

        # Freezer top conduction
        if is_top_freezer:
            QF += k_exterior(geom["tFtop"], TF, T0) * AFtop * (T0 - TF)
        else:
            QF += k_interior(geom["tFtop"], TF, TR, divider_insulation_type) * AFtop * (TR - TF)

        # Freezer sides conduction (upper zone sees condenser-heated skin; lower zone sees T2/evap-back)
        QF += (
            k_exterior(geom["tFleft"], TF, T_wallSide) * AFleft1 * (T_wallSide - TF)
            + k_exterior(geom["tFright"], TF, T_wallSide) * AFright1 * (T_wallSide - TF)
            + k_exterior(geom["tFleft"], T2, T_wallSide) * AFleft2 * (T_wallSide - T2)
            + k_exterior(geom["tFright"], T2, T_wallSide) * AFright2 * (T_wallSide - T2)
        )

        # Freezer bottom (3 configurations)
        if not has_fresh:
            AFb1 = (W - (geom["tFleft"] + geom["tFright"]) / 2) * Db1 / 1e6
            AFb2 = (W - (geom["tFleft"] + geom["tFright"]) / 2) * sqrt(Hb ** 2 + (Db2 - Db1) ** 2) / 1e6
            AFb3 = (W - (geom["tFleft"] + geom["tFright"]) / 2) * (D - Db2) / 1e6
            QF += (
                k_exterior(geom["tFfloor1"], TF, T_compZone) * AFb1 * (T_compZone - TF)
                + k_exterior(geom["tFfloor2"], TF, T_compZone) * AFb2 * (T_compZone - TF)
                + k_exterior(geom["tFfloor3"], TF, T0) * AFb3 * (T0 - TF)
            )
        elif is_top_freezer:
            AFbottom = (D - geom["tFback"] / 2) * (W - (geom["tFleft"] + geom["tFright"]) / 2) / 1e6
            QF += k_interior(geom["tFbottom"], TF, TR, divider_insulation_type) * AFbottom * (TR - TF)
        else:
            AFbottom1 = (W - (geom["tFleft"] + geom["tFright"]) / 2) * Db1 / 1e6
            AFbottom2 = (W - (geom["tFleft"] + geom["tFright"]) / 2) * sqrt(Hb ** 2 + (Db2 - Db1) ** 2) / 1e6
            AFbottom3 = (W - (geom["tFleft"] + geom["tFright"]) / 2) * (D - Db2) / 1e6
            QF += (
                k_exterior(geom["tFfloor1"], TF, T_compZone) * AFbottom1 * (T_compZone - TF)
                + k_exterior(geom["tFfloor2"], TF, T_compZone) * AFbottom2 * (T_compZone - TF)
                + k_exterior(geom["tFfloor3"], TF, T0) * AFbottom3 * (T0 - TF)
            )

        # Door + packing leak
        QF += (
            k_exterior(geom["tFdoor"], TF, T0) * AFdoor * (T0 - TF)
            + PC["insulation"]["packing"] * AFpackin * (T0 - TF)
        )

        # Dew-Point (DP) partition heater losses onto the freezer — TWO terms.
        # These are distinct from condenser.js's Qdpf/Qdpr (those credit the CONDENSER's
        # heat rejection; these debit the FREEZER's heat load). Same physical heater,
        # two different accounting entries in two different modules.
        QF += ((0.1219 * (TC - TF) * PR + 0.07551 * (T0 - TF) * (1 - PR))
               * (W - geom["tFleft"] - geom["tFright"]) / 1000) * 1.16279
        QF += ((0.0344 * (TC - TF) - 0.031235 * (T0 - TF)) * PR
               * (Hf * 2 + W) / 1000) * 1.16279

    # ------------------------------------------------------------- 2. FRESH / FRIDGE
    QR = 0.0

    if has_fresh:
        ARdoor = (Hr - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6
        ARpackin = ((Hr - 2 * packingPos) + (W - 2 * packingPos)) * 2 / 1000

        if is_top_freezer:
            ARtop = (W - (geom["tRleft"] + geom["tRright"]) / 2) * (D - geom["tRback"] / 2) / 1e6
            rH = Hr - (geom["tRtop"] + geom["tRbottom1"]) / 2
            ARleft = (rH * (D - geom["tRback"] / 2) - (Db1 + Db2) * Hb / 2) / 1e6
            ARback = (Hr - (geom["tRtop"] + geom["tRbottom1"]) / 2 - Hb) * (W - (geom["tRleft"] + geom["tRright"]) / 2) / 1e6
        else:
            ARtop = (W - (geom["tRleft"] + geom["tRright"]) / 2) * (D - geom["tRback"] / 2) / 1e6
            rH = Hr - (geom["tRtop"] + geom["tRfloor"]) / 2
            ARleft = (rH * (D - geom["tRback"] / 2)) / 1e6
            ARback = (Hr - (geom["tRtop"] + geom["tRfloor"]) / 2) * (W - (geom["tRleft"] + geom["tRright"]) / 2) / 1e6

        # Top
        if is_top_freezer:
            QR += k_interior(geom["tRtop"], TF, TR, divider_insulation_type) * ARtop * (TF - TR)
        else:
            QR += k_exterior(geom["tRtop"], TR, T0) * ARtop * (T0 - TR)

        # Sides
        # SOURCE-CODE NOTE: both terms below use `ARleft` (the source never computes an
        # `ARright` variable) — i.e. left and right side areas are assumed identical and
        # the right-side conduction is evaluated with the left-side area. Reproduced as-is,
        # not "corrected", since that's what the running code actually computes.
        QR += (
            k_exterior(geom["tRleft"], TR, T_wallSide) * ARleft * (T_wallSide - TR)
            + k_exterior(geom["tRright"], TR, T_wallSide) * ARleft * (T_wallSide - TR)
        )

        # Back
        if is_back_condenser_absent:
            QR += k_exterior(geom["tRback"], TR, T0) * ARback * (T0 - TR)
        else:
            QR += k_exterior(geom["tRback"], TR, T_wallBack) * ARback * (T_wallBack - TR)

        # Bottom (2 configurations)
        if (not has_freezer) or is_top_freezer:
            ARb1 = (W - (geom["tRleft"] + geom["tRright"]) / 2) * Db1 / 1e6
            ARb2 = (W - (geom["tRleft"] + geom["tRright"]) / 2) * sqrt(Hb ** 2 + (Db2 - Db1) ** 2) / 1e6
            ARb3 = (W - (geom["tRleft"] + geom["tRright"]) / 2) * (D - Db2) / 1e6
            QR += (
                k_exterior(geom["tRbottom1"], TR, T_compZone) * ARb1 * (T_compZone - TR)
                + k_exterior(geom["tRbottom2"], TR, T_compZone) * ARb2 * (T_compZone - TR)
                + k_exterior(geom["tRbottom3"], TR, T0) * ARb3 * (T0 - TR)
            )
        else:
            # bottom-freezer: fridge sits on top, interior floor partition down to freezer
            ARbottom = (W - (geom["tRleft"] + geom["tRright"]) / 2) * (D - geom["tRback"] / 2) / 1e6
            QR += k_interior(geom["tRfloor"], TF, TR, divider_insulation_type) * ARbottom * (TF - TR)

        # Door + packing
        QR += (
            k_exterior(geom["tRdoor"], TR, T0) * ARdoor * (T0 - TR)
            + PC["insulation"]["packing"] * ARpackin * (T0 - TR)
        )

        # DP condenser term onto the fridge — single term, no top/bottom-freezer split
        # (unlike the freezer's two-term version above).
        QR += ((0.03322 * (TC - TR) - 0.030267 * (T0 - TR)) * PR * (Hr * 2) / 1000) * 1.16279

    # ------------------------------------------------------- 3. EVAPORATOR & PARASITIC
    # dimensions taken from whichever compartment physically houses the evaporator
    H_evap = Hf if has_freezer else Hr
    tTop_evap = geom["tFtop"] if has_freezer else geom["tRtop"]
    tLeft_evap = geom["tFleft"] if has_freezer else geom["tRleft"]
    tRight_evap = geom["tFright"] if has_freezer else geom["tRright"]
    tBack_evap = geom["tFback"] if has_freezer else geom["tRback"]   # NOTE: computed but never used below (unused in source)

    if has_freezer:
        t_bottom_evap = geom["tFbottom"] if freezer_position == "top" else geom["tFfloor1"]
    else:
        # NOTE: source condition is `(isTopFreezer || freezerPosition === 'top')`, which is
        # a tautology — isTopFreezer IS `freezerPosition === 'top'` — so this always
        # reduces to a plain `freezer_position == 'top'` check. Reproduced as-is.
        t_bottom_evap = geom["tRfloor"] if (is_top_freezer or freezer_position == "top") else geom["tRbottom1"]

    if is_top_freezer or (not has_freezer):
        A_evaBack = (W - (tLeft_evap + tRight_evap) / 2) * (H_evap - (tTop_evap + t_bottom_evap) / 2) / 1e6
    else:
        A_evaBack = (W - (tLeft_evap + tRight_evap) / 2) * (H_evap - Hb - (tTop_evap + t_bottom_evap) / 2) / 1e6

    QEV_cond = 0.0
    if A_evaBack > 0:
        if is_back_condenser_absent:
            QEV_cond = k_exterior(geom["tEvaBack"], T2, T0) * A_evaBack * (T0 - T2)
        else:
            QEV_cond = k_exterior(geom["tEvaBack"], T2, T_wallBack) * A_evaBack * (T_wallBack - T2)

    # Fan runs synchronously with compressor. Defaults to 2.1 W if not supplied.
    fan_load = (fan_input_power_w if fan_input_power_w is not None else 2.1) * PR

    defrost_events_per_day = 24 / (electrical["timerPeriod_h"] / PR)
    defrost_load = (
        electrical["defrostHeater_W"] * (electrical["defrostOn_min"] / 60) * (defrost_events_per_day / 24)
    )

    return {
        "QF": QF,
        "QR": QR,
        "QEV": QEV_cond + fan_load + defrost_load,
        "fanLoad": fan_load,
        "defrostLoad": defrost_load,
        "totalLoad": QF + QR + QEV_cond + fan_load + defrost_load,
    }


# ==============================================================================
# SECTION 3 — CONDENSER HEAT REJECTION  (condenser.js)  — verbatim-faithful to source
# ==============================================================================

def calc_QCout(geom, TC, T0, TF, TR, PR, PIPEPITCH,
                freezer_position="top", back_condenser_efficiency=0) -> dict:

    H, W, D, Hf, Hr, Hb, Db1, Db2 = (
        geom["H"], geom["W"], geom["D"], geom["Hf"], geom["Hr"], geom["Hb"], geom["Db1"], geom["Db2"]
    )
    tFright, tFleft = geom["tFright"], geom["tFleft"]

    # 1. Available exterior surface areas (m^2)
    #    sideArea subtracts a fixed 60mm depth margin and the compressor-step
    #    triangular cutout (Db1+Db2)*Hb/2 from each of the two side panels.
    side_area = ((H * (D - 60)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6
    back_area_raw = (W * (H - Hb)) / 1e6
    back_area = back_area_raw * back_condenser_efficiency

    # 2. Pipe-pitch correction factors (empirical quadratic fit — identical form to heatLoad.js)
    K_side = 1.0738 - 0.004152 * PIPEPITCH["side"] + 0.00000482 * PIPEPITCH["side"] ** 2
    K_back = 1.0738 - 0.004152 * PIPEPITCH["back"] + 0.00000482 * PIPEPITCH["back"] ** 2

    # 3. Dew-Point (DP) perimeter-heater heat REJECTION, credited to the condenser.
    #    NOTE: these are DIFFERENT formulas from the DP heat-LOAD terms added to
    #    QF/QR inside heatLoad.js — same physical anti-sweat heater wire, but this
    #    module accounts for the portion of its heat that ends up rejected via the
    #    condenser loop rather than leaking into the compartments.
    Qdpfr = (0.1984 * (TC - T0) + 0.1219 * (TC - TF)) * PR * (W - tFright - tFleft) / 1000 * 1.16279

    is_top = (freezer_position == "top")
    if is_top:
        Qdpf = (0.3395 * (TC - T0) + 0.0344 * (TC - TF)) * PR * (Hf * 2 + W) / 1000 * 1.16279
        Qdpr = (0.3405 * (TC - T0) + 0.03322 * (TC - TR)) * PR * (Hr * 2) / 1000 * 1.16279
    else:
        Qdpf = (0.3395 * (TC - T0) + 0.0344 * (TC - TF)) * PR * (Hf * 2) / 1000 * 1.16279
        Qdpr = (0.3405 * (TC - T0) + 0.03322 * (TC - TR)) * PR * (Hr * 2 + W) / 1000 * 1.16279

    Qdp = Qdpfr + Qdpf + Qdpr

    # 4. Primary condenser heat rejection (skin condenser: sides + optional back panel)
    Qside = K_side * side_area * (TC - T0) * 1.16279
    Qback = K_back * back_area * (TC - T0) * 1.16279

    return {
        "Qdpfr": Qdpfr, "Qdpf": Qdpf, "Qdpr": Qdpr, "Qdp": Qdp,
        "Qside": Qside, "Qback": Qback,
        "QCout": Qdp + Qside + Qback,
    }


# ==============================================================================
# SECTION 4 — COMPRESSOR PERFORMANCE  (CompressorPerformance.js)  — verbatim-faithful
# ==============================================================================

SUCTION_TEMP_C = 30
KELVIN_OFFSET = 273.16

# ------------------------------------------------------- 4a. REFRIGERANT PROPERTIES
# All four functions per refrigerant are empirical curve fits (NOT REFPROP/table
# lookups). Inputs: T_K = absolute temperature (Kelvin); Pe = saturation pressure.
# liquidEnthalpy takes T in Celsius directly (inconsistent unit convention vs the
# other three, which take Kelvin — reproduced exactly as in source).

def r134a_sat_pressure(T_K: float) -> float:
    return exp(104.918 - 5301.3 / T_K - 16.2481 * ln(T_K) + 0.0246593 * T_K)

def r134a_liquid_enthalpy(T_C: float) -> float:
    # polynomial in Celsius, kcal/kg -> kJ/kg via *4.1868 on every term
    return (100.019 + 0.31763 * T_C + 0.00033057 * T_C ** 2 + 0.0000035281 * T_C ** 3) * 4.1868

def r134a_gas_enthalpy(T_K: float, Pe: float) -> float:
    return (119.36 + 0.023174 * T_K + 0.00031297 * T_K ** 2) * 4.1868 - (138.07 * 4.1868 * Pe) / T_K

def r134a_specific_volume(T_K: float, Pe: float) -> float:
    return 0.01077 + (0.0008278 * T_K) / Pe - 4.511 / T_K - 0.000118 * Pe


def r600a_sat_pressure(T_K: float) -> float:
    return exp(68.322 - 4401 / T_K - 9.8436 * ln(T_K) + 0.0127711 * T_K)

def r600a_liquid_enthalpy(T_C: float) -> float:
    return (75.545 + 0.55731 * T_C + 0.0007088 * T_C ** 2 + 0.0000029408 * T_C ** 3) * 4.1868

def r600a_gas_enthalpy(T_K: float, Pe: float) -> float:
    return (104.5 + 0.049951 * T_K + 0.00058822 * T_K ** 2) * 4.1868 - (249.18 * 4.1868 * Pe) / T_K

def r600a_specific_volume(T_K: float, Pe: float) -> float:
    return 0.015883 + (0.001455 * T_K) / Pe - 7.2936 / T_K - 0.0004645 * Pe


def get_refrigerant_properties(REI: int) -> dict:
    """REI: 1 = R-134a, 2 = R-600a (isobutane). Any other value raises."""
    if REI == 1:
        return {"satPressure": r134a_sat_pressure, "liquidEnthalpy": r134a_liquid_enthalpy,
                "gasEnthalpy": r134a_gas_enthalpy, "specificVolume": r134a_specific_volume}
    if REI == 2:
        return {"satPressure": r600a_sat_pressure, "liquidEnthalpy": r600a_liquid_enthalpy,
                "gasEnthalpy": r600a_gas_enthalpy, "specificVolume": r600a_specific_volume}
    raise ValueError(f"Unsupported refrigerant index {REI}.")


def get_refrigerant_functions_c(refrigerant_index: int) -> dict:
    """Celsius-input wrapper: adds/removes the 273.16 K offset so callers can work in Celsius."""
    prop = get_refrigerant_properties(refrigerant_index)
    return {
        "satPressure": lambda t: prop["satPressure"](t + KELVIN_OFFSET),
        "specificVolume": lambda t, p: prop["specificVolume"](t + KELVIN_OFFSET, p),
        "vaporEnthalpy": lambda t, p: prop["gasEnthalpy"](t + KELVIN_OFFSET, p),
        "liquidEnthalpy": lambda t: prop["liquidEnthalpy"](t),   # already Celsius-native
    }


# --------------------------------------------------------------- 4b. LINEAR ALGEBRA

def gauss_jordan_solve(A: list, b: list) -> list:
    """Solves Ax = b via Gauss-Jordan elimination with partial pivoting."""
    n = len(b)
    M = [row + [b[i]] for i, row in enumerate(A)]   # augmented matrix

    for k in range(n):
        max_row, max_abs = k, abs(M[k][k])
        for i in range(k + 1, n):
            if abs(M[i][k]) > max_abs:
                max_abs, max_row = abs(M[i][k]), i
        if max_row != k:
            M[k], M[max_row] = M[max_row], M[k]

        pivot = M[k][k]
        if abs(pivot) < 1e-12:
            raise ValueError(f"Singular matrix at column {k}.")

        for j in range(k, n + 1):
            M[k][j] /= pivot
        for i in range(n):
            if i == k:
                continue
            factor = M[i][k]
            for j in range(k, n + 1):
                M[i][j] -= factor * M[k][j]

    return [row[n] for row in M]


def build_normal_equations(features: list, targets: list) -> dict:
    """A = X^T X, b = X^T y — the classic OLS normal-equations system."""
    n, m = len(features), len(features[0])
    A = [[0.0] * m for _ in range(m)]
    b = [0.0] * m
    for i in range(n):
        f, y = features[i], targets[i]
        for j in range(m):
            for k in range(m):
                A[j][k] += f[j] * f[k]
            b[j] += f[j] * y
    return {"A": A, "b": b}


# ---------------------------------------------------------------- 4c. RUNTIME EVALUATION

def evaluate_compressor_safely(TE, TC, ref_index, comp_params, RPM=None) -> dict:
    """Dispatches to inverter or constant-speed evaluation depending on comp_params."""
    if isinstance(comp_params.get("compressorModel"), dict):
        return inverter_compressor_performance(TE, TC, RPM, ref_index, comp_params["compressorModel"])

    if comp_params.get("isInverter"):
        raise ValueError("Inverter compressor selected but no fitted model.")

    return compressor_power(
        TE, TC, ref_index,
        comp_params["wCoeffs"], comp_params["etaCoeffs"],
        comp_params["cylinderVolumeCm3"], comp_params["speedRpm"],
    )


def compressor_power(TE, TC, ref_index, w_coeffs, eta_coeffs, cyl_vol_cm3, speed_rpm) -> dict:
    """
    Constant-speed compressor model: 2nd-order polynomial fit in (TE, TC) for power,
    and a Pc/Pe-ratio-based polynomial for volumetric efficiency.

    *** IMPORTANT MODELING CONVENTION ***
    Both hLiq and hGas are evaluated at the FIXED SUCTION_TEMP_C (30C) basis —
    NOT at TC (condensing temp) or the real cycle subcooled-liquid state. Only the
    saturation PRESSURE Pe (from TE) enters the gas-enthalpy correction term.
    This is not a bug: computeCompressorCoefficients() (Section 4d below) uses the
    exact same 30C basis when it originally fit wCoeffs/etaCoeffs from test data, so
    prediction and fitting are self-consistent. The result, QCompressor here, is a
    *compressor-curve* capacity estimate on a fixed reference basis — solveInner's
    SLHX energy-balance step (Section 5c, solver.js) later corrects it for the
    system's *actual* subcooling before it's used in the outer energy balance.
    """
    prop = get_refrigerant_properties(ref_index)
    Pe = prop["satPressure"](TE + KELVIN_OFFSET)
    Pc = prop["satPressure"](TC + KELVIN_OFFSET)

    AW, BW, CW, DW, EW = w_coeffs
    comp_power = AW + BW * TE + CW * TC + DW * TC * TE + EW * (TE ** 2)   # Watts

    A, B, C = eta_coeffs
    vol_eff = A + B * (Pc / Pe) + C * Pc            # dimensionless, ~0..1

    suction_temp_K = SUCTION_TEMP_C + KELVIN_OFFSET
    v_gas = prop["specificVolume"](suction_temp_K, Pe)
    h_liq = prop["liquidEnthalpy"](SUCTION_TEMP_C)          # fixed 30C basis, NOT TC
    h_gas = prop["gasEnthalpy"](suction_temp_K, Pe)          # fixed 30C basis, only Pe varies with TE

    G = vol_eff * ((cyl_vol_cm3 * speed_rpm * 60) / 1e6) / v_gas   # kg/hr, theoretical-flow x efficiency

    return {
        "Pe": Pe, "Pc": Pc,
        "VolumetricEfficiency": vol_eff,
        "QCompressor": G * (h_gas - h_liq) / 3.6,   # kg/hr * kJ/kg -> kJ/hr, /3.6 -> Watts
        "CompPower": comp_power,
        "massFlow": G,
    }


def inverter_compressor_performance(TE, TC, RPM, ref_index, compressor_model) -> dict:
    """
    Inverter compressor model: predicts Q (capacity, W) and W (power, W) from
    fitted surfaces, then derives massFlow from Q using the SAME fixed 30C
    enthalpy-basis convention as compressor_power() above.
    """
    Q_model, W_model = compressor_model["Q"], compressor_model["W"]
    normalize_RPM = compressor_model["normalizeRPM"]
    center_TE, center_TC = compressor_model["centerTE"], compressor_model["centerTC"]

    def predict(model, TE, TC, RPM):
        if model["type"] == "global":
            feat = make_features(model["rpmForm"], RPM / normalize_RPM, TE - center_TE, TC - center_TC)
            y = model["coeffs"][0] + sum(f * c for f, c in zip(feat, model["coeffs"][1:]))
            return exp(y) if model["logTransform"] else y
        else:
            return model["predict"](RPM, TE, TC)   # piecewise closure, see fit_piecewise_inverter()

    Q_compressor = predict(Q_model, TE, TC, RPM)
    comp_power = predict(W_model, TE, TC, RPM)

    prop = get_refrigerant_properties(ref_index)
    Pe = prop["satPressure"](TE + KELVIN_OFFSET)
    Pc = prop["satPressure"](TC + KELVIN_OFFSET)
    suction_temp_K = SUCTION_TEMP_C + KELVIN_OFFSET

    mass_flow = Q_compressor * 3.6 / (
        prop["gasEnthalpy"](suction_temp_K, Pe) - prop["liquidEnthalpy"](SUCTION_TEMP_C)
    )

    return {
        "QCompressor": Q_compressor, "CompPower": comp_power,
        "massFlow": mass_flow, "Pe": Pe, "Pc": Pc, "VolumetricEfficiency": None,
    }


# --------------------------------------------------------- 4d. OFFLINE FITTING
# Triggered only from the UI "Add/Edit Compressor" flow — NOT part of the live
# solve loop.

def compute_compressor_coefficients(cylinder_volume_cm3, speed_rpm, refrigerant_index, data_points) -> dict:
    """
    OLS fit for a constant-speed compressor from raw test points {TE, TC, Q, W}.
    Fits:  volumetric_efficiency = A + B*(Pc/Pe) + C*Pc        (target = actual/theoretical flow ratio)
           W (power)             = AW + BW*TE + CW*TC + DW*TC*TE + EW*TE^2
    """
    if len(data_points) < 5:
        raise ValueError("At least 5 points required.")

    prop = get_refrigerant_properties(refrigerant_index)
    suction_temp_K = SUCTION_TEMP_C + KELVIN_OFFSET
    h_liquid = prop["liquidEnthalpy"](SUCTION_TEMP_C)   # same fixed-basis convention as runtime eval

    eta_features, eta_targets, w_features, w_targets = [], [], [], []

    for point in data_points:
        TE, TC, Q, W = point["TE"], point["TC"], point["Q"], point["W"]
        Pe = prop["satPressure"](TE + KELVIN_OFFSET)
        Pc = prop["satPressure"](TC + KELVIN_OFFSET)
        h_gas = prop["gasEnthalpy"](suction_temp_K, Pe)
        v_gas = prop["specificVolume"](suction_temp_K, Pe)

        G = Q * 3.6 / (h_gas - h_liquid)                                    # actual mass flow, kg/hr, from test-point Q
        GK = (cylinder_volume_cm3 * speed_rpm * 60) / 1e6 / v_gas           # theoretical mass flow, kg/hr

        eta_features.append([1, Pc / Pe, Pc])
        eta_targets.append(G / GK)                                          # eta target = actual/theoretical ratio
        w_features.append([1, TE, TC, TC * TE, TE * TE])
        w_targets.append(W)

    eta_eqs = build_normal_equations(eta_features, eta_targets)
    w_eqs = build_normal_equations(w_features, w_targets)

    return {
        "etaCoeffs": gauss_jordan_solve(eta_eqs["A"], eta_eqs["b"]),
        "wCoeffs": gauss_jordan_solve(w_eqs["A"], w_eqs["b"]),
    }


# ---- Ridge regression + matrix utilities for inverter fitting ----

def matrix_multiply(A: list, B: list) -> list:
    rows_a, cols_a, cols_b = len(A), len(A[0]), len(B[0])
    C = [[0.0] * cols_b for _ in range(rows_a)]
    for i in range(rows_a):
        for k in range(cols_a):
            for j in range(cols_b):
                C[i][j] += A[i][k] * B[k][j]
    return C


def transpose(A: list) -> list:
    return [[row[c] for row in A] for c in range(len(A[0]))]


def solve_ridge(X: list, y: list, alpha: float) -> list:
    """
    Ridge regression: standardize X (zero-mean, unit-variance per column), center y,
    solve (X'X + alpha*I)*beta = X'y via Gauss-Jordan, then un-scale coefficients
    back into the original (unstandardized) feature space.
    """
    n, p = len(X), len(X[0])

    x_means = [sum(X[i][j] for i in range(n)) / n for j in range(p)]
    y_mean = sum(y) / n

    x_stds = [0.0] * p
    for i in range(n):
        for j in range(p):
            x_stds[j] += (X[i][j] - x_means[j]) ** 2
    x_stds = [sqrt(s / n) if sqrt(s / n) != 0 else 1.0 for s in x_stds]

    X_scaled = [[(X[i][j] - x_means[j]) / x_stds[j] for j in range(p)] for i in range(n)]
    y_centered = [y[i] - y_mean for i in range(n)]

    Xt = transpose(X_scaled)
    XtX = matrix_multiply(Xt, X_scaled)
    for j in range(p):
        XtX[j][j] += alpha   # ridge penalty on the standardized diagonal

    Xty = [sum(Xt[j][i] * y_centered[i] for i in range(n)) for j in range(p)]
    beta_scaled = gauss_jordan_solve(XtX, Xty)

    coefs_unscaled = [beta_scaled[j] / x_stds[j] for j in range(p)]
    intercept_unscaled = y_mean - sum(coefs_unscaled[j] * x_means[j] for j in range(p))

    return [intercept_unscaled] + coefs_unscaled


def make_features(rpm_form: str, n: float, te: float, tc: float) -> list:
    """n = RPM already normalized (RPM / normalizeRPM) before this call."""
    if rpm_form == "n_lin":
        return [n, n * te, n * tc, n * tc * te, n * te ** 2]
    if rpm_form == "n_quad":
        return [n, n ** 2, n * te, n * tc, n * tc * te, n * te ** 2]
    if rpm_form == "ln_n_lin":
        ln_n = ln(max(n, 1e-12))
        return [ln_n, ln_n * te, ln_n * tc, ln_n * tc * te, ln_n * te ** 2]
    if rpm_form == "ln_n_quad":
        ln_n = ln(max(n, 1e-12))
        return [ln_n, ln_n ** 2, ln_n * te, ln_n * tc, ln_n * tc * te, ln_n * te ** 2]
    raise ValueError(f"Unknown rpmForm: {rpm_form}")


def cv_inverter(data_points, target_col, rpm_form, log_transform, alphas,
                 normalize_RPM, center_TE, center_TC) -> dict:
    """
    Leave-one-RPM-GROUP-out cross-validation (every point sharing an RPM value
    is held out together, not one point at a time), scanning a grid of ridge alphas.
    """
    groups = [d["RPM"] for d in data_points]
    unique_groups = list(set(groups))
    if len(unique_groups) < 2:
        return {"alpha": None, "avgRMSE": INFINITY}

    best_alpha, best_avg_rmse = None, INFINITY
    for alpha in alphas:
        sum_rmse, valid_folds = 0.0, 0
        for g in unique_groups:
            train_idx = [i for i, d in enumerate(data_points) if d["RPM"] != g]
            test_idx = [i for i, d in enumerate(data_points) if d["RPM"] == g]
            if len(train_idx) < 2 or len(test_idx) == 0:
                continue

            X_train = [make_features(rpm_form, data_points[i]["RPM"] / normalize_RPM,
                                      data_points[i]["TE"] - center_TE, data_points[i]["TC"] - center_TC)
                       for i in train_idx]
            y_train = [ln(data_points[i][target_col]) if log_transform else data_points[i][target_col]
                       for i in train_idx]
            coeffs = solve_ridge(X_train, y_train, alpha)

            X_test = [make_features(rpm_form, data_points[i]["RPM"] / normalize_RPM,
                                     data_points[i]["TE"] - center_TE, data_points[i]["TC"] - center_TC)
                      for i in test_idx]
            preds = [coeffs[0] + sum(x * c for x, c in zip(xi, coeffs[1:])) for xi in X_test]
            errs = [
                ((exp(preds[k]) if log_transform else preds[k]) - data_points[i][target_col]) ** 2
                for k, i in enumerate(test_idx)
            ]
            sum_rmse += sqrt(sum(errs) / len(errs))
            valid_folds += 1

        avg_rmse = sum_rmse / valid_folds if valid_folds > 0 else INFINITY
        if avg_rmse < best_avg_rmse:
            best_avg_rmse, best_alpha = avg_rmse, alpha

    return {"alpha": best_alpha, "avgRMSE": best_avg_rmse}


def fit_piecewise_inverter(data_points, target_col, split_rpm, normalize_RPM, center_TE, center_TC) -> dict:
    """
    Two-region model: a quadratic-in-RPM surface for RPM <= split_rpm (normalized by
    split_rpm), a separate quadratic surface fit ONLY on points at the max RPM, and
    linear interpolation in between. Both regions use fixed ridge alpha = 1.0.
    """
    low_data = [d for d in data_points if d["RPM"] <= split_rpm]
    if len(low_data) < 6:
        raise ValueError("Not enough low-range points.")

    coeffs_low = solve_ridge(
        [make_features("n_quad", d["RPM"] / split_rpm, d["TE"] - center_TE, d["TC"] - center_TC) for d in low_data],
        [d[target_col] for d in low_data], 1.0,
    )

    max_rpm = max(d["RPM"] for d in data_points)
    max_data = [d for d in data_points if d["RPM"] == max_rpm]
    coeffs_max = solve_ridge(
        [make_features("n_quad", 1.0, d["TE"] - center_TE, d["TC"] - center_TC) for d in max_data],
        [d[target_col] for d in max_data], 1.0,
    )

    def predict(RPM, TE, TC):
        if RPM <= split_rpm:
            feat = make_features("n_quad", RPM / split_rpm, TE - center_TE, TC - center_TC)
            return coeffs_low[0] + sum(f * c for f, c in zip(feat, coeffs_low[1:]))
        if RPM == max_rpm:
            feat = make_features("n_quad", 1.0, TE - center_TE, TC - center_TC)
            return coeffs_max[0] + sum(f * c for f, c in zip(feat, coeffs_max[1:]))
        # linear interpolation between the two regional predictions
        val_low = predict(split_rpm, TE, TC)
        val_max = predict(max_rpm, TE, TC)
        return val_low + (val_max - val_low) * ((RPM - split_rpm) / (max_rpm - split_rpm))

    preds = [predict(d["RPM"], d["TE"], d["TC"]) for d in data_points]
    rmse = sqrt(sum((p - d[target_col]) ** 2 for p, d in zip(preds, data_points)) / len(preds))

    return {"type": "piecewise", "splitRPM": split_rpm, "maxRPM": max_rpm,
            "coeffs_low": coeffs_low, "coeffs_max": coeffs_max, "rmse": rmse, "predict": predict}


def build_global_model(data_points, target_col, normalize_RPM, center_TE, center_TC, target_rmse) -> dict:
    """
    Grid search over 4 rpmForm variants x 2 logTransform options x 6 ridge alphas
    (via cv_inverter), pick the combo with lowest CV RMSE, then refit on ALL data
    at that combo to get the final coeffs.
    NOTE: `target_rmse` is accepted as a parameter but never actually referenced
    anywhere in this function's logic — the full grid always runs regardless of it.
    """
    best, best_rmse = None, INFINITY
    for rpm_form in ("n_lin", "n_quad", "ln_n_lin", "ln_n_quad"):
        for log_trans in (False, True):
            cv = cv_inverter(data_points, target_col, rpm_form, log_trans,
                              [0.001, 0.01, 0.1, 1, 10, 100], normalize_RPM, center_TE, center_TC)
            if cv["avgRMSE"] < best_rmse:
                best_rmse = cv["avgRMSE"]
                best = {"type": "global", "rpmForm": rpm_form, "logTransform": log_trans,
                        "alpha": cv["alpha"], "cvRMSE": cv["avgRMSE"]}

    if best is None:
        return None

    X = [make_features(best["rpmForm"], d["RPM"] / normalize_RPM, d["TE"] - center_TE, d["TC"] - center_TC)
         for d in data_points]
    y = [ln(d[target_col]) if best["logTransform"] else d[target_col] for d in data_points]
    best["coeffs"] = solve_ridge(X, y, best["alpha"])
    best["rmse"] = best_rmse   # NOTE: set to the CV RMSE, not a fresh in-sample RMSE
    return best


def select_inverter_model(data_points, target_col, target_rmse, normalize_RPM, center_TE, center_TC) -> dict:
    unique_rpms = sorted(set(d["RPM"] for d in data_points))
    global_best = build_global_model(data_points, target_col, normalize_RPM, center_TE, center_TC, target_rmse)

    if len(unique_rpms) < 3:
        return global_best   # not enough distinct RPM levels to attempt a piecewise split

    best_piecewise, best_piecewise_rmse = None, INFINITY
    for idx in range(1, len(unique_rpms) - 1):   # every INTERNAL split point (excludes min & max RPM)
        try:
            pw = fit_piecewise_inverter(data_points, target_col, unique_rpms[idx], normalize_RPM, center_TE, center_TC)
            if pw["rmse"] < best_piecewise_rmse:
                best_piecewise_rmse, best_piecewise = pw["rmse"], pw
        except ValueError:
            continue   # split point left too few low-range points; skip it

    global_rmse_for_comparison = global_best.get("cvRMSE", global_best.get("rmse"))
    if best_piecewise is not None and (best_piecewise_rmse + 0.5) < global_rmse_for_comparison:
        return best_piecewise
    return global_best


def fit_inverter_coefficients(data_points, normalize_RPM, center_TE, center_TC, target_rmse=3.0) -> dict:
    """Orchestrates the full Ridge+CV fitting routine, once each for Q (capacity) and W (power)."""
    return {
        "Q": select_inverter_model(data_points, "Q", target_rmse, normalize_RPM, center_TE, center_TC),
        "W": select_inverter_model(data_points, "W", target_rmse, normalize_RPM, center_TE, center_TC),
        "normalizeRPM": normalize_RPM, "centerTE": center_TE, "centerTC": center_TC,
    }


# ==============================================================================
# SECTION 5 — SOLVER CORE  (solver.js)  — verbatim-faithful to source
# ==============================================================================

RHO_AIR = PC["air"]["density"]   # kg/m^3
CP_AIR = PC["air"]["cp"]         # kJ/(kg*K)
KELVIN_OFFSET = 273.16

# Volumetric heat capacity of air: Watts per (m^3/h of flow) per Kelvin.
# (RHO_AIR * CP_AIR * 1000) converts kJ->J; /3600 converts per-hour to per-second (Watts).
CV = (RHO_AIR * CP_AIR * 1000) / 3600


def get_refrigerant_index(name: str) -> int:
    if name == "R-134a":
        return 1
    if name == "R-600a":
        return 2
    raise ValueError(f"Unsupported refrigerant: {name}")


def get_temperature_from_liquid_enthalpy(h_target: float, prop: dict) -> float:
    """Bisection search for the Celsius temperature whose liquidEnthalpy() equals h_target."""
    low, high = -100, 150
    for _ in range(50):
        mid = (low + high) / 2
        if prop["liquidEnthalpy"](mid) < h_target:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def evaluate_compressor_safely(TE, TC, ref_index, comp_params, RPM=None) -> dict:
    """Dispatches to inverter or constant-speed evaluation depending on comp_params."""
    if isinstance(comp_params.get("compressorModel"), dict):
        return inverter_compressor_performance(TE, TC, RPM, ref_index, comp_params["compressorModel"])
    if comp_params.get("isInverter"):
        raise ValueError("Inverter compressor selected but no fitted model.")
    return compressor_power(
        TE, TC, ref_index,
        comp_params["wCoeffs"], comp_params["etaCoeffs"],
        comp_params.get("cylinderVolumeCm3", comp_params.get("Vc")),
        comp_params.get("speedRpm", comp_params.get("rpm")),
    )


# ------------------------------------------------ 5a. GENERIC 2-D NEWTON SOLVE

def newton2(F, x0, dx, tol, max_iter, bounds, debug=False) -> dict:
    """
    2-variable Newton-Raphson with finite-difference Jacobian and Armijo
    backtracking line search. Falls back to a gradient-descent direction
    if the Jacobian is (near-)singular.
    """
    x = list(x0)

    try:
        f = F(x)
        if isinstance(f, dict) and f.get("error"):
            return {"x": x, "f": [NAN, NAN], "normF": NAN, "converged": False, "iterations": 0, "error": f["error"]}
        norm_f = sqrt(f[0] ** 2 + f[1] ** 2)
    except Exception as e:
        return {"x": x, "f": [NAN, NAN], "normF": NAN, "converged": False, "iterations": 0,
                "error": f"Initial F(x) failed: {e}"}

    for i in range(max_iter):
        if norm_f <= tol:
            return {"x": x, "f": f, "normF": norm_f, "converged": True, "iterations": i + 1}

        J = [[0, 0], [0, 0]]
        try:
            for j in range(2):
                h = max(1e-7, abs(x[j]) * 1e-6)
                xp = list(x)
                if xp[j] + h > bounds[j][1]:
                    # too close to the upper bound: use a BACKWARD difference instead
                    xp[j] -= h
                    fp = F(xp)
                    if isinstance(fp, dict) and fp.get("error"):
                        raise ValueError(fp["error"])
                    J[0][j] = (f[0] - fp[0]) / h
                    J[1][j] = (f[1] - fp[1]) / h
                else:
                    xp[j] += h
                    fp = F(xp)
                    if isinstance(fp, dict) and fp.get("error"):
                        raise ValueError(fp["error"])
                    J[0][j] = (fp[0] - f[0]) / h
                    J[1][j] = (fp[1] - f[1]) / h
        except Exception as e:
            return {"x": x, "f": f, "normF": norm_f, "converged": False, "iterations": i + 1,
                    "error": f"Jacobian failed: {e}"}

        det = J[0][0] * J[1][1] - J[0][1] * J[1][0]

        if abs(det) > 1e-12:
            inv_det = 1.0 / det
            direction = [
                -inv_det * (J[1][1] * f[0] - J[0][1] * f[1]),
                -inv_det * (-J[1][0] * f[0] + J[0][0] * f[1]),
            ]
        else:
            direction = [
                -(J[0][0] * f[0] + J[1][0] * f[1]),
                -(J[0][1] * f[0] + J[1][1] * f[1]),
            ]
            dir_norm = sqrt(direction[0] ** 2 + direction[1] ** 2)
            if dir_norm < 1e-12:
                return {"x": x, "f": f, "normF": norm_f, "converged": False, "iterations": i + 1,
                        "error": "Saddle point."}

        # --- Proportional vector scaling: ONE shared scale factor applied to BOTH
        # components, so the step's direction/angle is preserved exactly, only its
        # magnitude is reduced. (Not an independent per-axis clamp.)
        max_step_T2 = 5.0
        domain_span_var2 = bounds[1][1] - bounds[1][0]
        max_step_var2 = 500 if domain_span_var2 > 2 else 0.15

        scale = 1.0
        if abs(direction[0]) > max_step_T2:
            scale = min(scale, max_step_T2 / abs(direction[0]))
        if abs(direction[1]) > max_step_var2:
            scale = min(scale, max_step_var2 / abs(direction[1]))
        direction[0] *= scale
        direction[1] *= scale

        alpha, accept = 1.0, False
        armijo_c = 1e-4
        new_x = new_f = new_norm = None

        for bt in range(15):
            new_x = [
                max(bounds[0][0], min(bounds[0][1], x[0] + alpha * direction[0])),
                max(bounds[1][0], min(bounds[1][1], x[1] + alpha * direction[1])),
            ]
            try:
                new_f = F(new_x)
                if isinstance(new_f, dict) and new_f.get("error"):
                    raise ValueError(new_f["error"])
                new_norm = sqrt(new_f[0] ** 2 + new_f[1] ** 2)
            except Exception:
                alpha *= 0.5
                continue

            if new_norm < norm_f * (1.0 - armijo_c * alpha):
                accept = True
                break
            alpha *= 0.5

        if not accept:
            # Line search exhausted. Check whether x is pinned at (within 1e-4 of) a
            # bound in the direction the Newton step wanted to go — if so, treat this
            # as a soft "converged with warning" (compressor sizing limit), not a
            # hard failure.
            if abs(x[1] - bounds[1][0]) < 1e-4 and direction[1] < 0:
                return {"x": x, "f": f, "normF": norm_f, "converged": True, "iterations": i + 1,
                        "warning": "Compressor oversized limit."}
            if abs(x[1] - bounds[1][1]) < 1e-4 and direction[1] > 0:
                return {"x": x, "f": f, "normF": norm_f, "converged": True, "iterations": i + 1,
                        "warning": "Compressor undersized limit."}
            return {"x": x, "f": f, "normF": norm_f, "converged": False, "iterations": i + 1,
                    "error": "Line search failed."}

        x, f, norm_f = new_x, new_f, new_norm

    return {"x": x, "f": f, "normF": norm_f, "converged": False, "iterations": max_iter,
            "error": "Max iterations reached"}


# --------------------------------------------- 5b. INNER 2-D SOLVE (T2, PR/RPM)

def solve_inner(TC, geom, comp_params, refrigerant, subcool, fixed_temps, fan, electrical,
                 condenser_config, TE, freezer_pos, inner_opts=None, fixed_PR=None, evap_geom=None) -> dict:
    inner_opts = inner_opts or {}
    tol = inner_opts.get("tol", 1e-4)
    max_iter = inner_opts.get("maxIter", 100)
    dx = inner_opts.get("dx", 1e-3)
    damp = electrical.get("Damp", 1.0)

    PIPEPITCH = {"side": condenser_config["sidePipePitch_mm"], "back": condenser_config["backPipePitch_mm"]}
    ref_index = get_refrigerant_index(refrigerant)
    is_inverter_mode = comp_params.get("isInverter") and fixed_PR is not None

    if is_inverter_mode:
        bounds = [[-80, 20], [comp_params.get("rpmMin", 1000), comp_params.get("rpmMax", 6000)]]
        initial_guess = [inner_opts.get("initialT2", -21.25), inner_opts.get("initialRPM", 3000)]
    else:
        bounds = [[-80, 20], [0.001, 0.999]]
        if inner_opts.get("forcePR") is not None:
            # NOTE: this collapses the PR bound to a single point, effectively forcing
            # Newton's second variable to stay exactly at forcePR (only T2 is free).
            bounds[1] = [inner_opts["forcePR"], inner_opts["forcePR"]]
        initial_guess = [
            inner_opts.get("initialT2", -21.25),
            inner_opts.get("forcePR", inner_opts.get("initialPR", 0.59)),
        ]

    # `converged_TE` / `converged_Tsubcool` are mutated as SIDE EFFECTS from inside F()
    # below (a closure variable, not part of Newton's state vector). Whatever the LAST
    # F() call during the Newton solve computed is what these hold when newton2 returns.
    # Because normF<=tol is checked BEFORE any further F() call each iteration, this ends
    # up consistent with the accepted/converged x — but it's a side-channel value smuggled
    # out of the residual function, not something newton2 itself is aware of.
    converged_TE = TE
    converged_Tsubcool = TC - subcool

    def F(vars):
        nonlocal converged_TE, converged_Tsubcool
        T2, second_var = vars
        PR = fixed_PR if is_inverter_mode else second_var
        RPM = second_var if is_inverter_mode else None

        # NOTE: TE=-25 here is a placeholder — calcHeatLoads() never actually reads
        # temps.TE anywhere in its body (confirmed in Section 2); it's only present
        # to satisfy the destructuring in that function's signature.
        loads = calc_heat_loads(geom, {**fixed_temps, "T2": T2, "TC": TC, "PR": PR, "TE": -25},
                                 electrical, PIPEPITCH, condenser_config["backCondenserEfficiency"],
                                 fan["inputPower_W"], freezer_pos, condenser_config["backCondenser"])

        flow_m3h = fan["fanAirflow_m3h"]
        face_area_m2 = (evap_geom["width_mm"] / 1000) * (evap_geom["depth_mm"] / 1000)
        v_ms = (flow_m3h / 3600) / face_area_m2
        alpha = 12.93 * (v_ms ** 0.415) * 1.16279
        UA = alpha * evap_geom["evapArea_m2"]

        total_heat_w = loads["QF"] + loads["QR"] + loads["QEV"]
        LMTD_req = total_heat_w / PR / UA

        T3 = T2 + loads["QEV"] / (flow_m3h * CV * PR)
        denom_R = CV * max(0.01, fixed_temps["TR"] - T3) * PR * damp
        MR = min(flow_m3h, max(0, loads["QR"] / denom_R)) if denom_R > 0 else 0
        MF = flow_m3h - MR
        T1 = (MF * fixed_temps["TF"] + MR * fixed_temps["TR"]) / flow_m3h

        if is_inverter_mode and not (bounds[1][0] <= RPM <= bounds[1][1]):
            return {"error": f"RPM {RPM} out of bounds [{bounds[1][0]}, {bounds[1][1]}]"}
        if not is_inverter_mode and not (bounds[1][0] <= PR <= bounds[1][1]):
            return {"error": f"PR {PR} out of bounds [{bounds[1][0]}, {bounds[1][1]}]"}

        calculated_TE = solve_TE_brent(T1, T2, LMTD_req)
        if not is_finite(calculated_TE):
            return {"error": "TE search failed: LMTD impossible"}

        converged_TE = calculated_TE
        comp = evaluate_compressor_safely(calculated_TE, TC, ref_index, comp_params, RPM)

        prop = get_refrigerant_properties(ref_index)   # RAW Kelvin-basis functions, not the Celsius wrapper
        h_gas_TE = prop["gasEnthalpy"](calculated_TE + KELVIN_OFFSET, comp["Pe"])

        # --- SLHX (suction-line heat exchanger) energy balance: corrects the
        # compressor curve's fixed-30C-basis QCompressor (see Section 4c note) for
        # the SYSTEM's actual subcooling.
        T_cond_exit = TC - subcool
        h_liq_cond_exit = prop["liquidEnthalpy"](T_cond_exit)

        T_suction_actual = min(30, T_cond_exit)   # suction gas can't be hotter than the liquid source
        h_suc_out = prop["gasEnthalpy"](T_suction_actual + KELVIN_OFFSET, comp["Pe"])
        h_suc_in = h_gas_TE

        slhx_heat_exchange = max(0, h_suc_out - h_suc_in)
        h_liq_exp_in = h_liq_cond_exit - slhx_heat_exchange

        h_liq_min = prop["liquidEnthalpy"](calculated_TE)   # liquid can't be cooled below TE
        if h_liq_exp_in < h_liq_min:
            h_liq_exp_in = h_liq_min

        comp["QCompressor"] = (comp["massFlow"] * (h_gas_TE - h_liq_exp_in)) / 3.6   # OVERWRITES the compressor-curve value
        converged_Tsubcool = get_temperature_from_liquid_enthalpy(h_liq_exp_in, prop)

        f1 = loads["QF"] - MF * CV * (fixed_temps["TF"] - T3) * PR
        f2 = total_heat_w - comp["QCompressor"] * PR
        return [f1, f2]

    res = newton2(F, initial_guess, [dx, dx], tol, max_iter, bounds, inner_opts.get("debug") or True)
    # SOURCE-CODE BUG: `inner_opts.get("debug") or True` is ALWAYS True — if debug is
    # falsy/absent, `False or True` still evaluates to True. Debug logging is therefore
    # forced on unconditionally in the real source, regardless of the caller's setting.
    # (Cosmetic only — floods the console, doesn't affect the math — but real.)

    if not res["converged"]:
        err = res.get("error", "") or ""
        if "undersized" not in err and "oversized" not in err:
            if is_inverter_mode:
                rpm_min, rpm_max = comp_params.get("rpmMin", 1000), comp_params.get("rpmMax", 6000)
                mid_rpm = (rpm_min + rpm_max) / 2
                fallback_guesses = [
                    [initial_guess[0], mid_rpm],
                    [initial_guess[0] - 2, rpm_min],
                    [initial_guess[0] + 2, rpm_max],
                    [-21, mid_rpm],
                ]
            else:
                fallback_guesses = [
                    [initial_guess[0], 0.4],
                    [initial_guess[0] - 2, 0.5],
                    [-21, 0.3],
                ]
            for guess in fallback_guesses:
                res = newton2(F, guess, [dx, dx], tol, max_iter, bounds, inner_opts.get("debug") or True)
                if res["converged"]:
                    break

    if not res["converged"]:
        return {
            **res, "T2": res["x"][0],
            "PR": fixed_PR if is_inverter_mode else res["x"][1],
            "RPM": res["x"][1] if is_inverter_mode else None,
        }

    # --- converged: recompute the full physical state at the solution point ---
    fT2 = res["x"][0]
    fPR = fixed_PR if is_inverter_mode else res["x"][1]
    fRPM = res["x"][1] if is_inverter_mode else None
    flow_m3h = fan["fanAirflow_m3h"]

    loads = calc_heat_loads(geom, {**fixed_temps, "T2": fT2, "TC": TC, "PR": fPR, "TE": converged_TE},
                             electrical, PIPEPITCH, condenser_config["backCondenserEfficiency"],
                             fan["inputPower_W"], freezer_pos, condenser_config["backCondenser"])
    comp = evaluate_compressor_safely(converged_TE, TC, ref_index, comp_params, fRPM)

    # Re-apply the SLHX correction one more time at the final (fixed) converged_TE —
    # this duplicates the exact block inside F() above, verbatim, rather than reusing it.
    prop = get_refrigerant_properties(ref_index)
    h_gas_TE = prop["gasEnthalpy"](converged_TE + KELVIN_OFFSET, comp["Pe"])
    T_cond_exit = TC - subcool
    h_liq_cond_exit = prop["liquidEnthalpy"](T_cond_exit)
    T_suction_actual = min(30, T_cond_exit)
    h_suc_out = prop["gasEnthalpy"](T_suction_actual + KELVIN_OFFSET, comp["Pe"])
    h_suc_in = h_gas_TE
    h_liq_exp_in = h_liq_cond_exit - max(0, h_suc_out - h_suc_in)
    if h_liq_exp_in < prop["liquidEnthalpy"](converged_TE):
        h_liq_exp_in = prop["liquidEnthalpy"](converged_TE)
    comp["QCompressor"] = (comp["massFlow"] * (h_gas_TE - h_liq_exp_in)) / 3.6
    converged_Tsubcool = get_temperature_from_liquid_enthalpy(h_liq_exp_in, prop)

    fT3 = fT2 + loads["QEV"] / (flow_m3h * CV * fPR)
    f_denom_R = CV * max(0.01, fixed_temps["TR"] - fT3) * fPR * damp
    fMR = min(flow_m3h, max(0, loads["QR"] / f_denom_R)) if f_denom_R > 0 else 0
    fMF = flow_m3h - fMR
    fT1 = (fMF * fixed_temps["TF"] + fMR * fixed_temps["TR"]) / flow_m3h

    # THIS is where the "compressor" sub-object gets its final field names
    # (coolingCapacity / inputPower / COP / etaV) — confirming the gap flagged in the
    # previous revision of this file: index.js's expectations are satisfied HERE.
    return {
        "T2": fT2, "PR": fPR, "RPM": fRPM, "TE": converged_TE,
        "converged": True, "iterations": res["iterations"], "warning": res.get("warning"),
        "heatLoads": loads,
        "compressor": {
            "etaV": comp["VolumetricEfficiency"],
            "coolingCapacity": comp["QCompressor"],
            "inputPower": comp["CompPower"],
            "COP": comp["QCompressor"] / comp["CompPower"],
            "massFlow": comp["massFlow"], "Pe": comp["Pe"], "Pc": comp["Pc"],
        },
        "MR": fMR, "MF": fMF, "T3": fT3, "Tsubcool": converged_Tsubcool, "T1": fT1,
    }


# ------------------------------------------------------ 5c. BRENT'S METHOD (TE)

def solve_TE_brent(T1: float, T2: float, LMTD_req: float, tol: float = 1e-4) -> float:
    """
    Finds TE such that lmtd(T1, T2, TE) == LMTD_req, via Brent's method.
    Returns NaN if no valid bracket is found.
    """
    def f(TE):
        try:
            return lmtd(T1, T2, TE) - LMTD_req
        except RangeError:
            return INFINITY

    ABSOLUTE_MIN_TE = -65.0
    ABSOLUTE_MAX_TE = min(T1, T2) - 0.1

    a = -40.0
    b = ABSOLUTE_MAX_TE

    while f(a) * f(b) > 0 and a > ABSOLUTE_MIN_TE:
        a -= 10

    if f(a) * f(b) > 0:
        return NAN

    fa, fb = f(a), f(b)
    if fa > 0:
        a, b, fa, fb = b, a, fb, fa

    c, fc = a, fa
    mflag = True
    d = 0

    for _ in range(100):
        if fa != fc and fb != fc:
            s = (a * fb * fc / ((fa - fb) * (fa - fc))
                 + b * fa * fc / ((fb - fa) * (fb - fc))
                 + c * fa * fb / ((fc - fa) * (fc - fb)))
        else:
            s = b - fb * (b - a) / (fb - fa)

        needs_bisection = (
            (s < (3 * a + b) / 4 or s > b)
            or (mflag and abs(s - b) >= abs(b - c) / 2)
            or (not mflag and abs(s - b) >= abs(c - d) / 2)
            or (mflag and abs(b - c) < tol)
            or (not mflag and abs(c - d) < tol)
        )
        if needs_bisection:
            s = (a + b) / 2
            mflag = True
        else:
            mflag = False

        fs = f(s)
        d = c
        c, fc = b, fb

        if fa * fs < 0:
            b, fb = s, fs
        else:
            a, fa = s, fs
        if abs(fa) < abs(fb):
            a, b = b, a
            fa, fb = fb, fa
        if abs(b - a) < tol or fb == 0:
            return b

    return b


# ---------------------------------------------- 5d. TE RE-ESTIMATE (NTU-effectiveness)

def calculate_new_TE(result, fan, evap_geom, TF, TR) -> float:
    MR, MF, T2 = result["MR"], result["MF"], result["T2"]
    flow_m3h = fan["fanAirflow_m3h"]
    T1 = (MF * TF + MR * TR) / flow_m3h

    face_area_m2 = (evap_geom["width_mm"] / 1000) * (evap_geom["depth_mm"] / 1000)
    v_ms = (flow_m3h / 3600) / face_area_m2
    alpha = 12.93 * (v_ms ** 0.415) * 1.16279

    NTU = (alpha * evap_geom["evapArea_m2"]) / (flow_m3h * CV)
    effectiveness = 1 - exp(-NTU)

    return T1 if effectiveness < 1e-6 else T1 - (T1 - T2) / effectiveness


def create_failure(TC, error_msg, inner=None) -> dict:
    inner = inner or {}
    return {
        "converged": False, "TC": TC,
        "T2": inner.get("T2", NAN), "PR": inner.get("PR", NAN), "RPM": inner.get("RPM"),
        "TE": NAN, "error": error_msg, "outerIterations": 0, "innerTotalIterations": 0,
    }


# --------------------------------------------- 5e. OUTER TC SECANT LOOP

def solve_thermal_system(config, TE_override=None) -> dict:
    geom, comp_params = config["geom"], config["compParams"]
    condenser_config, refrigerant = config["condenserConfig"], config["refrigerant"]
    subcool, discharge_temp = config["subcool"], config["dischargeTemp"]
    fixed_temps, fan, electrical, evap_geom = config["fixedTemps"], config["fan"], config["electrical"], config.get("evapGeom")
    freezer_position = config.get("freezerPosition", "top")
    # NOTE: solver.js's OWN internal defaults here (TC0=45, tolOuter=0.001,
    # maxIterOuter=50) DIFFER from index.js's defaults (54.4, 0.0005, 100).
    # In practice index.js ALWAYS spreads its own solverOptions as top-level
    # config fields before calling down into this function, so these internal
    # defaults are dead code on the live UI path — they'd only ever be exercised
    # by a caller that invokes solve_thermal_system() directly, bypassing index.js.
    TC0 = config.get("TC0", 45)
    tol_outer = config.get("tolOuter", 0.001)
    max_iter_outer = config.get("maxIterOuter", 50)
    inner_options = config.get("innerOptions", {})

    if evap_geom is None:
        raise ValueError("FATAL: evapGeom is missing from the configuration payload.")

    TE = TE_override if TE_override is not None else config["initialTE"]
    fixed_PR = config.get("inverterPR")
    prop = get_refrigerant_properties(get_refrigerant_index(refrigerant))

    TC = TC0
    total_inner = 0
    prev_F3, prev_TC, prev_inner = None, None, None

    for iteration in range(max_iter_outer):
        if TC < fixed_temps["T0"]:
            TC = fixed_temps["T0"] + 2
        if TC > 90:
            TC = 90

        # Warm-start: from the 2nd outer iteration on, seed solveInner's initial
        # guess with the PREVIOUS outer iteration's converged (T2, PR/RPM) rather
        # than restarting from the fixed defaults every time.
        this_inner_opts = (
            {**inner_options, "initialT2": prev_inner["T2"], "initialPR": prev_inner["PR"], "initialRPM": prev_inner["RPM"]}
            if prev_inner is not None else inner_options
        )

        inner = solve_inner(TC, geom, comp_params, refrigerant, subcool, fixed_temps, fan, electrical,
                             condenser_config, TE, freezer_position, this_inner_opts, fixed_PR, evap_geom)

        if not inner["converged"]:
            err = inner.get("error") or ""
            if "undersized" in err:
                return create_failure(TC, "Compressor undersized.", inner)
            if "oversized" in err:
                return create_failure(TC, "Compressor oversized.", inner)
            if "SLHX" in err:
                return create_failure(TC, err, inner)   # let the SLHX error bubble up verbatim
            return create_failure(TC, "Inner loop failed.", inner)

        total_inner += inner["iterations"]
        prev_inner = {"T2": inner["T2"], "PR": inner["PR"], "RPM": inner["RPM"]}

        QCout = calc_QCout(geom, TC, fixed_temps["T0"], fixed_temps["TF"], fixed_temps["TR"], inner["PR"],
                            {"side": condenser_config["sidePipePitch_mm"], "back": condenser_config["backPipePitch_mm"]},
                            freezer_position, condenser_config["backCondenserEfficiency"])
        comp_outer = evaluate_compressor_safely(TE, TC, get_refrigerant_index(refrigerant), comp_params, inner["RPM"])

        h_cond_exit = prop["liquidEnthalpy"](TC - subcool)
        h_discharge = prop["gasEnthalpy"](discharge_temp + KELVIN_OFFSET, prop["satPressure"](TC + KELVIN_OFFSET))
        # F3: energy balance between condenser heat rejection and discharge-to-liquid
        # enthalpy drop x mass flow — NOT the same residual as f1/f2 inside solveInner;
        # this is the OUTER loop's own convergence criterion on TC.
        F3 = QCout["QCout"] - (comp_outer["massFlow"] * (h_discharge - h_cond_exit) / 3.6)

        if abs(F3) < tol_outer:
            # NOTE: "compressor" here is inner["compressor"] (already field-renamed,
            # SLHX-corrected, evaluated at the CONVERGED TE) — NOT comp_outer, which
            # was only used above to get massFlow for the F3 residual and is discarded.
            return {
                "TC": TC, "T2": inner["T2"], "PR": inner["PR"], "T3": inner["T3"], "RPM": inner["RPM"],
                "TE": TE, "Pe": inner["compressor"]["Pe"], "Pc": inner["compressor"]["Pc"],
                "Tsubcool": inner["Tsubcool"], "converged": True,
                "warnings": [inner["warning"]] if inner.get("warning") else [],
                "outerIterations": iteration + 1, "innerTotalIterations": total_inner,
                "heatLoads": inner["heatLoads"], "compressor": dict(inner["compressor"]),
                "MR": inner["MR"], "MF": inner["MF"], "fan": fan, "electrical": electrical,
            }

        # --- secant update on TC, using a perturbation probe at TC + 0.001 ---
        inner_pert = None
        try:
            pert_opts = {**inner_options, "initialT2": inner["T2"], "initialPR": inner["PR"], "initialRPM": inner["RPM"]}
            inner_pert = solve_inner(TC + 0.001, geom, comp_params, refrigerant, subcool, fixed_temps, fan,
                                      electrical, condenser_config, TE, freezer_position, pert_opts, fixed_PR, evap_geom)
        except Exception:
            inner_pert = None

        if inner_pert is not None and inner_pert.get("converged"):
            pert_RPM = inner_pert["RPM"] if fixed_PR is not None else None
            comp_outer_pert = evaluate_compressor_safely(TE, TC + 0.001, get_refrigerant_index(refrigerant), comp_params, pert_RPM)
            QCout_pert = calc_QCout(geom, TC + 0.001, fixed_temps["T0"], fixed_temps["TF"], fixed_temps["TR"],
                                     inner_pert["PR"],
                                     {"side": condenser_config["sidePipePitch_mm"], "back": condenser_config["backPipePitch_mm"]},
                                     freezer_position, condenser_config["backCondenserEfficiency"])
            h_cond_exit_pert = prop["liquidEnthalpy"](TC + 0.001 - subcool)
            h_discharge_pert = prop["gasEnthalpy"](discharge_temp + KELVIN_OFFSET, prop["satPressure"](TC + 0.001 + KELVIN_OFFSET))
            F3_pert = QCout_pert["QCout"] - (comp_outer_pert["massFlow"] * (h_discharge_pert - h_cond_exit_pert) / 3.6)
            TC -= clamp(-5, 5, F3 / ((F3_pert - F3) / 0.001))
        else:
            if prev_F3 is not None and prev_TC is not None:
                # SOURCE-CODE BUG (see note below): by the time this branch runs on a
                # LATER outer iteration, `TC` at loop-top typically already EQUALS
                # `prev_TC` (nothing else changed it between iterations unless the
                # T0/90 clamp above fired) — so `TC - prev_TC` is ~0, hits the 1e-6
                # safety floor almost every time, and the secant slope becomes
                # unreliable. Reproduced exactly as written, including the floor:
                denom = TC - prev_TC
                if abs(denom) < 1e-6:
                    denom = 1e-6
                TC -= clamp(-5, 5, F3 / ((F3 - prev_F3) / denom))
            else:
                TC += -0.5 if F3 > 0 else 0.5

        prev_F3 = F3
        prev_TC = TC   # NOTE: stores the just-UPDATED TC, not the TC that produced this F3 — see bug note above

    return create_failure(TC, "Outer loop max iterations reached", prev_inner)


# ------------------------------------------------- 5f. OUTER TE LOOP (top-level)

def run_thermal_analysis_dynamic(config) -> dict:
    TE = config["initialTE"]
    prev_TE, prev_error = None, None

    for i in range(15):
        result = solve_thermal_system(config, TE)
        if not result["converged"]:
            return result

        error = calculate_new_TE(result, config["fan"], config["evapGeom"],
                                  config["fixedTemps"]["TF"], config["fixedTemps"]["TR"]) - TE

        if abs(error) < 0.1:
            result["TE"] = TE + error
            return evaluate_safety_checkpoints(result, config, TE + error)

        TE_before_update = TE
        if i > 0 and prev_error is not None:
            TE += clamp(-3.0, 3.0, -error * (TE - prev_TE) / (error - prev_error))
        else:
            TE += 0.5 * error

        # SOURCE-CODE BUG (confirmed by algebra, not a guess): this line is written as
        #   prevTE = TE - (i > 0 ? TE - prevTE : 0.5*error)
        # For i == 0: prevTE_new = (TE_before + 0.5*error) - 0.5*error = TE_before.  Correct.
        # For i  > 0: prevTE_new = TE_new - (TE_new - prevTE_old) = prevTE_old EXACTLY,
        #             regardless of what the secant step just computed — an algebraic
        #             identity that cancels to a no-op. So prevTE is only ever set
        #             meaningfully ONCE (at i=0) and then stays FROZEN at that value
        #             for the rest of the loop, even though prevError updates correctly
        #             every iteration. The secant slope for i>=2 therefore uses a stale
        #             prevTE paired with a fresh prevError — not a true two-point secant.
        #             The loose |error|<0.1 exit tolerance likely masks this most of the
        #             time, but it's a real defect in the intended algorithm.
        prev_TE = TE - (TE - prev_TE if i > 0 else 0.5 * error) if i > 0 else TE_before_update
        prev_error = error

    return {"converged": False, "error": "Thermodynamic imbalance: TE loop failed."}


# ------------------------------------------ 5g. POST-CONVERGENCE SAFETY CHECKS

def evaluate_safety_checkpoints(result, config, TE_conv) -> dict:
    result["warnings"] = result.get("warnings", [])

    if TE_conv > result["T2"]:
        result["warnings"].append("Approach constraint flagged: TE > T2.")
    elif (result["T2"] - TE_conv) > 2:
        result["warnings"].append("Approach constraint flagged: T2 - TE > 2 \u00b0C.")

    peak_config = {
        **config,
        "fixedTemps": {**config["fixedTemps"], "T0": 43},
        "solverOptions": {**config.get("solverOptions", {}),
                           "innerOptions": dict(config.get("solverOptions", {}).get("innerOptions", {}))},
    }
    if config["compParams"].get("isInverter"):
        # SOURCE-CODE BUG: this writes to peak_config["solverOptions"]["innerOptions"]
        # ["initialRPM"/"initialPR"] — a NESTED path. But solve_thermal_system() (5e
        # above) reads `config.get("innerOptions", {})` at the TOP LEVEL of config, not
        # from config["solverOptions"]["innerOptions"]. Since peak_config was built via
        # `**config` first, its top-level `innerOptions` is inherited UNCHANGED from the
        # original config and never receives this override. Net effect: the peak-load
        # re-solve's attempt to seed the compressor at max RPM (or PR=0.95) has NO EFFECT
        # on the actual solve — solveInner still starts from its ordinary default guess.
        # (peak_config["inverterPR"] = 1.0 below IS a top-level field and DOES work
        # correctly, since solve_thermal_system reads config.get("inverterPR") directly.)
        peak_config["solverOptions"]["innerOptions"]["initialRPM"] = config["compParams"]["rpmMax"]
        peak_config["inverterPR"] = 1.0
    else:
        peak_config["solverOptions"]["innerOptions"]["initialPR"] = 0.95   # same dead-write issue

    peak_result = solve_thermal_system(peak_config, TE_conv)

    if not peak_result["converged"]:
        result["warnings"].append("Peak heat load evaluation flagged: System cannot physically balance at 43 \u00b0C.")
    else:
        flow_m3h = config["fan"]["fanAirflow_m3h"]
        face_area_m2 = (config["evapGeom"]["width_mm"] / 1000) * (config["evapGeom"]["depth_mm"] / 1000)
        v_ms = (flow_m3h / 3600) / face_area_m2
        alpha = 12.93 * (v_ms ** 0.415) * 1.16279
        UA = alpha * config["evapGeom"]["evapArea_m2"]

        # T1 recomputed properly here from the CONVERGED result's MF/MR mix — but TE is
        # still stood in for by (T2 - 2), not a freshly re-solved evaporator temperature
        # (same quirk flagged previously, now confirmed verbatim).
        mixed_T1 = (result["MF"] * config["fixedTemps"]["TF"] + result["MR"] * config["fixedTemps"]["TR"]) / flow_m3h
        LMTD_val = lmtd(mixed_T1, result["T2"], result["T2"] - 2)

        if (UA * LMTD_val) < 1.15 * peak_result["heatLoads"]["totalLoad"]:
            result["warnings"].append("Evaporator lacks 15% physical safety margin at 43\u00b0C ambient.")

    return result


# ------------------------------------------------------ 5h. ENERGY CONSUMPTION
# NOTE: exported and called by the UI layer AFTER run_thermo_analysis() returns —
# NOT invoked internally anywhere within the solver pipeline itself.

def energy_consumption(result) -> dict:
    if result.get("converged") is False:
        return NAN

    comp_power = result["compressor"]["inputPower"]   # confirms the Section 5b renaming is the source of this field
    fan_power = result["fan"]["inputPower_W"]
    pwb_on = result["electrical"]["pwbOn_W"]
    pwb_off = result["electrical"]["pwbOff_W"]
    PR = result["PR"]

    def_heater = result["electrical"]["defrostHeater_W"]
    def_on_min = result["electrical"]["defrostOn_min"]
    def_timer_period_h = result["electrical"]["timerPeriod_h"]

    active_cycle_power_w = (comp_power + fan_power + pwb_on) * PR
    off_cycle_power_w = pwb_off * (1 - PR)
    daily_base_energy_kWh = (active_cycle_power_w + off_cycle_power_w) * 24 / 1000

    actual_defrost_interval_h = def_timer_period_h / PR
    defrost_events_per_day = 24 / actual_defrost_interval_h
    daily_defrost_energy_kWh = (def_on_min / 60) * def_heater * defrost_events_per_day / 1000

    total_daily_kWh = daily_base_energy_kWh + daily_defrost_energy_kWh

    return {
        "EnergyConsumption_kWhDay": total_daily_kWh,
        "EnergyConsumption_kWhMonth": total_daily_kWh * 30,
    }
# ==============================================================================
# SECTION 6 — TOP-LEVEL ENTRY POINT  (index.js)  — verbatim-faithful to source
# ==============================================================================

def run_thermo_analysis(config) -> dict:
    errors, warnings = [], []

    if config is None:
        errors.append("No configuration provided.")
        return {"success": False, "errors": errors, "warnings": warnings, "results": None}

    # 1. Core payload validation
    required_keys = ["geom", "compParams", "condenserConfig", "refrigerant", "subcool",
                      "dischargeTemp", "fixedTemps", "fan", "electrical", "evapGeom"]
    for key in required_keys:
        if config.get(key) is None:
            errors.append(f"Missing required config field: {key}")

    ft = config.get("fixedTemps")
    if ft and any(not is_number(ft.get(k)) for k in ("T0", "TF", "TR", "TE")):
        errors.append("fixedTemps must contain numeric T0, TF, TR, TE.")

    if config.get("fan"):
        if not config["fan"].get("fanAirflow_m3h"):
            errors.append("fan.fanAirflow_m3h is required.")
        # mutates config.fan in place with physical-air-property defaults if absent
        config["fan"]["density"] = config["fan"].get("density", PC["air"]["density"])
        config["fan"]["cp"] = config["fan"].get("cp", PC["air"]["cp"])

    if len(errors) > 0:
        return {"success": False, "errors": errors, "warnings": warnings, "results": None}

    # 2. Set default solver thresholds (config.solverOptions overrides these, one level deep)
    solver_options = {
        "TC0": 54.4, "DH": 0.001, "tolOuter": 0.0005, "maxIterOuter": 100,
        "innerOptions": {"dx": 0.001, "tol": 1e-4, "maxIter": 100},
        **config.get("solverOptions", {}),
    }
    if config.get("inverterPR") is not None:
        solver_options["inverterPR"] = config["inverterPR"]

    try:
        # 3. Trigger the dynamic TE evaluation loop.
        #    NOTE: initialTE is forced to config.fixedTemps.TE here — it does NOT
        #    read from any pre-existing config.initialTE the caller may have set.
        #    freezerPosition defaults to 'top' if not supplied.
        result = run_thermal_analysis_dynamic({
            **config,
            "geom": config["geom"], "compParams": config["compParams"],
            "condenserConfig": config["condenserConfig"], "refrigerant": config["refrigerant"],
            "subcool": config["subcool"], "dischargeTemp": config["dischargeTemp"],
            "fixedTemps": config["fixedTemps"], "fan": config["fan"], "electrical": config["electrical"],
            "freezerPosition": config.get("freezerPosition", "top"),
            "initialTE": config["fixedTemps"]["TE"],
            **solver_options,
        })

        if not result["converged"]:
            errors.append(result.get("error", "Thermal solver did not converge."))
            return {"success": False, "errors": errors, "warnings": warnings, "results": None}

        # 4. Structure the physical output payload.
        # SOURCE-CODE NOTE: this reads result.compressor.coolingCapacity / .inputPower / .COP
        # directly (not QCompressor/CompPower). solver.js itself was NOT included in the
        # files reviewed for this pseudocode pass, so the exact point where solver.js
        # renames/derives coolingCapacity, inputPower, and COP onto the compressor object
        # is unverified here — Section 5's solve_thermal_system() (written from an earlier,
        # unconfirmed reading of solver.js) still returns raw QCompressor/CompPower field
        # names and should be treated as a placeholder for that renaming step until
        # solver.js itself can be reviewed directly.
        output = {
            "TC": result["TC"], "Tsubcool": result["Tsubcool"], "T2": result["T2"], "PR": result["PR"],
            "TE": result["TE"],
            "heatLoads": {
                "QF": result["heatLoads"]["QF"], "QR": result["heatLoads"]["QR"],
                "QEV": result["heatLoads"]["QEV"], "fanLoad": result["heatLoads"]["fanLoad"],
                "defrostLoad": result["heatLoads"]["defrostLoad"], "totalLoad": result["heatLoads"]["totalLoad"],
            },
            "compressor": {
                "massFlow": result["compressor"]["massFlow"],
                "coolingCapacity": result["compressor"]["coolingCapacity"],
                "inputPower": result["compressor"]["inputPower"],
                "etaV": result["compressor"]["etaV"],
                "Pe": result["compressor"]["Pe"], "Pc": result["compressor"]["Pc"],
                "COP": result["compressor"]["COP"],
            },
            "fan": result["fan"], "electrical": result["electrical"],
            "iterations": {"outer": result["outerIterations"], "innerTotal": result["innerTotalIterations"]},
            "MR": result["MR"], "MF": result["MF"], "T3": result["T3"],
        }

        if result.get("RPM") is not None:
            output["RPM"] = result["RPM"]
        if result.get("warnings") and len(result["warnings"]) > 0:
            warnings.extend(result["warnings"])

        if result["PR"] >= 1:
            warnings.append("Compressor running ratio reached 100% – system may be undersized.")
        elif result["PR"] <= 0.1:
            warnings.append("Compressor running ratio very low – check heat load inputs.")

        return {"success": True, "errors": [], "warnings": warnings, "results": output}

    except Exception as e:
        errors.append(f"Unexpected error in thermal analysis: {e}")
        return {"success": False, "errors": errors, "warnings": warnings, "results": None}


def build_default_config(overrides=None) -> dict:
    """
    Returns a complete, ready-to-run config object for the SJ-54H baseline
    (top-freezer, constant-speed compressor), deep-merged with any caller overrides.
    """
    overrides = overrides or {}
    comp_raw = SJ54H_COMPONENTS["compressor"]
    cond_raw = SJ54H_COMPONENTS["condenser"]
    fan = SJ54H_COMPONENTS["fan"]
    electrical = SJ54H_COMPONENTS["electrical"]

    base = {
        "geom": to_thermal_format(DEFAULT_CABINET),
        "compParams": {
            "name": comp_raw["name"],
            "cylinderVolumeCm3": comp_raw["Vc"],
            "speedRpm": comp_raw["rpm"],
            "rpm0": comp_raw["rpm0"],
            "T_suction": comp_raw["T_suction"],
            "wCoeffs": [comp_raw["powerCoeffs"]["AW"], comp_raw["powerCoeffs"]["BW"],
                        comp_raw["powerCoeffs"]["CW"], comp_raw["powerCoeffs"]["DW"],
                        comp_raw["powerCoeffs"]["EW"]],
            "etaCoeffs": [comp_raw["volEffCoeffs"]["A"], comp_raw["volEffCoeffs"]["B"],
                          comp_raw["volEffCoeffs"]["C"]],
        },
        "condenserConfig": {
            "sidePipePitch_mm": cond_raw["sidePipePitch_mm"],
            "backPipePitch_mm": cond_raw["backPipePitch_mm"],
            "backCondenserEfficiency": cond_raw["backCondenserEfficiency"],
            "backCondenser": "Yes",
        },
        "refrigerant": "R-600a",
        "subcool": SJ54H_COMPONENTS["subcool_K"],
        "dischargeTemp": SJ54H_COMPONENTS["dischargeTemp_C"],
        "fixedTemps": {"T0": 30, "TF": -18, "TR": 3, "TE": -23.3},
        "fan": {
            "fanAirflow_m3h": fan["totalAirflow_m3h"],
            "totalAirflow": fan["totalAirflow_m3h"],
            "inputPower_W": fan["inputPower_W"],
        },
        "electrical": dict(electrical),
        "freezerPosition": "top",
        "initialTE": -25.27,
        "solverOptions": {
            "TC0": 54.4, "DH": 0.001, "tolOuter": 0.0005, "maxIterOuter": 100,
            "innerOptions": {"dx": 0.001, "tol": 1e-4, "maxIter": 100, "initialT2": -21.25, "initialPR": 0.59},
        },
    }

    return deep_merge(base, overrides)


def deep_merge(target: dict, source: dict) -> dict:
    """
    Recursive merge: for each key in `source`, if the value is a plain object
    (not an array), recurse into it; otherwise overwrite outright. Arrays are
    always overwritten wholesale, never merged element-by-element.
    """
    out = dict(target)
    for key, value in source.items():
        if isinstance(value, dict):
            out[key] = deep_merge(out.get(key, {}) or {}, value)
        else:
            out[key] = value
    return out


# ==============================================================================
# END-TO-END CALL CHAIN SUMMARY (for orientation)
# ==============================================================================
"""
run_thermo_analysis(config)                                 [index.js — VERIFIED]
  -> run_thermal_analysis_dynamic(config)                    [solver.js — VERIFIED]   outer TE loop, <=15 iter
       -> solve_thermal_system(config, TE)                   [solver.js — VERIFIED]   outer TC secant loop
            -> solve_inner(TC, ..., TE)                      [solver.js — VERIFIED]   2-D Newton for (T2, PR-or-RPM)
                 -> newton2(F, x0, ...)                       [solver.js — VERIFIED]   generic Newton + line search
                      -> F(vars) calls, per Newton iteration:
                           -> calc_heat_loads(...)             [heatLoad.js — VERIFIED]
                           -> solve_TE_brent(T1, T2, LMTD_req)  [solver.js — VERIFIED]  Brent root find
                                -> lmtd(T1, T2, TE)             [evaporator.js — VERIFIED]
                           -> evaluate_compressor_safely(...)   [CompressorPerformance.js — VERIFIED]
                                -> compressor_power(...)  OR  inverter_compressor_performance(...)
            -> calc_QCout(...)                                [condenser.js — VERIFIED]
            -> evaluate_compressor_safely(...)                [CompressorPerformance.js — VERIFIED]
       -> calculate_new_TE(...)                                [solver.js — VERIFIED]
       -> evaluate_safety_checkpoints(result, config, TE)      [solver.js — VERIFIED]  (only once TE loop converges)
            -> solve_thermal_system(peak_config, TE)  (re-run at T0=43C, PR/RPM at max — seeding is a dead write, see bug notes)
            -> lmtd(...)                                       [evaporator.js — VERIFIED]
  -> [UI layer, outside run_thermo_analysis] energy_consumption(result)     [solver.js — VERIFIED]

Offline / setup-time only (not part of the chain above):
  compute_compressor_coefficients(...)  [CompressorPerformance.js — VERIFIED]  OLS, constant-speed
  fit_inverter_coefficients(...)        [CompressorPerformance.js — VERIFIED]  Ridge + CV, inverter
    -> select_inverter_model(...) -> build_global_model(...) / fit_piecewise_inverter(...)
  build_default_config(...) / deep_merge(...)               [index.js — VERIFIED]     bootstrapping/UI defaults
  to_thermal_format(...) / to_volume_format(...) / upgrade_config(...)  [geometry.js — VERIFIED]

------------------------------------------------------------------------------
VERIFICATION STATUS (as of this revision): ALL modules in scope now VERIFIED
against actual source, verbatim math — index.js, heatLoad.js, condenser.js,
CompressorPerformance.js, constants.js, defaultComponents.js, evaporator.js,
solver.js, geometry.js. (validateHeatLoad.js remains intentionally OUT OF SCOPE
per your earlier instruction — it's dead code, never called in the live path.)

------------------------------------------------------------------------------
CONFIRMED BUGS / DEAD CODE FOUND WHILE TRANSCRIBING (source-code facts, not
stylistic opinions — each is reproduced faithfully in this file with an inline
comment at the exact location):

1. newton2()'s debug flag is hard-wired on. solve_inner() calls
   `newton2(..., inner_opts.get("debug") or True)` — in JS, `x || true` is
   ALWAYS true regardless of `x`. Debug console logging in newton2 cannot
   actually be turned off from solve_inner's caller. Cosmetic (console noise),
   not a math bug.

2. solve_thermal_system()'s secant fallback stores `prevTC` AFTER updating
   `TC` in the same iteration, not before. On the next iteration that hits
   this same fallback branch, `TC - prevTC` is therefore ~0 (unless the T0/90
   bound clamp intervened), tripping the 1e-6 floor almost every time and
   making the secant slope estimate unreliable. Only affects the rare path
   where the TC+0.001 perturbation probe itself fails to converge.

3. run_thermal_analysis_dynamic()'s `prevTE` update is an algebraic no-op for
   every iteration after the first: `prevTE = TE - (TE - prevTE)` simplifies
   to `prevTE` unchanged, regardless of what the secant step just computed.
   `prevTE` is therefore only ever meaningfully set once (i=0) and then stays
   frozen while `prevError` keeps updating normally — so the outer TE loop's
   secant slope pairs a fresh prevError with a stale prevTE from i>=2 onward.
   The loose |error|<0.1 exit tolerance likely masks this in practice, but
   it's a real, confirmable defect in the intended two-point secant method.

4. evaluate_safety_checkpoints()'s peak-load (43C) re-solve writes its
   compressor-seeding hints to `peak_config.solverOptions.innerOptions.
   initialRPM/initialPR` — a NESTED path — but solve_thermal_system() reads
   `config.innerOptions` at the TOP LEVEL. Since peak_config inherits its
   top-level innerOptions unchanged via `**config`, this seeding has NO
   EFFECT: the peak check's Newton solve always starts from the ordinary
   default guess, not from "max RPM" / "PR=0.95" as clearly intended. (The
   `inverterPR = 1.0` override on the same peak_config DOES work correctly,
   since that field is read directly at the top level.)

5. `build_global_model()` (CompressorPerformance.js) accepts a `target_rmse`
   parameter that is never referenced anywhere in its body — the grid search
   always runs its full sweep regardless of any target.

6. `to_thermal_format(DEFAULT_CABINET)` — as called by `build_default_config()`
   — would receive a geometry object with no `Hf`/`Hr` keys, since
   DEFAULT_CABINET itself never defines compartment heights. Whether something
   upstream in the UI always augments the cabinet object with Hf/Hr before this
   runs, or this is a live gap, isn't something these five files alone confirm.

7. `calcHeatLoads`'s refrigerator-sides conduction term uses the SAME `ARleft`
   area for both the "left" and "right" wall calculations — no `ARright` is
   ever computed (heatLoad.js, confirmed in the previous revision).

8. compressor_power() / compute_compressor_coefficients() (CompressorPerformance.js)
   evaluate both liquid and gas reference enthalpies at a FIXED 30C basis
   regardless of TC — self-consistent between fitting and prediction, but not
   a real-cycle enthalpy calculation; solveInner's SLHX block is what corrects
   it for actual subcooling (now fully shown in Section 5b).
"""



# ==============================================================================
# ==============================================================================
# PART II — UI LAYER  (compressorManager.js, settings.js, main.js, thermoUI.js,
#                       schematic.js, graphUI.js)
# ------------------------------------------------------------------------------
# Everything below is DOM-bound application code, not pure numerical logic like
# Part I. A `dom` pseudo-namespace stands in for direct DOM access throughout:
#   dom.value(id)          -> parseFloat(element.value) || fallback
#   dom.text(id, val)      -> element.textContent = val
#   dom.set(id, val)       -> element.value = val
#   dom.on(id, event, fn)  -> element.addEventListener(event, fn)
#   dom.checked(id)        -> element.checked
# This is a notational convenience only — the real source calls
# `document.getElementById(...)` directly at each site, often with its own
# inline `?? fallback` per call. Where a fallback differs from the norm, it's
# called out explicitly.
# ==============================================================================


# ==============================================================================
# SECTION 7 — COMPRESSOR CATALOG MANAGER  (compressorManager.js)
# ==============================================================================

# DEFAULT_COMPRESSORS[0]: EGX80CLC (constant-speed) — same coefficients as
# SJ54H_COMPONENTS.compressor (Section 0b), reshaped into catalog-entry form,
# PLUS a `dataPoints` array not present in Section 0b: 9 raw test points with
# Q converted from kcal/h to Watts via *1.16279 inline at literal-definition time.
# DEFAULT_COMPRESSORS[1]: DZ90A1X (inverter) — dataPoints are the IDENTICAL 35
# points already shown in SJ_PV73K_COMPONENTS.compressor.dataPoints (Section 0b);
# not reproduced a second time here.

DEFAULT_COMPRESSORS = [
    {
        "id": "EGX80CLC", "name": "EGX80CLC 100V 50Hz", "model": "EGX80CLC",
        "voltage": 100, "frequency": 50,
        "cylinderVolumeCm3": SJ54H_COMPONENTS["compressor"]["Vc"],   # NOTE: reads .Vc — Section 0b's raw
        "speedRpm": SJ54H_COMPONENTS["compressor"]["rpm"],           # key names, not the renamed compParams fields
        "wCoeffs": [SJ54H_COMPONENTS["compressor"]["powerCoeffs"][k] for k in ("AW", "BW", "CW", "DW", "EW")],
        "etaCoeffs": [SJ54H_COMPONENTS["compressor"]["volEffCoeffs"][k] for k in ("A", "B", "C")],
        "dataPoints": [
            {"TE": -34.4, "TC": 37.8, "Q": 70.554507 * 1.16279, "W": 49.7},
            {"TE": -34.4, "TC": 46.1, "Q": 67.112824 * 1.16279, "W": 51.3},
            {"TE": -34.4, "TC": 54.4, "Q": 61.950299 * 1.16279, "W": 72.0},
            {"TE": -23.3, "TC": 37.8, "Q": 129.063122 * 1.16279, "W": 67.6},
            {"TE": -23.3, "TC": 46.1, "Q": 126.481860 * 1.16279, "W": 72.4},
            {"TE": -23.3, "TC": 54.4, "Q": 121.319335 * 1.16279, "W": 141.0},
            {"TE": -12.2, "TC": 37.8, "Q": 215.105204 * 1.16279, "W": 86.2},
            {"TE": -12.2, "TC": 46.1, "Q": 210.803100 * 1.16279, "W": 93.5},
            {"TE": -12.2, "TC": 54.4, "Q": 203.919733 * 1.16279, "W": 237.0},
        ],
    },
    {
        "id": "DZ90A1X", "name": "DZ90A1X Inverter", "model": "DZ90A1X",
        "voltage": 220, "frequency": 50, "isInverter": True,
        "normalizeRPM": 4320, "centerTE": -25.0, "centerTC": 45.0,
        "compressorModel": None,   # generated on first use via fit_inverter_coefficients
        "refrigerantIndex": 2,
        "dataPoints": SJ_PV73K_COMPONENTS["compressor"]["dataPoints"],   # identical 35-point set, see Section 0b
    },
]

# At module load: derive rpmMin/rpmMax for every inverter entry from its own dataPoints
for comp in DEFAULT_COMPRESSORS:
    if comp.get("isInverter") and comp.get("dataPoints"):
        comp["rpmMin"] = min(d["RPM"] for d in comp["dataPoints"])
        comp["rpmMax"] = max(d["RPM"] for d in comp["dataPoints"])

# Module-level mutable state (persisted to localStorage under 'compressorList' /
# 'selectedCompressorId')
compressor_list = []
selected_compressor_id = "EGX80CLC"


def ensure_arrays(comp: dict) -> dict:
    """
    Schema-upgrade helper: coerces wCoeffs/etaCoeffs from legacy keyed-object
    form (e.g. {AW:.., BW:..}) into flat ordered arrays, and (re)derives
    rpmMin/rpmMax for any inverter entry from its stored dataPoints.
    """
    def to_array(val, keys):
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            return [val[k] for k in keys if k in val]
        return None

    cleaned = {
        **comp,
        "wCoeffs": to_array(comp.get("wCoeffs"), ["AW", "BW", "CW", "DW", "EW"]),
        "etaCoeffs": to_array(comp.get("etaCoeffs"), ["A", "B", "C"]),
    }
    if cleaned.get("isInverter") and cleaned.get("dataPoints"):
        cleaned["rpmMin"] = min(d["RPM"] for d in cleaned["dataPoints"])
        cleaned["rpmMax"] = max(d["RPM"] for d in cleaned["dataPoints"])
    return cleaned


def load_compressors():
    """
    Hydrates compressor_list from localStorage['compressorList']. If present,
    repairs/upgrades every entry via ensure_arrays(); the built-in EGX80CLC entry
    gets EXTRA special-case handling: it's re-merged against
    DEFAULT_COMPRESSORS[0] so that any fields missing from the saved copy (e.g.
    if the schema grew new fields since the user's data was saved) fall back to
    the hard-coded default rather than staying undefined. No other compressor ID
    gets this defaults-backfill treatment — only EGX80CLC by name.
    Writes the (possibly-repaired) list straight back to localStorage afterward.
    If nothing is saved yet, seeds compressor_list from DEFAULT_COMPRESSORS verbatim.
    """
    global compressor_list, selected_compressor_id
    saved = local_storage.get_item("compressorList")
    if saved:
        compressor_list = json_parse(saved)

        def repair(comp):
            if comp.get("id") == "EGX80CLC":
                arrays = ensure_arrays(comp)
                return {
                    **DEFAULT_COMPRESSORS[0], **comp,
                    "cylinderVolumeCm3": comp.get("cylinderVolumeCm3", DEFAULT_COMPRESSORS[0]["cylinderVolumeCm3"]),
                    "speedRpm": comp.get("speedRpm", DEFAULT_COMPRESSORS[0]["speedRpm"]),
                    "wCoeffs": arrays["wCoeffs"] or DEFAULT_COMPRESSORS[0]["wCoeffs"],
                    "etaCoeffs": arrays["etaCoeffs"] or DEFAULT_COMPRESSORS[0]["etaCoeffs"],
                }
            return ensure_arrays(comp)

        compressor_list = [repair(c) for c in compressor_list]
        local_storage.set_item("compressorList", json_stringify(compressor_list))
    else:
        compressor_list = list(DEFAULT_COMPRESSORS)

    selected_compressor_id = local_storage.get_item("selectedCompressorId") or "EGX80CLC"


def save_compressors():
    local_storage.set_item("compressorList", json_stringify(compressor_list))
    local_storage.set_item("selectedCompressorId", selected_compressor_id)


def get_compressor_list() -> list:
    return compressor_list


def get_current_compressor() -> dict:
    return next((c for c in compressor_list if c["id"] == selected_compressor_id), compressor_list[0])


def set_selected_compressor(id: str):
    global selected_compressor_id
    selected_compressor_id = id
    save_compressors()


def add_compressor(comp: dict):
    compressor_list.append(ensure_arrays(comp))
    save_compressors()


def delete_compressor(id: str):
    global compressor_list, selected_compressor_id
    compressor_list = [c for c in compressor_list if c["id"] != id]
    if selected_compressor_id == id:
        selected_compressor_id = compressor_list[0]["id"] if compressor_list else ""
    save_compressors()


# Module-load side effect: hydrate immediately on import, before any UI code runs.
load_compressors()


# ==============================================================================
# SECTION 8 — GLOBAL SETTINGS STORE  (settings.js)
# ==============================================================================

SETTINGS_DEFAULTS = {
    "mm3ToL": 1e-6, "lToCuft": 0.0353147,
    "displayPrecisionL": 2, "displayPrecisionCuft": 3,
    "canvasWidth": 600, "canvasHeight": 800,
    "autoCalculate": False, "showDirtyOverlay": True,
    "evaporator": {
        "width_mm": 460, "height_mm": 150, "depth_mm": 60, "rows": 7, "layers": 2,
        "tubeOD_mm": 8, "finPitch_mm": 4, "finHeight_mm": 150, "finLength_mm": 460,
        "numFins": 32, "sidePlateNo": 0,
    },
    "fanParam": {"tipDiam_mm": 110, "fanRPM": 2200},
}

SETTINGS_STORAGE_KEY = "refrigerator-calc-settings"


def settings_deep_merge(target: dict, source: dict) -> dict:
    """
    NOTE: this is a SEPARATE, independently-written re-implementation of the
    same deep-merge algorithm as index.js's deep_merge() (Section 6) — not a
    shared utility. Behaviorally identical (recurse into plain-object values,
    overwrite everything else, arrays always overwritten wholesale) but
    maintained as duplicated code in two different files.
    """
    result = dict(target)
    for key, value in source.items():
        if isinstance(value, dict):
            result[key] = settings_deep_merge(target.get(key, {}) or {}, value)
        else:
            result[key] = value
    return result


def load_settings() -> dict:
    """Reads + deep-merges saved settings over SETTINGS_DEFAULTS; falls back to
    a plain copy of the defaults on any parse error or if nothing is saved."""
    try:
        raw = local_storage.get_item(SETTINGS_STORAGE_KEY)
        if raw:
            parsed = json_parse(raw)
            return settings_deep_merge(SETTINGS_DEFAULTS, parsed)
    except Exception:
        pass   # corrupt localStorage entry: silently fall through to defaults
    return dict(SETTINGS_DEFAULTS)


def save_to_storage(s: dict):
    local_storage.set_item(SETTINGS_STORAGE_KEY, json_stringify(s))


# Singleton, created ONCE at module import time — every other module imports
# this same `settings` object by reference and mutates it in place.
settings = load_settings()


def update_settings(new_settings: dict):
    """
    SOURCE-CODE NOTE: unlike load_settings() (deep merge), this uses a SHALLOW
    merge (Object.assign) — any nested object passed in `new_settings` (e.g. a
    full replacement `fanParam` dict) REPLACES the existing nested object
    wholesale rather than merging key-by-key into it. The source code's own
    comment states this is "acceptable because we only ever replace the whole
    fanParam/evaporator from the UI, never partial updates" — i.e. it's a
    documented assumption about how callers behave, not enforced by the
    function itself. A caller that passed a partial nested update would
    silently lose the untouched keys.
    """
    settings.update(new_settings)   # shallow: Object.assign(settings, newSettings)
    save_to_storage(settings)
    dispatch_event("settings-changed", detail=settings)


def reset_settings():
    settings.clear()
    settings.update(SETTINGS_DEFAULTS)
    save_to_storage(settings)
    dispatch_event("settings-changed", detail=settings)


def get_settings() -> dict:
    return dict(settings)   # shallow copy


# ==============================================================================
# SECTION 9 — VOLUME-TAB UI ORCHESTRATOR  (main.js)
# ==============================================================================

# ------------------------------------------------------- 9a. Module state
current_config = None
last_calc_state = None   # caches {config, volumes, thermal} for export/comparison
config_slot_a = json_parse(local_storage.get_item("refrig_slotA")) or None
config_slot_b = json_parse(local_storage.get_item("refrig_slotB")) or None
dirty_schematic = False
current_geometry = dict(DEFAULT_CABINET)
compartments_data = []   # list of {type, top,left,right,rear,door, height, ratio, shelfCount}

# On load: updateSettings(settings) is called once (re-persists + re-broadcasts
# the just-loaded settings), fillGeometryDefaults() populates the geometry form
# fields from DEFAULT_CABINET, and initCompartments() builds the initial
# 2-compartment layout.


# --------------------------------------------- 9b. Compartment reactive state

def init_compartments():
    """(Re)builds compartments_data from the 'numCompartments' input (1 or 2),
    with a fixed 60mm default wall set and a 40/60 height split for 2 compartments."""
    global compartments_data
    count = int(dom.value("numCompartments")) or 1
    default_walls = {"top": 60, "left": 60, "right": 60, "rear": 60, "door": 60}
    compartments_data = [
        {"type": "freezer" if i == 0 else "fresh", **default_walls,
         "height": 0, "ratio": 0.4 if i == 0 else 0.6, "shelfCount": 0}
        for i in range(count)
    ]
    sync_constraints()
    build_compartment_ui()
    update_r_shower_visibility()


def sync_constraints():
    """
    Rebalances compartment heights/ratios so they exactly fill the available
    internal height (external H minus top/bottom insulation minus dividers).
    Single-compartment case: 100% to that one compartment.
    Two-compartment case: preserves whichever compartment(s) already have a
    manually-set nonzero height, redistributing only what's needed; if BOTH
    are zero (fresh init), splits by the stored ratio (clamped to [0.1, 0.9]).
    """
    count = len(compartments_data)
    H = dom.value("geom-H") or 1680
    divider_thick = (dom.value("divHoriz") or 60) if count > 1 else 0
    total_insul_top = compartments_data[0]["top"]
    total_insul_bottom = dom.value("geom-bottom3") or 40

    internal_h = max(0, H - total_insul_top - total_insul_bottom - (count - 1) * divider_thick)

    if internal_h == 0:
        compartments_data[0]["height"] = 0
        compartments_data[0]["ratio"] = 0.5
        if count > 1:
            compartments_data[1]["height"] = 0
            compartments_data[1]["ratio"] = 0.5
        return

    if count == 1:
        compartments_data[0]["height"] = internal_h
        compartments_data[0]["ratio"] = 1.0
        return

    if count == 2:
        compartments_data[1]["top"] = divider_thick   # the shared partition IS compartment[1]'s top wall

    h0, h1 = compartments_data[0]["height"], compartments_data[1]["height"]
    if h0 == 0 and h1 == 0:
        r0 = clamp(0.1, 0.9, compartments_data[0]["ratio"])
        h0, h1 = internal_h * r0, internal_h * (1 - r0)
    elif h0 != 0 and h1 != 0:
        if abs((h0 + h1) - internal_h) > 0.01:
            h0 = clamp(0.1 * internal_h, 0.9 * internal_h, h0)
            h1 = internal_h - h0
    elif h0 != 0:
        h0 = clamp(0.1 * internal_h, 0.9 * internal_h, h0)
        h1 = internal_h - h0
    elif h1 != 0:
        h1 = clamp(0.1 * internal_h, 0.9 * internal_h, h1)
        h0 = internal_h - h1

    compartments_data[0]["height"], compartments_data[1]["height"] = h0, h1
    compartments_data[0]["ratio"] = h0 / internal_h
    compartments_data[1]["ratio"] = h1 / internal_h
    clamp_all_shelf_counts()


def on_comp_field_change(comp_idx: int, field: str, value):
    """Live-input handler for a single compartment's type/height/ratio field."""
    if field == "type":
        compartments_data[comp_idx]["type"] = value
        if len(compartments_data) > 1:
            other_idx = 1 - comp_idx
            compartments_data[other_idx]["type"] = "fresh" if value == "freezer" else "freezer"
            update_r_shower_visibility()
        sync_display()
        return

    if is_nan(value):
        return
    compartments_data[comp_idx][field] = value

    if field in ("height", "ratio"):
        count = len(compartments_data)
        H = dom.value("geom-H") or 1680
        divider_thick = (dom.value("divHoriz") or 60) if count > 1 else 0
        top_insul = compartments_data[0]["top"]
        bottom_insul = dom.value("geom-bottom3") or 40
        internal_h = H - top_insul - bottom_insul - (count - 1) * divider_thick

        if count == 1:
            compartments_data[0]["height"] = internal_h
            compartments_data[0]["ratio"] = 1.0
        else:
            other_idx = 1 - comp_idx
            if field == "height":
                clamped = clamp(0.1 * internal_h, 0.9 * internal_h, value)
                compartments_data[comp_idx]["height"] = clamped
                compartments_data[other_idx]["height"] = internal_h - clamped
                compartments_data[0]["ratio"] = compartments_data[0]["height"] / internal_h
                compartments_data[1]["ratio"] = 1.0 - compartments_data[0]["ratio"]
            else:   # ratio, given as a 0-100 percent
                percent = clamp(10, 100 if count == 1 else 90, value)
                clamped = percent / 100
                compartments_data[comp_idx]["ratio"] = clamped
                compartments_data[comp_idx]["height"] = internal_h * clamped
                compartments_data[other_idx]["ratio"] = 1.0 - clamped
                compartments_data[other_idx]["height"] = internal_h - compartments_data[comp_idx]["height"]

    sync_display()


def sync_display():
    """Pushes compartments_data back out to its mirrored DOM input fields."""
    for i, d in enumerate(compartments_data):
        dom.set(f"comp-{i}-height", round(d["height"], 1))
        dom.set(f"comp-{i}-ratio", 100 if len(compartments_data) == 1 else round(d["ratio"] * 100))
        dom.set(f"comp-{i}-type", d["type"])
        dom.set(f"comp-{i}-top", round(d["top"], 1))
        dom.set(f"comp-{i}-shelfCount", d["shelfCount"])


def build_compartment_ui():
    """Regenerates the compartment <fieldset> HTML blocks and re-attaches their
    per-field event listeners (type/height/ratio/wall-thickness/shelfCount).
    Wall-thickness `input` events call markDirty(); their `change` events
    re-run sync_constraints()+sync_display(). Only compartment 0 (or the sole
    compartment) gets a visible 'Top' thickness field — the second compartment's
    top is always the shared divider, driven by sync_constraints() instead."""
    ...   # pure DOM templating — no additional computational logic beyond the above


# ------------------------------------------- 9c. Shelf / usable-height helpers

def get_comp_top_world_y(i: int) -> float:
    """World Y (mm, from cabinet top) of the top edge of compartment i,
    accumulating prior compartments' heights plus one divider thickness each."""
    y = compartments_data[0]["top"]
    for j in range(i):
        y += compartments_data[j]["height"]
        if j < len(compartments_data) - 1:
            y += dom.value("divHoriz") or 20
    return y


def get_usable_height_for_compartment(i: int) -> float:
    """Usable shelf height for compartment i — for the LAST compartment only,
    clips against the raised-floor line (H - Hb - bottom1) since the
    compressor step intrudes into the bottom compartment's usable volume."""
    H = dom.value("geom-H") or 0
    Hb = dom.value("geom-Hb") or 0
    bottom1 = dom.value("geom-bottom1") or 0
    floor_raised_y = H - Hb - bottom1
    comp_top_y = get_comp_top_world_y(i)
    full_height = compartments_data[i]["height"]
    if i == len(compartments_data) - 1:
        return clamp(0, full_height, floor_raised_y - comp_top_y)
    return full_height


def get_max_shelves_for_compartment(i: int) -> int:
    """Max shelves fitting with a fixed 150mm minimum spacing, minus one
    (so the topmost/bottommost gaps aren't crushed to zero)."""
    usable = get_usable_height_for_compartment(i)
    return max(0, int(usable // 150) - 1)


def clamp_all_shelf_counts() -> bool:
    changed = False
    for i in range(len(compartments_data)):
        max_shelves = get_max_shelves_for_compartment(i)
        if compartments_data[i]["shelfCount"] > max_shelves:
            compartments_data[i]["shelfCount"] = max_shelves
            changed = True
    return changed


def update_r_shower_visibility():
    has_fresh = any(c["type"] == "fresh" for c in compartments_data)
    dom.show("rshowerGroup", has_fresh)


# ------------------------------------------- 9d. Geometry scraping

def fill_geometry_defaults():
    """Populates every geometry input field from DEFAULT_CABINET plus a set of
    UI-only defaults not present in DEFAULT_CABINET itself (bottom1/2/3=40,
    rail/dike dimensions)."""
    d = DEFAULT_CABINET
    dom.set("geom-H", d["H"]); dom.set("geom-W", d["W"]); dom.set("geom-D", d["D"])
    dom.set("geom-Hb", d["Hb"]); dom.set("geom-Db1", d["Db1"]); dom.set("geom-Db2", d["Db2"])
    dom.set("geom-packingPos", d["packingPos"]); dom.set("geom-doorGap", d["doorGap"])
    dom.set("geom-bottom1", 40); dom.set("geom-bottom2", 40); dom.set("geom-bottom3", 40)
    dom.set("geom-railHeight", 20); dom.set("geom-railWidth", 10); dom.set("geom-railDepthPct", 50)
    dom.set("geom-doorDikeHeight", 50); dom.set("geom-doorDikeBaseWidth", 30); dom.set("geom-doorDikeTopWidth", 15)


def read_geometry_from_panel() -> dict:
    """
    Scrapes ALL geometry inputs + compartments_data into the unified geometry
    object consumed by to_thermal_format()/to_volume_format() (Section 0c) and
    by the precise-volume traversal engine (traversal.js — not reviewed).
    Builds per-compartment wall thickness dicts keyed by compartment TYPE
    (freezer/refrigerator), not by position: whichever compartment is NOT the
    topmost gets `dividerThick` assigned as its facing wall (top for the lower
    one, bottom for the upper one when it's not the bottom-most), and only the
    true outermost top/bottom compartments get their user-entered thickness.
    """
    count = len(compartments_data)
    divider_thick = (dom.value("divHoriz") or 60) if count > 1 else 0
    bottom_idx = count - 1
    bottom1 = dom.value("geom-bottom1", default=40)
    bottom2 = dom.value("geom-bottom2", default=40)
    bottom3 = dom.value("geom-bottom3", default=40)

    walls = {
        "freezer": {"top": 0, "bottom": 0, "left": 0, "right": 0, "door": 0, "rear": 0,
                    "bottom1": bottom1, "bottom2": bottom2, "bottom3": bottom3},
        "refrigerator": {"top": 0, "bottom1": bottom1, "bottom2": bottom2, "bottom3": bottom3,
                          "left": 0, "right": 0, "door": 0, "rear": 0},
    }

    for i, comp in enumerate(compartments_data):
        is_topmost, is_bottommost = (i == 0), (i == bottom_idx)
        wall_key = "refrigerator" if comp["type"] == "fresh" else "freezer"
        w = walls[wall_key]
        w["top"] = comp["top"] if is_topmost else divider_thick
        if wall_key == "freezer":
            w["bottom"] = bottom1 if is_bottommost else divider_thick
        else:
            w["bottom1"] = bottom1 if is_bottommost else divider_thick
        w["left"], w["right"], w["door"], w["rear"] = comp["left"], comp["right"], comp["door"], comp["rear"]

    return {
        "H": dom.value("geom-H", default=DEFAULT_CABINET["H"]),
        "W": dom.value("geom-W", default=DEFAULT_CABINET["W"]),
        "D": dom.value("geom-D", default=DEFAULT_CABINET["D"]),
        "Hb": dom.value("geom-Hb", default=DEFAULT_CABINET["Hb"]),
        "Db1": dom.value("geom-Db1", default=DEFAULT_CABINET["Db1"]),
        "Db2": dom.value("geom-Db2", default=DEFAULT_CABINET["Db2"]),
        "doorGap": dom.value("geom-doorGap", default=DEFAULT_CABINET["doorGap"]),
        "packingPos": dom.value("geom-packingPos", default=DEFAULT_CABINET["packingPos"]),
        "airGap": 0,
        "Hf": next((c["height"] for c in compartments_data if c["type"] == "freezer"), 0),
        "Hr": next((c["height"] for c in compartments_data if c["type"] == "fresh"), 0),
        "walls": walls,
        "dividerThickness": divider_thick,
        "dividerHasPU": dom.checked("divHasPU"),
        "dividerPUPct": dom.value("divPUPct", default=85),
        "dividerInsulationType": dom.value_str("DividerInsulationType", default="PU"),
        "special": {
            "railHeight": dom.value("geom-railHeight", default=20),
            "railWidth": dom.value("geom-railWidth", default=10),
            "railDepthPct": dom.value("geom-railDepthPct", default=50),
            "doorDikeHeight": dom.value("geom-doorDikeHeight", default=50),
            "doorDikeBaseWidth": dom.value("geom-doorDikeBaseWidth", default=30),
            "doorDikeTopWidth": dom.value("geom-doorDikeTopWidth", default=15),
        },
        "obstacles": {
            "evapDepth": dom.value("evapDepth", default=85),
            "ctrlBoxH": dom.value("ctrlBoxH", default=150), "ctrlBoxW": dom.value("ctrlBoxW", default=500),
            "ctrlBoxL": dom.value("ctrlBoxL", default=100),
            "rshowerH": dom.value("rshowerH", default=700), "rshowerW": dom.value("rshowerW", default=500),
            "rshowerL": dom.value("rshowerL", default=50),
        },
        "_compartments": [{**c, "shelfCount": c.get("shelfCount", 0)} for c in compartments_data],
    }


def get_effective_thicknesses() -> dict:
    """Collapses per-compartment wall thicknesses into ONE representative set
    for schematic drawing: top from the topmost compartment; bottom is the max
    of bottom1/2/3; left/right/rear/door are each the max across both
    compartments (so the drawn cabinet outline is never thinner than either
    compartment actually specifies)."""
    top_comp = compartments_data[0]
    bottom_comp = compartments_data[1] if len(compartments_data) > 1 else compartments_data[0]
    b1 = dom.value("geom-bottom1", default=40)
    b2 = dom.value("geom-bottom2", default=40)
    b3 = dom.value("geom-bottom3", default=40)
    return {
        "top": top_comp["top"], "bottom": max(b1, b2, b3),
        "left": max(top_comp["left"], bottom_comp["left"]),
        "right": max(top_comp["right"], bottom_comp["right"]),
        "rear": max(top_comp["rear"], bottom_comp["rear"]),
        "door": max(top_comp["door"], bottom_comp["door"]),
    }


def mark_dirty():
    global dirty_schematic
    dirty_schematic = True
    dom.show("schematicOverlay", settings["showDirtyOverlay"])


# ------------------------------------------- 9e. Precise volume computation

def build_layout_node_for_precise() -> dict:
    """Converts compartments_data into the tree-node format expected by
    traversal.js's traverseAndComputePrecise() — one 'leaf' node per
    compartment (with fittings: shelfCount, empty shelves/drawers/doorBins
    arrays, null ice-maker/light housings), wrapped in a single 'horizontal'
    root node with a divider between them if there are 2 compartments."""
    leaves = []
    for i, comp in enumerate(compartments_data):
        leaves.append({
            "heightMode": "ratio", "heightValue": comp["ratio"],
            "node": {"nodeType": "leaf", "id": f"comp{i}", "type": comp["type"],
                     "fittings": {"shelfCount": comp.get("shelfCount", 0), "shelves": [], "drawers": [],
                                  "doorBins": [], "iceMakerHousing": {"volume": None}, "lightHousing": {"volume": None}}}
        })
    return {
        "nodeType": "horizontal", "id": "root",
        "children": [{"heightMode": l["heightMode"], "heightValue": l["heightValue"], "node": l["node"]} for l in leaves],
        "dividers": [{"afterChildIndex": 0, "thickness": dom.value("divHoriz", default=20)}] if len(compartments_data) > 1 else [],
    }


def compute_obstacle_volumes(geometry: dict) -> dict:
    """
    Computes internal-volume DEDUCTIONS for physical obstructions inside the
    cabinet: the evaporator coil (housed in whichever compartment is the
    freezer), the electronics control box and R-shower drain trap (housed in
    the fresh-food compartment, stacked vertically, control box first).
    Also totals shelf-RAIL and door-DIKE trim volumes across ALL compartments.
    All raw mm^3 volumes are converted to liters via settings['mm3ToL'].
    """
    comps = geometry.get("_compartments", compartments_data)
    special, obs = geometry.get("special", {}), geometry.get("obstacles", {})
    divider_thick = geometry.get("dividerThickness", dom.value("divHoriz", default=20))
    evap_depth = obs.get("evapDepth", dom.value("evapDepth", default=85))
    ctrl_h, ctrl_w, ctrl_l = obs.get("ctrlBoxH", 150), obs.get("ctrlBoxW", 500), obs.get("ctrlBoxL", 100)
    rshower_h, rshower_w, rshower_l = obs.get("rshowerH", 700), obs.get("rshowerW", 500), obs.get("rshowerL", 50)

    Hb = dom.value("geom-Hb", default=0)
    bottom1 = dom.value("geom-bottom1", default=40)
    floor_raised_y = geometry["H"] - Hb - bottom1

    # --- Evaporator: sits in the freezer compartment (or comps[0] if no freezer)
    freezer_idx = next((i for i, c in enumerate(comps) if c["type"] == "freezer"), -1)
    freezer_comp = comps[freezer_idx] if freezer_idx >= 0 else comps[0]
    freezer_is_bottommost = len(comps) == 1 or freezer_idx == len(comps) - 1
    freezer_top_world = get_comp_top_world_y_for(comps, max(freezer_idx, 0), divider_thick)
    f_height = (clamp(0, freezer_comp["height"], floor_raised_y - freezer_top_world)
                if freezer_is_bottommost else freezer_comp["height"])
    f_inner_w = geometry["W"] - freezer_comp["left"] - freezer_comp["right"]
    evap_vol_mm3 = evap_depth * f_height * f_inner_w

    # --- Control box + R-shower: sit in the fresh compartment, stacked
    fresh_idx = next((i for i, c in enumerate(comps) if c["type"] == "fresh"), -1)
    fresh_comp = comps[fresh_idx if fresh_idx >= 0 else 0]
    is_top_freezer = fresh_idx > 0   # fresh comes SECOND => freezer is on top
    fresh_top_world = get_comp_top_world_y_for(comps, max(fresh_idx, 0), divider_thick)
    available_rear_h = (clamp(0, fresh_comp["height"], floor_raised_y - fresh_top_world)
                        if is_top_freezer else fresh_comp["height"])
    effective_ctrl_h = min(ctrl_h, available_rear_h)
    effective_rshower_h = clamp(0, rshower_h, available_rear_h - effective_ctrl_h)   # stacked below the ctrl box
    ctrl_vol_mm3 = effective_ctrl_h * ctrl_w * ctrl_l
    rshower_vol_mm3 = effective_rshower_h * rshower_w * rshower_l

    # --- Rails (shelf edge trim) and door dikes (raised door-liner ridge), summed over ALL compartments
    rail_h, rail_w = special.get("railHeight", 0), special.get("railWidth", 0)
    rail_depth_pct = special.get("railDepthPct", 0) / 100
    dike_h = special.get("doorDikeHeight", 0)
    dike_area = (special.get("doorDikeBaseWidth", 0) + special.get("doorDikeTopWidth", 0)) / 2 * dike_h

    total_rail_mm3 = total_dike_mm3 = 0
    for c in comps:
        shelf_count = c.get("shelfCount", 0)
        inner_w = geometry["W"] - c["left"] - c["right"]
        inner_d = geometry["D"] - c["rear"]
        total_rail_mm3 += rail_h * rail_w * rail_depth_pct * inner_d * shelf_count * 2   # x2: both side rails
        total_dike_mm3 += dike_area * 2 * (inner_w + c["height"])   # perimeter of the compartment opening

    mm3_to_l = settings["mm3ToL"]
    rails_l, dikes_l = total_rail_mm3 * mm3_to_l, total_dike_mm3 * mm3_to_l
    evap_l = evap_vol_mm3 * mm3_to_l
    ctrl_liters, rshower_liters = ctrl_vol_mm3 * mm3_to_l, rshower_vol_mm3 * mm3_to_l

    return {
        "evaporator": evap_l, "controlBox": ctrl_liters, "rshower": rshower_liters,
        "rails": rails_l, "dikes": dikes_l,
        "totalAll": evap_l + ctrl_liters + rshower_liters + rails_l + dikes_l,
        "railsDikesOnly": rails_l + dikes_l,
    }


def get_comp_top_world_y_for(comps: list, idx: int, divider_thickness: float) -> float:
    y = comps[0]["top"]
    for i in range(idx):
        y += comps[i]["height"]
        if i < len(comps) - 1:
            y += divider_thickness
    return y


def export_volume(leaves: list, geometry: dict) -> dict:
    """
    Computes final per-compartment NET volumes for CSV export: starts from each
    leaf's `gross` volume (from the traversal engine), subtracts that
    compartment's own rail+dike trim, then subtracts the evaporator (freezer)
    or control-box+R-shower (fresh) obstacle volumes.
    """
    comps = compartments_data
    special = geometry.get("special", {})
    per_comp_rails_dikes_l = _rails_dikes_per_compartment(comps, geometry, special)

    adjusted = [{**leaf, "gross": max(0, leaf["gross"] - per_comp_rails_dikes_l[i])} for i, leaf in enumerate(leaves)]
    freezer_idx = next((i for i, c in enumerate(comps) if c["type"] == "freezer"), -1)
    fresh_idx = next((i for i, c in enumerate(comps) if c["type"] == "fresh"), -1)
    freezer_gross = adjusted[freezer_idx]["gross"] if freezer_idx >= 0 else None
    fresh_gross = adjusted[fresh_idx]["gross"] if fresh_idx >= 0 else None

    obstacles = compute_obstacle_volumes(geometry)
    freezer_total = max(0, freezer_gross - obstacles["evaporator"]) if freezer_gross is not None else None
    fresh_total = (max(0, fresh_gross - obstacles["controlBox"] - obstacles["rshower"])
                   if fresh_gross is not None else None)

    return {"freezerGross": freezer_gross, "freezerTotal": freezer_total,
            "freshGross": fresh_gross, "freshTotal": fresh_total}


def _rails_dikes_per_compartment(comps, geometry, special) -> list:
    """Shared helper (inlined 3x verbatim in the real source: export_volume,
    display_precise_results, and buildComparisonTable's getExt all repeat this
    exact same per-compartment rail+dike calculation independently)."""
    out = []
    rail_h, rail_w = special.get("railHeight", 0), special.get("railWidth", 0)
    rail_depth_pct = special.get("railDepthPct", 0) / 100
    dike_h = special.get("doorDikeHeight", 0)
    dike_area = (special.get("doorDikeBaseWidth", 0) + special.get("doorDikeTopWidth", 0)) / 2 * dike_h
    for c in comps:
        inner_w = geometry["W"] - c["left"] - c["right"]
        inner_d = geometry["D"] - c["rear"]
        rails_vol = rail_h * rail_w * rail_depth_pct * inner_d * c.get("shelfCount", 0) * 2 * settings["mm3ToL"]
        dikes_vol = dike_area * 2 * (inner_w + c["height"]) * settings["mm3ToL"]
        out.append(rails_vol + dikes_vol)
    return out


def display_precise_results(leaves: list, geometry: dict):
    """
    Renders the Volume-tab results table AND the PU (polyurethane insulation)
    volume/weight estimation panel. The PU estimate works by SUBTRACTION:
      cabinet PU volume = (external shell volume, minus the compressor-step
      cutout) MINUS (all compartments' net gross volume) MINUS (total dike
      volume) PLUS (any divider-internal PU volume, if the divider itself
      contains PU insulation).
    Door PU volumes are estimated per-door as (door thickness x cabinet width x
    door opening height) plus that compartment's own dike volume, where the
    opening height for all but the last door stops at the midpoint of the
    dividing wall, offset by half the door gap.
    PU WEIGHT is a flat volumetric density assumption: 32 kg per 1000 L (i.e.
    32 g/L), applied uniformly to cabinet, freezer-door, and fridge-door PU
    volumes alike — not derived from any material density lookup.
    """
    comps = compartments_data
    special = geometry.get("special", {})
    per_comp_rails_dikes_l = _rails_dikes_per_compartment(comps, geometry, special)
    adjusted = [{**leaf, "gross": max(0, leaf["gross"] - per_comp_rails_dikes_l[i])} for i, leaf in enumerate(leaves)]

    gross_l = sum(l["gross"] for l in adjusted)
    obstacles = compute_obstacle_volumes(geometry)
    total_l = max(0, gross_l - obstacles["evaporator"] - obstacles["controlBox"] - obstacles["rshower"])

    dom.text("grossVol", round_for_display(gross_l, "L"))
    dom.text("grossVolCuft", round_for_display(gross_l * settings["lToCuft"], "cuft"))
    dom.text("totalVol", round_for_display(total_l, "L"))
    dom.text("totalVolCuft", round_for_display(total_l * settings["lToCuft"], "cuft"))

    freezer_idx = next((i for i, c in enumerate(comps) if c["type"] == "freezer"), -1)
    fresh_idx = next((i for i, c in enumerate(comps) if c["type"] == "fresh"), -1)
    freezer_gross = adjusted[freezer_idx]["gross"] if freezer_idx >= 0 else None
    fresh_gross = adjusted[fresh_idx]["gross"] if fresh_idx >= 0 else None
    freezer_total = max(0, freezer_gross - obstacles["evaporator"]) if freezer_gross is not None else None
    fresh_total = (max(0, fresh_gross - obstacles["controlBox"] - obstacles["rshower"])
                   if fresh_gross is not None else None)
    dom.text_pair("freezerGrossVol", freezer_gross, "L"); dom.text_pair("freezerTotalVol", freezer_total, "L")
    dom.text_pair("fridgeGrossVol", fresh_gross, "L"); dom.text_pair("fridgeTotalVol", fresh_total, "L")

    # --- Door / dike / cabinet PU estimation
    fdoor_pu_l = rdoor_pu_l = total_dikes_l = 0.0
    door_start_y = 0.0
    y_offset = comps[0].get("top", 0)
    dike_h = special.get("doorDikeHeight", 0)
    dike_area = (special.get("doorDikeBaseWidth", 0) + special.get("doorDikeTopWidth", 0)) / 2 * dike_h

    for i, c in enumerate(comps):
        inner_w = geometry["W"] - c["left"] - c["right"]
        door_thick = c.get("door", 0)

        if i == len(comps) - 1:
            door_end_y = geometry["H"]
        else:
            comp_bottom_y = y_offset + c["height"]
            divider_midpoint = comp_bottom_y + geometry["dividerThickness"] / 2
            door_end_y = divider_midpoint - geometry["doorGap"] / 2

        outer_door_height = door_end_y - door_start_y
        base_vol_l = door_thick * geometry["W"] * outer_door_height * settings["mm3ToL"]
        dike_vol_l = dike_area * 2 * (inner_w + c["height"]) * settings["mm3ToL"]
        total_dikes_l += dike_vol_l
        total_door_vol = base_vol_l + dike_vol_l

        if c["type"] == "freezer":
            fdoor_pu_l = total_door_vol
        elif c["type"] == "fresh":
            rdoor_pu_l = total_door_vol

        if i < len(comps) - 1:
            comp_bottom_y = y_offset + c["height"]
            divider_midpoint = comp_bottom_y + geometry["dividerThickness"] / 2
            door_start_y = divider_midpoint + geometry["doorGap"] / 2
            y_offset = comp_bottom_y + geometry["dividerThickness"]

    ext_vol_mm3 = geometry["H"] * geometry["W"] * geometry["D"]
    cutout_vol_mm3 = geometry["Hb"] * (geometry["Db1"] + geometry["Db2"]) / 2 * geometry["W"]
    ext_vol_l = (ext_vol_mm3 - cutout_vol_mm3) * settings["mm3ToL"]

    divider_pu_l = 0.0
    if geometry.get("dividerHasPU") and len(comps) > 1:
        top_comp = comps[0]
        inner_w = geometry["W"] - top_comp["left"] - top_comp["right"]
        inner_d = geometry["D"] - top_comp["rear"]
        divider_pu_l = geometry["dividerThickness"] * inner_w * inner_d * (geometry["dividerPUPct"] / 100) * settings["mm3ToL"]

    cab_pu_l = ext_vol_l - gross_l - total_dikes_l + divider_pu_l

    dom.text("cabpuVol", round_for_display(cab_pu_l, "L"))
    dom.text("cabpuVolCuft", round_for_display(cab_pu_l * settings["lToCuft"], "cuft"))
    dom.text("cabpuweight", round_for_display(cab_pu_l * 32 / 1000, "kg"))
    dom.text("fdoorpuVol", round_for_display(fdoor_pu_l, "L"))
    dom.text("fdoorpuVolCuft", round_for_display(fdoor_pu_l * settings["lToCuft"], "cuft"))
    dom.text("fdoorpuweight", round_for_display(fdoor_pu_l * 32 / 1000, "kg"))
    dom.text("rdoorpuVol", round_for_display(rdoor_pu_l, "L"))
    dom.text("rdoorpuVolCuft", round_for_display(rdoor_pu_l * settings["lToCuft"], "cuft"))
    dom.text("rdoorpuweight", round_for_display(rdoor_pu_l * 32 / 1000, "kg"))


def draw_schematics(config, leaves):
    """Sizes the two schematic canvases to the right-panel viewport, assembles
    a `drawOptions` dict from current geometry/compartments_data/settings, then
    delegates to draw_front_view() / draw_side_view() (Section 11)."""
    ...   # canvas sizing + option assembly, no new physical math beyond Section 11


# --------------------------------------------- 9f. Calculate button handler

def on_calculate_click():
    """
    Top-level Volume-tab orchestration:
      1. Scrape geometry (read_geometry_from_panel) and build the layout tree.
      2. Run traverseAndComputePrecise(layout, geometry) [traversal.js — not
         reviewed] to get per-compartment gross leaf volumes + validation
         errors/warnings.
      3. Render any errors/warnings into the messages panel.
      4. If leaves came back non-empty: cache {config, volumes, thermal:null}
         into last_calc_state, reveal the slot-storage buttons, render the
         results table (display_precise_results) and schematics (draw_schematics).
      5. If leaves is empty: blank out the gross/total volume displays.
    """
    global current_geometry, current_config, last_calc_state
    current_geometry = read_geometry_from_panel()
    layout = build_layout_node_for_precise()
    current_config = {
        "schemaVersion": "2.0",
        "meta": {**(current_config.get("meta") if current_config else
                     {"name": "UI Config", "createdAt": now_iso()}), "updatedAt": now_iso()},
        "cabinet": {"geometry": current_geometry, "layout": layout},
        "thermal": get_thermal_state(),   # Section 10
    }

    leaves, errors, warnings = traverse_and_compute_precise(layout, current_geometry)   # traversal.js, not reviewed
    render_messages(errors, warnings)

    if leaves:
        gross_l = sum(l["gross"] for l in leaves)
        last_calc_state = {"config": current_config,
                            "volumes": {"leaves": leaves, "errors": errors, "warnings": warnings, "totals": {"gross": gross_l}},
                            "thermal": None}
        dom.show("storeSlotABtn", True); dom.show("storeSlotBBtn", True)
        dom.show("compareSlotsBtn", bool(config_slot_a or config_slot_b))
        display_precise_results(leaves, current_geometry)
        draw_schematics(current_config, leaves)
    else:
        dom.text("grossVol", "--"); dom.text("totalVol", "--")


# --------------------------------------------- 9g. Config populate / restore

def populate_ui_from_config(config: dict):
    """
    Restores every UI field from a loaded config JSON. Handles TWO possible
    cabinet schema shapes: the current `cabinet.geometry` (unified) format, and
    a legacy `cabinet.external` + `wallThicknessesByType` format (falls back to
    initCompartments() with just H/W/D + a flat bottom-wall guess in that case).
    Rebuilds compartments_data from `geometry._compartments` if present;
    otherwise re-initializes compartments from scratch. Also restores the
    divider thickness from `layout.dividers[0].thickness`, PU divider settings,
    special (rail/dike) dimensions, obstacle dimensions (each with its own
    hard-coded fallback if the saved config predates that field), and finally
    the thermal state via set_thermal_state() (Section 10) if `config.thermal`
    is present.
    """
    ...   # field-by-field restoration; no new computational logic beyond what
          # read_geometry_from_panel()/build_compartment_ui() already encode


# --------------------------------------------- 9h. Save / Load / Export / Reset

# saveBtn: requires current_config to exist ("Calculate first" alert otherwise);
#   re-stamps current_config.thermal = get_thermal_state(), then hands off to
#   downloadConfigJSON() (io.js, not reviewed) for the filename-prompt + download.
# loadBtn: opens a native file picker (.json), await loadConfigFromFile(file)
#   (io.js), sets current_config, calls populate_ui_from_config(), auto-clicks
#   Calculate, then alerts success — or alerts the caught error message.
# exportBtn: requires last_calc_state to exist; hands off to downloadResultsCSV()
#   (io.js) with the cached state and config name.
# resetAllBtn: confirm() gate, then resets current_geometry to DEFAULT_CABINET,
#   re-fills geometry defaults, resets divider thickness to 20 / compartment
#   count to 2, re-initializes compartments, blanks every result display,
#   clears both canvases, clears current_config/last_calc_state, AND resets
#   settings.fanParam to {tipDiam_mm:220, fanRPM:2200} and settings.evaporator
#   to {width_mm:460, depth_mm:60} — note these reset values DIFFER from
#   SETTINGS_DEFAULTS (Section 8: tipDiam_mm 110, no explicit width/depth
#   override) — this is a SEPARATE, independent set of "factory defaults"
#   specific to the Reset-All button, not a call back into reset_settings().


# --------------------------------------------- 9i. Slot storage & comparison

# storeSlotABtn / storeSlotBBtn: requires last_calc_state; prompt() for a
#   display name (Cancel aborts); deep-clones last_calc_state via
#   JSON round-trip, tags it with slotName, persists to
#   localStorage['refrig_slotA'/'refrig_slotB'].
# compareSlotsBtn: requires at least one slot populated; opens the comparison
#   modal via build_comparison_table(slot_a, slot_b).

def build_comparison_table(state_a, state_b):
    """
    Renders a full side-by-side metrics table for two stored states, covering
    volumes, PU estimates, thermal operating points, compressor details,
    energy consumption + EU-style efficiency RANKS, heat loads, airflow, and
    evaporator performance. The volume/PU math here (`get_ext`) is a THIRD,
    independently-written re-implementation of the exact same rails/dikes and
    PU-estimation formulas as export_volume() and display_precise_results()
    above — not shared code, just triplicated logic kept in sync by hand.
    """
    def get_ext(state):
        if not state or not state.get("config", {}).get("cabinet", {}).get("geometry"):
            return None
        geometry = state["config"]["cabinet"]["geometry"]
        leaves = state.get("volumes", {}).get("leaves", [])
        comps = geometry.get("_compartments", [])
        special = geometry.get("special", {})
        mm3_to_l = 1e-6   # NOTE: hard-coded here, NOT read from settings['mm3ToL'] like the other two implementations

        per_comp = _rails_dikes_per_compartment(comps, geometry, special)   # same formula, independently inlined in source
        adjusted = [{**leaf, "gross": max(0, leaf["gross"] - (per_comp[i] if i < len(per_comp) else 0))}
                    for i, leaf in enumerate(leaves)]
        freezer_idx = next((i for i, c in enumerate(comps) if c["type"] == "freezer"), -1)
        fresh_idx = next((i for i, c in enumerate(comps) if c["type"] == "fresh"), -1)
        freezer_gross = adjusted[freezer_idx]["gross"] if freezer_idx >= 0 else 0
        fresh_gross = adjusted[fresh_idx]["gross"] if fresh_idx >= 0 else 0
        gross_volume = sum(l.get("gross", 0) for l in adjusted)

        obs = geometry.get("obstacles", {})
        divider_thick = geometry.get("dividerThickness", 20)
        Hb = geometry.get("Hb", 0)
        bottom1 = geometry.get("walls", {}).get("freezer", {}).get("bottom1",
                    geometry.get("walls", {}).get("refrigerator", {}).get("bottom1", 40))
        floor_raised_y = geometry["H"] - Hb - bottom1

        freezer_comp = comps[freezer_idx] if freezer_idx >= 0 else (comps[0] if comps else None)
        freezer_is_bottommost = len(comps) == 1 or freezer_idx == len(comps) - 1
        freezer_top_world = get_comp_top_world_y_for(comps, max(freezer_idx, 0), divider_thick)
        f_height = (clamp(0, freezer_comp["height"], floor_raised_y - freezer_top_world)
                    if (freezer_is_bottommost and freezer_comp) else (freezer_comp["height"] if freezer_comp else 0))
        f_inner_w = (geometry["W"] - freezer_comp["left"] - freezer_comp["right"]) if freezer_comp else 0
        evaporator_l = evap_depth_of(obs) * f_height * f_inner_w * mm3_to_l

        fresh_comp = comps[fresh_idx] if fresh_idx >= 0 else (comps[0] if comps else None)
        is_top_freezer = fresh_idx > 0
        fresh_top_world = get_comp_top_world_y_for(comps, max(fresh_idx, 0), divider_thick)
        available_rear_h = (clamp(0, fresh_comp["height"], floor_raised_y - fresh_top_world)
                             if (is_top_freezer and fresh_comp) else (fresh_comp["height"] if fresh_comp else 0))
        ctrl_h_eff = min(obs.get("ctrlBoxH", 150), available_rear_h)
        rshower_h_eff = clamp(0, obs.get("rshowerH", 700), available_rear_h - ctrl_h_eff)
        control_box_l = ctrl_h_eff * obs.get("ctrlBoxW", 500) * obs.get("ctrlBoxL", 100) * mm3_to_l
        rshower_l = rshower_h_eff * obs.get("rshowerW", 500) * obs.get("rshowerL", 50) * mm3_to_l

        freezer_total = max(0, freezer_gross - evaporator_l)
        fresh_total = max(0, fresh_gross - control_box_l - rshower_l)
        total_volume = freezer_total + fresh_total

        fdoor_pu_l, rdoor_pu_l, total_dikes_l = pu_door_estimate(comps, geometry, special, mm3_to_l)   # same formula as 9e, inlined again
        ext_vol_l = ((geometry["H"] * geometry["W"] * geometry["D"])
                     - geometry["Hb"] * (geometry["Db1"] + geometry["Db2"]) / 2 * geometry["W"]) * mm3_to_l
        divider_pu_l = 0.0
        if geometry.get("dividerHasPU") and len(comps) > 1:
            top_comp = comps[0]
            inner_w = geometry["W"] - top_comp["left"] - top_comp["right"]
            inner_d = geometry["D"] - top_comp["rear"]
            divider_pu_l = divider_thick * inner_w * inner_d * (geometry["dividerPUPct"] / 100) * mm3_to_l
        cab_pu_l = ext_vol_l - gross_volume - total_dikes_l + divider_pu_l

        return {"freezerGross": freezer_gross, "freshGross": fresh_gross, "grossVolume": gross_volume,
                "freezerTotal": freezer_total, "freshTotal": fresh_total, "totalVolume": total_volume,
                "cabPUVolL": cab_pu_l, "fdoorPUVolL": fdoor_pu_l, "rdoorPUVolL": rdoor_pu_l,
                "cabPUweight": cab_pu_l * 32 / 1000, "fdoorPUweight": fdoor_pu_l * 32 / 1000,
                "rdoorPUweight": rdoor_pu_l * 32 / 1000}

    def get_rank(state, ext):
        """
        Energy-efficiency letter grade (A-D, or 'OUT OF RANKING'), modeled on an
        EU-style Index of Energy Efficiency (IEE) at three assumed ambient/climate
        reference points (labeled 27/29/31 — presumably regional standard test
        conditions). AV (Adjusted Volume) weights the freezer compartment more
        heavily than the fridge via a (25-TF)/21 factor — the colder the freezer
        setpoint, the more "adjusted volume" it counts as. ES (Standard Energy)
        is a linear function of AV with a fixed base allowance of 800 units,
        de-rated by a different set of "class factor" percentages (90%/80%/60%)
        at each of the three reference points. IEE = annual measured energy /
        ES; lower IEE is more efficient.
        """
        if not state or not ext:
            return {"r27": "-", "r29": "-", "r31": "-"}
        TF = state.get("config", {}).get("fixedTemps", {}).get("TF", -18)
        monthly_e = state.get("thermal", {}).get("energy", {}).get("EnergyConsumption_kWhMonth", 0)
        if monthly_e == 0:
            return {"r27": "-", "r29": "-", "r31": "-"}

        AV = ext["freezerTotal"] * (25 - TF) / 21 + ext["freshTotal"]
        ES_27, ES_29, ES_31 = AV * 0.57 + 800 * 0.9, AV * 0.57 + 800 * 0.8, AV * 0.57 + 800 * 0.6
        annual_kwh = monthly_e * 12
        IEE_27, IEE_29, IEE_31 = annual_kwh / ES_27, annual_kwh / ES_29, annual_kwh / ES_31

        def rank_str(iee):
            if not iee or is_nan(iee):
                return "OUT OF RANKING"
            if iee <= 0.45: return "A"
            if iee <= 0.55: return "B"
            if iee <= 0.65: return "C"
            if iee <= 0.75: return "D"
            return "OUT OF RANKING"   # NOTE: any IEE > 0.75 falls straight to OUT OF RANKING here —
                                        # no distinct band for 0.75 < IEE <= 0.85 (see displayResults'
                                        # INDEPENDENT rank implementation in Section 10n, which DOES
                                        # have that extra band — the two rank calculators disagree).

        return {"r27": rank_str(IEE_27), "r29": rank_str(IEE_29), "r31": rank_str(IEE_31)}

    ext_a, ext_b = get_ext(state_a), get_ext(state_b)
    ranks_a, ranks_b = get_rank(state_a, ext_a), get_rank(state_b, ext_b)
    # ... assembles a large two-column HTML <table> from ext_a/b, ranks_a/b, and
    # state_a/b['thermal']['results'] (compressor/heatLoads/evapDetails/energy
    # sub-objects) — pure string templating from here on, no further math.


# --------------------------------------------- 9j. Tab switching (light)

# tabVolume / tabThermal / tabInverter click handlers: each hides all
# `.tab-panel` elements, shows its own target panel, updates the `.active`
# tab class, and toggles visibility of the thermoRightPanel + both schematic
# canvases (Volume tab shows canvases + hides the thermal results panel;
# Thermal/Inverter tabs do the reverse). No computation.

# setLastCalcThermalState(thermalResults, energyResults): if last_calc_state
# exists, attaches {results: thermalResults, energy: energyResults} onto its
# 'thermal' key — this is the bridge thermoUI.js uses to hand its solve
# results back to main.js's cached state for slot comparison / CSV export.


# ==============================================================================
# SECTION 10 — THERMAL-TAB UI ORCHESTRATOR  (thermoUI.js)
# ==============================================================================

thermal_advanced = {
    "subcool": SJ54H_COMPONENTS["subcool_K"], "dischargeTemp": SJ54H_COMPONENTS["dischargeTemp_C"],
    "fanInputPower": SJ54H_COMPONENTS["fan"]["inputPower_W"],
    "defHeater": SJ54H_COMPONENTS["electrical"]["defrostHeater_W"],
    "defOnMin": SJ54H_COMPONENTS["electrical"]["defrostOn_min"],
    "pwbOn": SJ54H_COMPONENTS["electrical"]["pwbOn_W"], "pwbOff": SJ54H_COMPONENTS["electrical"]["pwbOff_W"],
    "timerPeriod": SJ54H_COMPONENTS["electrical"]["timerPeriod_h"],
    "Damp": 0.6,   # NOTE: 0.6 here vs solver.js's own internal default of 1.0 (Section 5b) —
                    # this UI default is what actually reaches the solver in practice, since
                    # it's always explicitly included in electrical.Damp.
}
get_geometry_fn = lambda: None   # replaced at init with main.js's read_geometry_from_panel


def init_thermo_ui(options):
    """
    Builds the Constant-Speed panel (T0/TF/TR inputs, refrigerant select, Run
    button, Advanced-settings gear button) and the Inverter panel (same plus a
    fixed Running-Ratio PR input and a read-only "current inverter compressor"
    name display) as raw innerHTML, wires their Run/Advanced button clicks,
    refreshes the inverter compressor dropdown, restores thermal_advanced from
    localStorage['thermoAdvanced'] if present, builds the (singleton) advanced
    settings modal, and refreshes the inverter-compressor name display.
    """
    ...


def build_thermal_modal_once():
    """
    Builds the Advanced Settings modal ONCE (idempotent — reuses the existing
    DOM node if called again): condenser pipe pitches, full evaporator geometry
    (width/height/depth/rows/layers/tube OD/fin height/fin length/fin
    count/side plates), fan parameters (tip diameter/RPM/input power),
    compressor select + Add/Edit/Delete buttons, discharge temp, electrical +
    defrost fields, and a single Damper-Ratio field. Caches every input element
    reference into `thermal_modal_inputs` for fast repeated access, and
    attaches its permanent event handlers (close, add/edit/delete compressor,
    compressor-select change -> set_selected_compressor, save-and-close ->
    save_thermal_settings, click-outside-to-close).
    """
    ...


def open_thermal_settings():
    """Reloads the compressor catalog, then hydrates every modal input from
    `settings` (condenser/evaporator/fanParam) and `thermal_advanced`
    (discharge/defrost/pwb/damper), each with its own inline fallback default
    matching Section 8's SETTINGS_DEFAULTS. Refreshes the compressor dropdown
    and inverter-name display, then un-hides the modal."""
    ...


def refresh_compressor_select():
    """Repopulates the modal's compressor <select> from get_compressor_list(),
    marking whichever matches get_current_compressor().id as selected."""
    ...


def save_thermal_settings():
    """
    Scrapes every modal input back into `settings.condenser` / `.evaporator` /
    `.fanParam` and calls update_settings(settings) (Section 8) to persist +
    broadcast. Then scrapes discharge/fan-power/defrost/pwb/timer fields into
    `thermal_advanced`, each falling back to its SJ54H_COMPONENTS default if
    the parsed value is falsy (NaN/0/empty) — meaning a deliberately-entered
    ZERO for e.g. defrostOn_min would be silently replaced by the default,
    since JS `||` treats 0 as falsy. `thermal_advanced.Damp` specifically falls
    back to 1.0, not 0.6, if unset — a THIRD distinct "default damping" value
    in the codebase, after Section 5's electrical.get('Damp',1.0) and this
    module's own initial `Damp: 0.6`. Persists thermal_advanced to
    localStorage['thermoAdvanced'], applies the compressor-select choice via
    set_selected_compressor(), refreshes the inverter-name display, and hides
    the modal.
    """
    ...


def parse_compressor_data_file(file, wants_inverter=False) -> list:
    """
    Reads an uploaded .xlsx/.xls/.csv file via the `xlsx` library, takes the
    FIRST sheet only, and header-sniffs for TE/TC/W/Q (and RPM, if
    wants_inverter) columns using CASE-INSENSITIVE SUBSTRING matching against
    a small candidate-keyword list per column (e.g. TE column matches any
    header containing 'te' or 'evap temp' — meaning a header like "state" would
    also match 'te' as a substring; not anchored/whole-word matching).
    Rejects the file if any required column can't be found, or if fewer than 5
    fully-numeric rows survive after parsing (rows with any NaN in a mapped
    column are dropped entirely, not partially salvaged).
    """
    ...


def open_add_compressor_modal():
    """
    Renders a modal for adding a brand-new catalog compressor: a type radio
    (constant-speed vs inverter) that toggles which field group is visible,
    name + refrigerant inputs, and (per type) cylinder-volume/speed fields plus
    an Excel-upload + 'Load Data' button. On 'Add Compressor' click:
      - constant-speed: validates name/cylinder/speed and >=5 loaded points,
        calls compute_compressor_coefficients() (Section 4d), then
        add_compressor() with the fitted wCoeffs/etaCoeffs plus the raw
        dataPoints retained for future re-fitting.
      - inverter: validates >=5 loaded inverter points, derives normalizeRPM
        (= max RPM in the data), centerTE/centerTC (= mean of the data), calls
        fit_inverter_coefficients() (Section 4d) with a fixed targetRMSE=3.0,
        then add_compressor() with the fitted compressorModel plus the
        data-derived rpmMin/rpmMax (NOT the model's own bounds).
    Either path re-opens open_thermal_settings() afterward to reflect the new
    entry in the dropdown.
    """
    ...


def open_edit_compressor_modal():
    """
    Same shape as open_add_compressor_modal() but pre-populated from
    get_current_compressor(), with an existing-data-points preview table and an
    optional 'Replace with New Excel File' upload.
    For constant-speed compressors specifically, refitting is SKIPPED (reuses
    the existing wCoeffs/etaCoeffs as-is) unless the loaded data points changed
    OR cylinder volume / speed / refrigerant index changed from the stored
    values (`needRefit` flag) — an optimization to avoid redundant OLS solves
    when the user only renames a compressor.
    Inverter compressors are ALWAYS refit unconditionally on save (no
    equivalent needRefit check on that branch).
    Saving replaces the catalog entry via delete_compressor(old_id) followed by
    add_compressor(updated) + set_selected_compressor(old_id) — i.e. the ID is
    preserved even though the entry is removed and re-added, not mutated in place.
    """
    ...


def handle_run():
    """
    Constant-Speed 'Run Thermal Analysis' handler — the full request assembly
    for a live solve:
      1. Scrape geometry via get_geometry_fn() -> to_thermal_format().
      2. Validate T0/TF/TR are present numbers.
      3. Compute fan airflow + evaporator area via air_speed()/compute_evaporator_area()
         (Section 1) using settings['fanParam']/settings['evaporator'] — any
         thrown geometry error (e.g. zero face area) is caught and surfaced.
      4. Validate thermal_advanced.fanInputPower is a non-negative finite number.
      5. Infer freezerPosition from cabinet_geom._compartments: 'top' if there's
         only 1 compartment OR the first compartment is type 'freezer',
         otherwise 'bottom'.
      6. build_default_config() (Section 6) with the scraped geom, freezer
         position, refrigerant, subcool/discharge/fixed-temps/fan/electrical
         overrides, and the pre-computed evapGeom.
      7. If settings.condenser is set, override config.condenserConfig's pipe
         pitches from it.
      8. Load the current compressor catalog entry; validate its wCoeffs (5
         elements) / etaCoeffs (3 elements) — coercing legacy keyed-object
         coefficient formats back to arrays first. If invalid, silently falls
         back to the default EGX80CLC compParams already in `config` and queues
         a warning string (does NOT abort the run).
      9. Force config.solverOptions.innerOptions.debug = True unconditionally
         before every constant-speed run (matching the newton2 debug-flag
         finding from Section 5b — this UI code explicitly wants debug logging
         on, even though the flag was already hard-wired True regardless).
     10. Call run_thermo_analysis(config) (Section 6). Re-attach the compressor's
         wCoeffs/etaCoeffs onto result.results.compressor for later display
         (buildInverterEquation-style coefficient string rendering, see 10n)
         — BUT ONLY for the constant-speed path; run_thermo_analysis's own
         output object (Section 6) does not include these fields itself.
     11. On failure: surface result.errors and stop. On success: prepend any
         compressor-fallback warning, then compute EnergyConsumption() (Section
         5h) if the result converged.
     12. Independently RE-DERIVE evaporator performance details (area, air
         speed, alpha, LMTD, capacity) for DISPLAY purposes — a duplicate
         evaluation of the same physics already computed inside the solve, using
         the ALREADY-CONVERGED result's MR/MF/T2/TE to reconstruct T1 and re-run
         lmtd()/evaporatorCapacity() (Section 1) fresh. This is purely a
         post-hoc explanatory breakdown; it does not feed back into the solve.
     13. Stamp result.results.fanAirflow / .fanAirSpeed / .configLabel (derived
         from compartment count + freezer position), hand off to
         set_last_calc_thermal_state() (bridges to main.js's cached state), and
         call display_results() (10n) + display_precise_results-style warning
         rendering.
    """
    ...


def handle_inverter_run():
    """
    Inverter 'Run Inverter Analysis' handler. Same geometry/fan/evaporator-area
    setup as handle_run(), but:
      - Validates a user-entered fixed Running Ratio PR in (0, 1].
      - Requires the currently-selected compressor to have isInverter=true
        (hard error otherwise — no fallback to a default inverter).
      - Chooses its performance-data source: the compressor's own dataPoints if
        it has >=5, ELSE falls back to INVERTER_EXAMPLE_COMPONENTS' bundled
        35-point DZ90A1X dataset (Section 0b) regardless of which inverter
        compressor is actually selected — meaning an inverter compressor with
        too few data points silently gets fitted against a DIFFERENT
        compressor's performance curve.
      - REFITS the inverter model from scratch on EVERY run
        (fit_inverter_coefficients() called inline here, not reused from
        anything cached) using the compressor's stored normalizeRPM/centerTE/
        centerTC if present, else deriving them fresh from the data points —
        meaning repeated runs re-solve the same Ridge+CV grid search each time
        rather than caching the fitted model, and immediately persists the
        freshly-fit model back into the catalog via save_compressors().
      - Sets config.compParams.isInverter=true with the just-fit model and
        config.inverterPR = PR (the user's fixed running ratio).
      - Requires settings.evaporator.evapArea_m2 > 0 to already be set (does
        NOT compute it inline here the way handle_run() does at step 3 — relies
        on a PRIOR compute_evaporator_area() call having already stamped
        evapArea_m2 onto the shared settings.evaporator object).
      - Same post-solve EnergyConsumption + duplicate evaporator-detail
        recomputation + configLabel stamping + display_results(..., isInverter=True)
        as handle_run(), but WITHOUT the same guard around
        `result.results.converged !== false` before calling EnergyConsumption
        that handle_run() has for its OWN energy computation
        (`if result.results and result.results.converged is not False`) — this
        one's condition is written identically, so behaviorally equivalent
        here; noted only because the two code paths duplicate the same
        conditional independently rather than sharing a helper.
    """
    ...


def build_inverter_equation(model: dict, var_name: str) -> str:
    """
    Renders a fitted inverter Q or W model back into a human-readable equation
    string, matching make_features()'s exact term layout (Section 4d) for each
    of the 4 rpmForm variants. For a 'global' model: `{var} = c0 + c1*term1 + ...`
    (or `ln({var}) = ...` if logTransform), skipping any term whose coefficient
    magnitude is below 1e-12. For a 'piecewise' model: renders BOTH the
    low-range equation (always as plain 'n_quad', never log-transformed — the
    piecewise fitter (Section 4d) never uses any other form) and the max-RPM
    equation, with a note that values between them are linearly interpolated.
    """
    ...


def display_results(res: dict, energy: dict, is_inverter: bool = False):
    """
    Renders the full thermal results table. Of note beyond straightforward
    formatting:
      - Reads TF from whichever of #inverterTF / #thermoTF is relevant based on
        `is_inverter`.
      - Computes an energy-efficiency RANK a SECOND, independently-written way
        (see build_comparison_table's get_rank in Section 9i for the first):
        Ann_EC = eW * 365 (annualizes the DAILY energy figure, not monthly x12
        like get_rank does — a different annualization basis between the two
        rank calculators, though Ann_EC itself is computed here and then
        UNUSED — the actual IEE calculation below still uses eKWh, the MONTHLY
        figure x 12, matching get_rank's approach; Ann_EC appears to be dead
        /vestigial code). AV/ES_27/29/31/IEE_27/29/31 formulas are otherwise
        identical to get_rank's. The rank-threshold ladder HERE, unlike
        get_rank's, has an EXTRA final band: IEE <= 0.85 also maps to
        'OUT OF RANKING' explicitly (functionally the same end result as
        get_rank's implicit "anything else" catch-all, but written as its own
        explicit branch, and anything BEYOND 0.85 falls through with no rank
        assigned at all in this version — an actual gap where Rank_27/29/31
        could remain `undefined` if IEE exceeds 0.85, vs get_rank's version
        which always returns a string).
      - Volumetric efficiency (etaV) for an INVERTER compressor is computed a
        THIRD independent way here (distinct from Section 4's compressor_power()
        eta polynomial AND from solver.js never computing one for inverters at
        all — Section 5b explicitly returns VolumetricEfficiency: None for
        inverter mode): manually re-derives theoretical mass flow from
        cylinderVolumeCm3 x RPM x 60 / specific-volume-at-a-HARD-CODED
        32.2C-suction-temperature basis (not the SUCTION_TEMP_C=30 constant
        used everywhere else in Section 4/5), then etaV = actual/theoretical.
        For constant-speed compressors, etaV is read directly from
        comp.etaV (already computed by compressor_power()'s polynomial,
        Section 4c).
      - Compressor coefficient equations for display: inverter path calls
        build_inverter_equation() against res.compressorModel.Q/.W; constant-
        speed path formats comp.etaCoeffs/.wCoeffs directly as a literal
        formula string with each coefficient's value inlined.
      - Volumes for the AV calculation are obtained by calling
        export_volume(traverse_and_compute_precise(...), read_geometry_from_panel())
        FRESH, live, at display time — i.e. the energy-rank calculation here
        depends on whatever the Volume tab's CURRENT geometry state is at the
        moment Thermal results are displayed, not necessarily the geometry that
        was actually in effect when the thermal solve itself ran.
      - Renders one large HTML table: Operating Points, Compressor Details
        (coefficients + Pe/Pc/etaV/capacity/power/COP/mass flow), Energy
        Consumption + ranks, Heat Loads, Fan Airflow, Evaporator Performance
        (if evapDetails present), and Solver iteration counts.
    """
    ...


def get_thermal_state() -> dict:
    """Snapshots T0/TF/TR/refrigerant/divider-insulation-type from the DOM,
    plus thermal_advanced, settings.evaporator/.condenser/.fanParam, and
    get_current_compressor() — used both for save-to-file and for main.js's
    cached last_calc_state.config.thermal."""
    ...


def set_thermal_state(data: dict):
    """
    Restores T0/TF/TR/refrigerant/divider-type into their DOM fields if
    present in `data`. Merges data.advanced into thermal_advanced (shallow
    spread) and re-persists it. Overwrites settings.evaporator/.condenser/
    .fanParam wholesale if present in `data` (no merge). If `data.compressor`
    is present: looks it up by id in the catalog — if not found, calls
    add_compressor(); if found, OVERWRITES that catalog slot directly via a
    raw localStorage write (bypassing ensure_arrays()' schema-upgrade pass,
    unlike every other code path that touches the catalog) — then
    set_selected_compressor(data.compressor.id). Finally calls
    update_settings(settings) once at the end to persist/broadcast everything.
    """
    ...


def refresh_inverter_compressor_select():
    """Reloads the catalog and repopulates the (separate, inverter-panel-only)
    '#inverterCompressorSelect' dropdown with just the isInverter entries; if
    nothing is currently selected, defaults to the first inverter in the list."""
    ...


def populate_inverter_compressor_select():
    """
    NOTE: near-duplicate of refresh_inverter_compressor_select() immediately
    above — same reload-catalog-and-repopulate-dropdown logic, written as a
    SEPARATE function rather than the first one being reused. Both exist in
    the source; only refresh_inverter_compressor_select() is actually called
    from init_thermo_ui(), leaving this one effectively dead/unused code.
    """
    ...


def update_inverter_compressor_display():
    """Shows the current compressor's name in green if it's a valid inverter
    entry, or a red 'No inverter compressor selected' message otherwise."""
    ...


def ensure_inverter_model(comp: dict) -> dict:
    """
    Idempotent helper: if `comp` is an inverter with no compressorModel yet and
    has >=5 dataPoints, fits one via fit_inverter_coefficients() (using
    max(RPM) / mean(TE) / mean(TC) as normalize/center params) and persists it
    via save_compressors(). Returns `comp` unchanged in every other case
    (non-inverter, already has a model, or insufficient data — the latter only
    logs a console warning, does not raise).
    """
    ...


# ==============================================================================
# SECTION 11 — SCHEMATIC CANVAS RENDERER  (schematic.js)
# ==============================================================================

DRAW_THEME = {
    "color": "#7AB3FF", "strokePrimary": "#4C5970", "strokeMuted": "#333C4D",
    "text": "#F0F3F7", "textMuted": "#AEB7C5",
    "bgCanvas": "#141923", "bgInsulation": "#0D1118", "bgFresh": "#1A212D", "bgFreezer": "#1E293B",
    "bgObstacle": "rgba(51, 60, 77, 0.6)", "bgDoor": "rgba(122, 179, 255, 0.12)",
    "alert": "#FF9E9E", "warning": "#FCD34D",
    "lineWidth": 1, "arrowSize": 5, "font": '12px "Inter", sans-serif', "fontMono": '11px "JetBrains Mono", monospace',
}


def draw_dim(ctx, x1, y1, x2, y2, offset, label, options=None):
    """
    Draws a CAD-style dimension line between (x1,y1) and (x2,y2), offset
    perpendicular to the line by `offset` pixels, with optional extension
    lines, arrowheads at both ends, and a rotated (always-upright) label with
    an opaque background "knockout" behind the text.
    Perpendicular offset direction: normal vector (nx,ny) = (-dy/len, dx/len)
    — a 90-degree CCW rotation of the line's own direction vector, scaled to
    unit length first.
    Arrowheads: two short line segments at +/-(pi/6.5) radians from the main
    line's angle, length = arrowSize, mirrored in direction (sign=+1 at one
    end, -1 at the other) so both arrowheads point INWARD along the dimension
    line toward each other.
    Label rotation: keeps text upright by normalizing the line's angle into
    (-pi/2, pi/2] — if the raw angle would render the text upside-down
    (>pi/2+0.01 or <-pi/2+0.01), it's flipped by pi; a special-cased near-
    vertical angle (within 0.01 of pi/2) is pinned to exactly -pi/2.
    """
    opts = options or {}
    color = opts.get("color", DRAW_THEME["color"])
    line_width = opts.get("lineWidth", DRAW_THEME["lineWidth"])
    arrow_size = opts.get("arrowSize", DRAW_THEME["arrowSize"])
    font = opts.get("font", DRAW_THEME["fontMono"])
    text_offset_x, text_offset_y = opts.get("textOffsetX", 0), opts.get("textOffsetY", 0)
    draw_ext_lines = opts.get("drawExtLines", True)
    bg_color = opts.get("bgColor", DRAW_THEME["bgCanvas"])

    dx, dy = x2 - x1, y2 - y1
    length = sqrt(dx * dx + dy * dy)
    if length == 0:
        return
    nx, ny = -dy / length, dx / length   # unit normal, 90 deg CCW from the line direction

    p1x, p1y = x1 + nx * offset, y1 + ny * offset
    p2x, p2y = x2 + nx * offset, y2 + ny * offset

    ctx.set_stroke(color, line_width)

    if draw_ext_lines and offset != 0:
        ext_start, ext_end = sign(offset) * 2, offset + sign(offset) * 4
        ctx.line(x1 + nx * ext_start, y1 + ny * ext_start, x1 + nx * ext_end, y1 + ny * ext_end)
        ctx.line(x2 + nx * ext_start, y2 + ny * ext_start, x2 + nx * ext_end, y2 + ny * ext_end)

    ctx.line(p1x, p1y, p2x, p2y)   # main dimension line

    angle = atan2(dy, dx)
    ctx.set_fill(color)
    for px, py, arrow_sign in [(p1x, p1y, 1), (p2x, p2y, -1)]:
        ctx.triangle(
            (px, py),
            (px - arrow_size * cos(angle - PI / 6.5) * arrow_sign, py - arrow_size * sin(angle - PI / 6.5) * arrow_sign),
            (px - arrow_size * cos(angle + PI / 6.5) * arrow_sign, py - arrow_size * sin(angle + PI / 6.5) * arrow_sign),
        )

    if label:
        mid_x, mid_y = (p1x + p2x) / 2 + text_offset_x, (p1y + p2y) / 2 + text_offset_y
        text_angle = angle
        if text_angle > PI / 2 + 0.01:
            text_angle -= PI
        elif text_angle < -PI / 2 + 0.01:
            text_angle += PI
        if abs(text_angle - PI / 2) < 0.01:
            text_angle = -PI / 2
        # ... translate to (mid_x,mid_y), rotate by text_angle, measure label width,
        # draw a padded rounded-rect knockout in bg_color, then fillText the label
        # centered at the origin in DRAW_THEME['text'] color.


def draw_box(ctx, x, y, w, h, label, color):
    """Simple obstacle rectangle: translucent fill (bgObstacle) + colored
    stroke + centered label text."""
    ...


def draw_front_view(canvas, geometry, effective_walls, layout, leaves, options=None):
    """
    Renders the front (H x W) elevation. Sequence:
      1. Scale-to-fit: scale = min(drawableWidth/W, drawableHeight/H), with a
         50/40/40/40px L/T/R/B padding margin.
      2. Fill the WHOLE inner cavity polygon (all compartments + dividers) in
         bgInsulation FIRST, as a single closed path threading down through
         each compartment's left/right inner-wall X boundaries.
      3. Draw each compartment as its own filled+stroked rectangle in
         bgFreezer or bgFresh (by leaf type), with an uppercase type label in
         its top-left corner, and (between compartments) a bgInsulation-filled
         divider band of `dividerThickness` height.
      4. Shelves: if explicit `shelfCounts` were passed (the normal Volume-tab
         path), evenly space that many shelf lines within each compartment's
         USABLE height (clipped against the raised-floor line for the last
         compartment only), and draw a small rail rectangle at both the left
         and right end of each shelf line. ELSE (fittings-based fallback path,
         used when rendering a loaded config's `layout` tree directly instead
         of live compartments_data): space shelf lines from `fittings[].shelves`
         count instead, and separately lay out any `drawers` as fixed-height
         (30px) rectangles evenly spaced with their own gap formula.
      5. Control Box + R-Shower: found via whichever compartment is type
         'fresh' (or comp 0 if there's only one compartment); stacked
         vertically starting from that compartment's usable-height boundary,
         control box first then R-shower filling any remaining available
         height beneath it; each drawn via draw_box(), centered horizontally
         at W/2.
      6. Outer cabinet stroke (2px), then a dashed warning-colored horizontal
         line at the (H - Hb - tRbottom1) raised-floor Y coordinate, drawn
         across whichever single compartment that Y value actually falls
         inside (found by linear accumulation over compHeights + dividers,
         defaulting to the last compartment if the search overshoots).
      7. Dimension lines: one draw_dim() per compartment height (and one per
         divider gap between them) along the left margin, plus overall width
         along the bottom, plus top-left/top-right wall-thickness callouts
         along the very top edge.
    """
    ...


def draw_side_view(canvas, geometry, effective_walls, options=None):
    """
    Renders the side (D x H) profile — the more geometrically involved of the
    two views, since it must depict the sloped compressor-step cutout.
      1. Scale-to-fit against D (not W) x H, with 60/40/60/40px padding.
      2. COMPRESSOR-STEP SLOPE GEOMETRY: the step is a line from (Db1, H-Hb) to
         (Db2, H) — i.e. the diagonal transition between the raised freezer
         floor and the lower main floor. To find where the INSULATED inner
         surface of that slope crosses the raised-floor line (floorRaisedY)
         and the lower-floor line (floorLowerY), the code:
           a. computes the slope's own unit normal (nx,ny) = (dy/len, -dx/len)
              [note: DIFFERENT sign convention from draw_dim's normal — this
              one points to whichever side puts a positive offset "inside" the
              cabinet, not a generic CCW rotation]
           b. offsets the slope line inward by tRbottom2 (the insulation
              thickness specific to this stepped panel) to get a parallel
              interior line
           c. parametrically solves for where that offset line's Y coordinate
              equals floorRaisedY (giving slopeStartX) and floorLowerY (giving
              slopeEndX), via linear interpolation along the offset line's own
              direction vector (cbDx, cbDy) — this is a genuine line-intersection
              calc, not just geometric estimation.
         If the slope is perfectly horizontal (cbDy == 0), both slopeStartX
         and slopeEndX collapse to the same offset X (degenerate case).
      3. Draws the insulated cavity + compartment fill polygons using this
         slope geometry as their bottom boundary — as either ONE compartment's
         polygon (single-compartment case) or as TWO independently-pathed
         top/bottom compartment polygons sharing the divider band between them
         (two-compartment case); the bottom compartment's polygon is the one
         that incorporates the sloped floor.
      4. Draws the compressor housing itself as a filled/stroked triangle-ish
         quad from the cabinet's bottom-left corner up to (Db1,H-Hb) then down
         to (Db2,H).
      5. Divider + doors: for the two-compartment case, draws the divider band
         then computes TWO separate door rectangles (top door ends at the
         divider midpoint minus half the door gap; bottom door starts at the
         divider midpoint plus half the door gap) so there's a visible air gap
         between them; single-compartment case just draws one full-height door.
         Each door is drawn as a translucent bgDoor rectangle at the cabinet's
         depth edge, `doorThickness` wide, PLUS its own thickness dimension
         line and an overall door-height dimension line off to the right.
      6. Door dikes: for EACH compartment, draws a trapezoidal dike profile (a
         4-point polygon interpolating between the door's base width and top
         width over the dike's height) mirrored at both the top and bottom
         edge of that compartment's door opening.
      7. Locates the fresh compartment (however many there are) to place the
         Control Box + R-Shower obstacles in side profile too — reusing the
         same "available rear height" clipping logic as the front view, but
         additionally recording each obstacle's own front-face X coordinate
         (ctrlBoxFrontX / rshowerFrontX) and vertical span, which the SHELF
         drawing pass below then uses to route shelves around them.
      8. Evaporator: a dashed vertical alert-colored line at (compartmentRearX
         + evapDepth), spanning that freezer compartment's usable height (or
         the sole compartment's usable height, single-compartment case) — one
         per freezer-type compartment if there are multiple.
      9. Shelves (side view): for each shelf line, computes its START X by
         taking the compartment's rear-wall X, then pushing it FURTHER forward
         (away from the back wall) if that shelf's Y coordinate falls within
         the evaporator's depth zone, the control box's vertical span, or the
         R-shower's vertical span (each check independently ratchets startX
         forward via max(), so a shelf blocked by multiple obstacles clears
         all of them) — then draws the shelf line from that adjusted startX to
         the door's inner face, plus a rail rectangle sized by railDepthPct of
         the REMAINING usable depth past whichever obstacle (if any) that
         particular shelf had to route around.
     10. Outer cabinet stroke, then an extensive set of cascaded dimension
         lines: overall H, Hb (raised-floor offset), Db1/Db2 (slope run at top
         and bottom), overall D, top-wall thickness, each DISTINCT rear-wall
         thickness (only drawn once per unique value, comparing consecutive
         compartments), bottom-wall thickness (tRb3) near the sloped floor,
         the stepped panel's own insulation thickness (tRb2, drawn as a short
         offset segment along the slope's normal direction), and finally each
         compartment's own height, mirrored on the opposite (door) side of the
         drawing from where the front view puts its height dims.
    """
    ...


# enable_coordinate_tooltip(): present in source but its ENTIRE BODY is commented
# out (block-commented, `/** ... */`) — genuinely dead code, not wired to any
# event in the current build. Would, if re-enabled, translate mouse pixel
# coordinates back into real-world mm using the same PAD/scale formulas as
# draw_front_view()/draw_side_view(), and show a floating tooltip with the
# computed (X,Y) — hidden automatically whenever the cursor strays outside the
# cabinet's own W x H (front) or D x H (side) bounds.


# ==============================================================================
# SECTION 12 — PARAMETRIC SWEEP / CHARTING  (graphUI.js)
# ==============================================================================

def extract_span(id: str) -> float:
    """Reads a numeric value straight out of a <span> element's text content
    (used for Volume-tab outputs, which are rendered as plain spans rather
    than inside the thermo results <table>)."""
    return parse_float(dom.text_of(id)) or 0


def extract_table(row_label: str, secondary_regex=None) -> float:
    """
    Scrapes a numeric value out of the thermo results <table> (Section 10n's
    output) by TEXT-MATCHING the row label against every <td> in the table —
    finds the FIRST <td> whose text CONTAINS row_label as a substring (not an
    exact match — e.g. 'QF' would also match inside a longer label containing
    'QF' anywhere), then reads its immediate next sibling <td>'s text. If
    `secondary_regex` is given, applies it to extract a specific numeric
    sub-match (used for e.g. pulling the parenthetical m3/h figure out of a
    combined "123.4 CFM (56.7 m3/h)" cell) instead of parsing the whole string.
    """
    ...


def dom_input(id: str) -> dict:
    """A {get, set} pair bound to a plain numeric <input>: get() parses its
    current value; set(val) writes the value AND fires synthetic 'input' and
    'change' DOM events — the 'change' event specifically is required to
    trigger compartment ratio-recalculation listeners (Section 9b) when
    sweeping a geometry field like compartment height."""
    return {"get": lambda: parse_float(dom.value_raw(id)) or 0,
            "set": lambda val: dom.set_and_fire(id, val, events=["input", "change"])}


def advanced_setting(category: str, key: str) -> dict:
    """A {get, set} pair bound to a nested field of thermoUI's get_thermal_state()
    / set_thermal_state() round-trip — get() reads the current snapshot's
    [category][key]; set(val) reads a FRESH snapshot, mutates that one field,
    and writes the WHOLE snapshot back via set_thermal_state() (which, per
    Section 10, does a shallow overwrite of settings.evaporator/.condenser/
    .fanParam — so sweeping a single nested field this way still replaces the
    entire containing object each step, just with only one field actually
    changed inside it)."""
    ...


# DICTIONARY: maps each of 3 domains ('volume', 'thermal', 'inverter') to:
#   .inputs  — list of {id, label, get, set} sweepable X-axis candidates
#              (volume domain uses dom_input() directly on geometry fields;
#              thermal/inverter domains use advanced_setting() for nearly
#              everything EXCEPT their own T0/TF/TR/PR fields, which use
#              dom_input() directly since those aren't part of thermal_advanced)
#   .outputs — list of {id, label, extract} Y-axis candidates (volume domain
#              uses extract_span() against Volume-tab result spans; thermal/
#              inverter domains use extract_table() against the results table
#              — 'thermal' and 'inverter' outputs list nearly IDENTICAL rows,
#              maintained as two separately-typed-out lists rather than one
#              shared list, since they read from structurally-identical but
#              separately-rendered result tables)
#   .trigger — a zero-arg function that re-runs the calculation for that domain
#              by synthetically clicking its Run button (#calculateBtn /
#              #thermoRunBtn / #inverterRunBtn)

DICTIONARY = {
    "volume": {"inputs": [...], "outputs": [...], "trigger": lambda: dom.click("calculateBtn")},
    "thermal": {"inputs": [...], "outputs": [...], "trigger": lambda: dom.click("thermoRunBtn")},
    "inverter": {"inputs": [...], "outputs": [...], "trigger": lambda: dom.click("inverterRunBtn")},
}


def get_active_domain() -> str:
    """Whichever of #panelVolume/#panelThermal/#panelInverter currently has
    the 'active' class; defaults to 'volume' if none match (shouldn't happen
    in practice since exactly one tab is always active)."""
    ...


def init_graph_modal():
    """Wires the Graph modal's open/close buttons and its 'Generate' button
    (-> run_parametric_sweep(get_active_domain())). populate_modal_fields() is
    called fresh every time the modal is opened, re-deriving the X-axis <select>
    options and Y-axis checkbox list from whichever domain is currently active."""
    ...


def populate_modal_fields(domain: str):
    dict_ = DICTIONARY[domain]
    # rebuild #graphXVar <option> list from dict_.inputs, and
    # #graphYChecklist <label><input type=checkbox> list from dict_.outputs


def run_parametric_sweep(domain: str):
    """
    The core sweep algorithm — genuinely novel logic not seen elsewhere in the
    codebase:
      1. Resolve the chosen X input config and Y output configs from the
         active domain's DICTIONARY, plus min/max/step from the modal's numeric
         fields. Validates step > 0 and all three parse as numbers; alerts and
         aborts otherwise. Requires at least one Y checkbox checked.
      2. SNAPSHOT the X input's current value (inputConfig.get()).
      3. TRY: for x = min; x <= max; x += step (an inclusive-both-ends sweep,
         floating-point step accumulation — no explicit epsilon guard against
         float drift causing the loop to run one iteration short/long at the
         boundary):
           a. inputConfig.set(x) — writes the value AND fires input+change
              events so any dependent UI state (e.g. compartment ratios)
              recalculates.
           b. dict_.trigger() — synchronously re-runs the FULL calculation for
              that domain by clicking its Run button (this is a genuinely
              synchronous, blocking sweep: each step fully re-solves the
              thermal/volume model before the next step begins, since the
              solve itself is synchronous JS, not async/awaited).
           c. Reads every selected output's current value via out.extract()
              (scraping the just-updated DOM/table) into a {x, ...outputs}
              data point, appended to graphData.
      4. FINALLY (runs even if the loop threw partway through): restores the
         X input to its ORIGINAL snapshotted value and re-triggers the
         calculation once more, so the live UI ends up back in its pre-sweep
         state regardless of how the sweep went.
      5. Renders the collected graphData via render_chart().
    """
    ...


def render_chart(data: list, outputs: list, x_axis_label: str):
    """
    Destroys any previous Chart.js instance on the canvas, then builds one
    line-series dataset per selected output (each output's `data` array is
    `[{x: d.x, y: d[out.id]} for d in data]`), colored from a fixed 10-color
    high-contrast palette cycling by index (wrapping via modulo if there are
    more than 10 outputs selected), with translucent (33 hex alpha) fill color
    matching each line's stroke color, and a dark-theme-matched set of Chart.js
    scale/legend/tooltip styling options.
    """
    ...




# ==============================================================================
# SECTION 13 — PRECISE VOLUME TRAVERSAL  (traversal.js)
# ==============================================================================

DIM_TOL = 0.01   # mm tolerance for explicit-height balance validation


def traverse_and_compute_precise(root_node: dict, geometry: dict) -> dict:
    """
    Walks the (currently always flat, 1- or 2-child) 'horizontal' layout tree
    and computes each leaf compartment's gross volume via calc_leaf_gross_precise()
    (Section 14), accounting for the stepped compressor floor on whichever
    compartment is bottommost.
    """
    errors, warnings, leaves = [], [], []

    if root_node["nodeType"] != "horizontal":
        errors.append({"rule": "layout", "message": "Root node must be horizontal for precise calc"})
        return {"leaves": leaves, "errors": errors, "warnings": warnings}

    # --- 1. Top insulation, from the TOPMOST child's own wall type
    first_child = root_node["children"][0]["node"] if root_node["children"] else None
    if not first_child or first_child["nodeType"] != "leaf":
        errors.append({"rule": "layout", "message": "First child must be a leaf"})
        return {"leaves": leaves, "errors": errors, "warnings": warnings}

    top_wall_key = "refrigerator" if first_child["type"] == "fresh" else first_child["type"]
    top_walls = geometry["walls"].get(top_wall_key)
    if not top_walls:
        errors.append({"rule": "layout", "message": f"Unknown wall type: {first_child['type']}"})
        return {"leaves": leaves, "errors": errors, "warnings": warnings}

    top_insul = top_walls["top"]
    top_y = top_insul   # absolute Y of the inner ceiling

    # --- 2. Bottom insulation, from the BOTTOMMOST child's own wall type
    last_child = root_node["children"][-1]["node"] if root_node["children"] else None
    if not last_child or last_child["nodeType"] != "leaf":
        errors.append({"rule": "layout", "message": "Last child must be a leaf"})
        return {"leaves": leaves, "errors": errors, "warnings": warnings}

    bottom_wall_key = "refrigerator" if last_child["type"] == "fresh" else last_child["type"]
    bottom_walls = geometry["walls"].get(bottom_wall_key)
    if not bottom_walls:
        errors.append({"rule": "layout", "message": f"Unknown wall type: {last_child['type']}"})
        return {"leaves": leaves, "errors": errors, "warnings": warnings}

    if bottom_walls.get("bottom1") is None:
        errors.append({"rule": "layout",
                        "message": f"Wall definition for type '{last_child['type']}' is missing 'bottom1' thickness for stepped floor calculation."})
        return {"leaves": leaves, "errors": errors, "warnings": warnings}

    # --- 3. Total available internal height (ceiling to lowest internal floor)
    # SOURCE-CODE NOTE: uses `bottomWalls.bottom3 || bottomWalls.bottom1` — i.e.
    # falls back to bottom1 if bottom3 is falsy (undefined OR literally 0).
    # calc_leaf_gross_precise() (Section 14), which does the ACTUAL polygon
    # area calculation for the bottommost compartment, computes its own
    # floorLowerY as `geom.H - walls.bottom3` DIRECTLY — no fallback to
    # bottom1 at all. If bottom3 is ever 0/undefined for a real geometry, this
    # function's totalAvailableHeight (used to distribute ratio-based
    # compartment heights) and the polygon calc's own floorLowerY would
    # DISAGREE, producing a compartment height that doesn't actually match the
    # polygon it gets extruded from.
    floor_lower_y = geometry["H"] - (bottom_walls.get("bottom3") or bottom_walls["bottom1"])
    total_available_height = floor_lower_y - top_y

    # --- 4. Total divider thickness between compartments
    dividers = root_node.get("dividers", [])
    total_divider_h = sum(d.get("thickness", 0) for d in dividers)

    # --- 5. Per-child heights, by height mode
    mode = root_node["children"][0]["heightMode"]
    if mode == "ratio":
        usable_h = total_available_height - total_divider_h
        child_heights = [usable_h * c["heightValue"] for c in root_node["children"]]
    else:   # 'explicit': heights must sum EXACTLY (within DIM_TOL) to the available space
        sum_heights = sum(c["heightValue"] for c in root_node["children"])
        total = sum_heights + total_divider_h
        if abs(total - total_available_height) > DIM_TOL:
            errors.append({
                "rule": "heightBalance_explicit", "nodeId": root_node.get("id"),
                "message": f"Sum of heights ({sum_heights}) + dividers ({total_divider_h}) = {total} != availableHeight ({total_available_height})",
                "childrenSkipped": True,
            })
            return {"leaves": leaves, "errors": errors, "warnings": warnings}   # HARD STOP: no leaves computed at all
        child_heights = [c["heightValue"] for c in root_node["children"]]

    # --- 6. Compute each leaf's volume, walking top to bottom
    y_offset = top_y
    for i, child in enumerate(root_node["children"]):
        child_node = child["node"]
        height = child_heights[i]
        is_bottommost = (i == len(root_node["children"]) - 1)

        if child_node["nodeType"] == "leaf":
            result = calc_leaf_gross_precise(child_node, height, geometry, y_offset, is_bottommost)
            leaves.append(result)
        else:
            errors.append({"rule": "layout", "message": "Nested splits not supported in precise model"})

        y_offset += height
        if i < len(root_node["children"]) - 1:
            y_offset += dividers[i].get("thickness", 0) if i < len(dividers) else 0

    return {"leaves": leaves, "errors": errors, "warnings": warnings}


# ==============================================================================
# SECTION 14 — VOLUME MATH HELPERS  (calc.js)
# ==============================================================================

# --------------------------------------------------- 14a. LEGACY boundary walker
# NOTE: deriveRootSpace()/walkBoundaries()/calc_leaf_gross() below are NOT called
# from anywhere in main.js, thermoUI.js, or traversal.js as reviewed — the live
# Volume-tab path goes exclusively through build_layout_node_for_precise() ->
# traverse_and_compute_precise() -> calc_leaf_gross_precise() (14b). This trio
# appears to be legacy/superseded code, in the same spirit as
# validateHeatLoad.js — kept in the file, exported, but effectively dead on the
# current UI path. It also references a THIRD compartment type, 'flex', never
# seen anywhere else in any reviewed file (heatLoad.js/condenser.js/geometry.js
# only ever handle 'freezer'/'fresh'/'refrigerator').

def derive_root_space(cabinet: dict, layout: dict) -> dict:
    """
    Legacy: computes the internal (W,H,D) usable envelope by subtracting, per
    face, the MAXIMUM wall thickness among whichever compartment types
    actually touch that face (determined by walk_boundaries()) — falling back
    to the max thickness across ALL types if no type is recorded as touching a
    given face at all. Rear and door thicknesses are always the max across all
    types, unconditionally (not face-touching-dependent, since a cabinet only
    has one rear/one door plane regardless of layout).
    """
    external, wall_thicknesses_by_type, air_gap = cabinet["external"], cabinet["wallThicknessesByType"], cabinet.get("airGap")

    boundary_types = {"top": set(), "bottom": set(), "left": set(), "right": set()}
    walk_boundaries(layout, boundary_types, True, True, True, True)

    all_types = ["fresh", "freezer", "flex"]
    effective = {}
    for face in ("top", "bottom", "left", "right"):
        types_for_face = boundary_types[face]
        max_val = 0
        for t in types_for_face:
            val = wall_thicknesses_by_type.get(t, {}).get(face, 0)
            max_val = max(max_val, val)
        if not types_for_face:   # nothing touches this face at all: use the global max as a safe fallback
            for t in all_types:
                val = wall_thicknesses_by_type.get(t, {}).get(face, 0)
                max_val = max(max_val, val)
        effective[face] = max_val

    effective["rear"] = max((wall_thicknesses_by_type.get(t, {}).get("rear", 0) for t in all_types), default=0)
    effective["door"] = max((wall_thicknesses_by_type.get(t, {}).get("door", 0) for t in all_types), default=0)

    return {
        "width": external["width"] - effective["left"] - effective["right"],
        "height": external["height"] - effective["top"] - effective["bottom"],
        "depth": external["depth"] - effective["rear"],
    }


def walk_boundaries(node: dict, boundary: dict, top_most: bool, bottom_most: bool, left_most: bool, right_most: bool):
    """
    Recursively marks which compartment TYPES touch each of the 4 external
    faces. A 'horizontal' split only ever propagates left/right-most flags
    unchanged (every child spans the full width), while top/bottom-most only
    stay true for the first/last child respectively. A 'vertical' split is the
    mirror image: top/bottom-most pass through unchanged to both children,
    while left/right-most are split — left child inherits left_most only,
    right child inherits right_most only. (No 'vertical' node type appears
    anywhere in the currently-reviewed live layout construction — only
    'horizontal' nodes are ever built by build_layout_node_for_precise() —
    so this branch is exercised only by the legacy derive_root_space() path,
    if anything still calls it.)
    """
    if node["nodeType"] == "leaf":
        if top_most: boundary["top"].add(node["type"])
        if bottom_most: boundary["bottom"].add(node["type"])
        if left_most: boundary["left"].add(node["type"])
        if right_most: boundary["right"].add(node["type"])
    elif node["nodeType"] == "horizontal":
        children = node["children"]
        for i, child in enumerate(children):
            is_first, is_last = (i == 0), (i == len(children) - 1)
            walk_boundaries(child["node"], boundary, top_most and is_first, bottom_most and is_last, left_most, right_most)
    elif node["nodeType"] == "vertical":
        walk_boundaries(node["left"], boundary, top_most, bottom_most, True, False)
        walk_boundaries(node["right"], boundary, top_most, bottom_most, False, True)


def calc_leaf_gross(leaf: dict, space: dict) -> dict:
    """Legacy: simple cuboid volume = width * height * depth, no stepped-floor
    correction at all."""
    gross = space["width"] * space["height"] * space["depth"] * settings["mm3ToL"]
    return {"leafId": leaf["id"], "gross": gross}


def format_leaf_display(leaf: dict) -> dict:
    return {"gross": round_for_display(leaf["gross"], "L"), "grossCuft": round_for_display(to_cuft(leaf["gross"]), "cuft")}


def format_totals_display(totals: dict) -> dict:
    return {"gross": round_for_display(totals["gross"], "L"), "grossCuft": round_for_display(to_cuft(totals["gross"]), "cuft")}


def to_cuft(litres: float) -> float:
    return litres * settings["lToCuft"]


def round_for_display(val: float, unit: str) -> float:
    precision = settings["displayPrecisionCuft"] if unit == "cuft" else settings["displayPrecisionL"]
    return round(val * (10 ** precision)) / (10 ** precision)


# --------------------------------------------------- 14b. PRECISE leaf volume
# This is the function underneath EVERY volume figure shown anywhere in the
# UI — the real implementation of the stepped-floor polygon geometry that
# Section 11's schematic drawing describes visually, and that Section 9's
# compute_obstacle_volumes() assumes when clipping obstacle heights against
# `floor_raised_y`.

def calc_leaf_gross_precise(leaf_node: dict, height: float, geom: dict, comp_top_y: float, is_bottommost: bool) -> dict:
    raw_type = leaf_node["type"]
    wall_key = "refrigerator" if raw_type == "fresh" else raw_type
    walls = geom["walls"].get(wall_key)
    if not walls:
        raise ValueError(f"Unknown wall type: {raw_type} (mapped to {wall_key})")

    inner_w = geom["W"] - walls["left"] - walls["right"]

    rear_x = walls["rear"]
    front_x = geom["D"]   # door insulation is handled externally (not subtracted from the internal depth here)

    if not is_bottommost:
        # Upper compartment(s): plain rectangular cross-section.
        inner_d = front_x - rear_x
        area = height * inner_d
    else:
        # Bottommost compartment: polygon area via the Shoelace formula, to
        # correctly capture the angled compressor-step cutout.
        Hb = geom["Hb"]
        t_rb1, t_rb2, t_rb3 = walls["bottom1"], walls["bottom2"], walls["bottom3"]

        floor_raised_y = geom["H"] - Hb - t_rb1   # top of the compressor step, inside the insulation
        floor_lower_y = geom["H"] - t_rb3          # lowest internal floor line (NO fallback to bottom1 here —
                                                     # see the Section 13 mismatch note against traversal.js)

        # Raw (exterior) compressor-step corner coordinates
        x_top_cb, y_top_cb = geom["Db1"], geom["H"] - Hb
        x_bottom_cb, y_bottom_cb = geom["Db2"], geom["H"]

        cb_dx, cb_dy = x_bottom_cb - x_top_cb, y_bottom_cb - y_top_cb
        cb_len = sqrt(cb_dx ** 2 + cb_dy ** 2)

        if cb_len == 0:
            # Degenerate: perfectly vertical step. Treat as a flat floor at the
            # raised level, offset inward by the insulation thickness.
            slope_start_x = slope_end_x = x_top_cb + t_rb2
        else:
            # Unit normal to the step surface, pointing INTO the cabinet interior.
            nx, ny = cb_dy / cb_len, -cb_dx / cb_len
            px, py = x_top_cb + nx * t_rb2, y_top_cb + ny * t_rb2   # step's top corner, offset inward by t_rb2

            # Parametric line-intersection: where does the offset (insulated)
            # step line cross the raised-floor Y, and the lower-floor Y?
            t_start = (floor_raised_y - py) / cb_dy
            slope_start_x = px + cb_dx * t_start
            t_end = (floor_lower_y - py) / cb_dy
            slope_end_x = px + cb_dx * t_end

        # 6-point clockwise polygon: rear-top, front-top, front-bottom (lower
        # floor), slope-end (lower floor), slope-start (raised floor), rear
        # (raised floor) — closing back up the rear wall to the compartment top.
        poly = [
            [rear_x, comp_top_y],
            [front_x, comp_top_y],
            [front_x, floor_lower_y],
            [slope_end_x, floor_lower_y],
            [slope_start_x, floor_raised_y],
            [rear_x, floor_raised_y],
        ]
        area = polygon_area(poly)

    volume_l = area * inner_w * settings["mm3ToL"]
    return {"leafId": leaf_node["id"], "gross": volume_l}


def polygon_area(vertices: list) -> float:
    """Shoelace formula (Gauss's area formula): sum of cross terms over
    consecutive vertex pairs (wrapping), absolute value, halved. Sign-
    agnostic — works for either winding order."""
    n = len(vertices)
    area = 0.0
    for i in range(n):
        x1, y1 = vertices[i]
        x2, y2 = vertices[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


# ==============================================================================
# SECTION 15 — CONFIG SAVE/LOAD & CSV EXPORT  (io.js)
# ==============================================================================

IO_SCHEMA_VERSION = "2.0"
IO_ACCEPTED_VERSIONS = {"1.0", "2.0"}


def config_to_json(config: dict, name: str = None) -> str:
    now = now_iso()
    out = {
        **config,
        "schemaVersion": IO_SCHEMA_VERSION,
        "meta": {
            "name": name if name is not None else config.get("meta", {}).get("name", "Untitled"),
            "createdAt": config.get("meta", {}).get("createdAt", now),
            "updatedAt": now,
        },
    }
    return json_stringify(out, indent=2)


def config_from_json(json_string: str) -> dict:
    """
    Fail-fast validation gate for loaded config files. Accepts EITHER '1.0' or
    '2.0' as a schema version string — but then unconditionally requires
    `cabinet.geometry` to exist.
    SOURCE-CODE NOTE, likely a real bug: a genuine v1.0-schema file (per
    geometry.js's own upgrade_config(), Section 0c) is shaped as
    `cabinet.external` + `cabinet.wallThicknessesByType`, NOT `cabinet.geometry`
    — v1.0 files don't have a `cabinet.geometry` key at all until AFTER
    upgrade_config() transforms them. This function never calls
    upgrade_config() itself, and main.js's loadBtn handler (Section 9h) calls
    load_config_from_file() -> config_from_json() directly with no upgrade step
    in between, as far as any reviewed file shows. Net effect: a real v1.0 save
    file would pass the schemaVersion check, then immediately fail the very
    next check ("Missing cabinet.geometry boundary constraints") and get
    rejected — meaning v1.0 backward-compatibility is advertised (accepted in
    the version set) but appears non-functional as currently wired, unless
    upgrade_config() is invoked from somewhere not present in the files
    reviewed so far.
    """
    try:
        parsed = json_parse(json_string)
    except Exception as e:
        raise ValueError(f"Parse Exception: Invalid JSON format. {e}")

    if not parsed.get("schemaVersion") or parsed["schemaVersion"] not in IO_ACCEPTED_VERSIONS:
        raise ValueError(f"Schema Violation: Unsupported version v{parsed.get('schemaVersion')}.")

    if not parsed.get("cabinet", {}).get("geometry"):
        raise ValueError("Data Integrity Error: Missing cabinet.geometry boundary constraints.")

    H, W, D = parsed["cabinet"]["geometry"].get("H"), parsed["cabinet"]["geometry"].get("W"), parsed["cabinet"]["geometry"].get("D")
    if not is_number(H) or H <= 0:
        raise ValueError("Boundary Error: Cabinet Height (H) must be > 0.")
    if not is_number(W) or W <= 0:
        raise ValueError("Boundary Error: Cabinet Width (W) must be > 0.")
    if not is_number(D) or D <= 0:
        raise ValueError("Boundary Error: Cabinet Depth (D) must be > 0.")

    return parsed


def load_config_from_file(file) -> dict:
    """Promise-wrapped FileReader.readAsText -> config_from_json(); rejects
    with either a file-read error or whatever config_from_json() raised."""
    ...


def download_config_json(config: dict, default_name: str = None):
    """No-ops if `document` is undefined (SSR-safety guard). Otherwise:
    serializes via config_to_json(), prompts the user for a filename
    (defaulting to default_name, else config.meta.name, else 'config'; a
    cancelled/empty prompt silently aborts the whole save), ensures a .json
    extension, then triggers a Blob-URL download via a synthetic <a> click."""
    ...


def compute_extended_volumes(geometry: dict, leaves: list) -> dict:
    """
    A FOURTH independent re-implementation of the same rails/dikes/PU-volume
    estimation math as main.js's export_volume(), display_precise_results(),
    and build_comparison_table()'s get_ext() (Section 9). Matches get_ext() in
    hard-coding mm3ToL=1e-6 rather than reading settings['mm3ToL'].
    *** REAL DIVERGENCE, not just duplication: this version's `cabPUVolL`
    calculation OMITS the divider-PU addition entirely —
        cabPUVolL = extVolL - grossVolume - totalDikesL
    with no `+ dividerPUVolL` term at all, whereas ALL THREE of the main.js
    versions include `+ dividerPUVolL` when `geometry.dividerHasPU` is set.
    Net effect: if the user has divider PU insulation enabled, the "Estimated
    Cabinet PU Volume/Weight" figures in the exported CSV (via resultToCSV,
    below) will NOT match the figures shown live in the Volume-tab UI or the
    slot-comparison table — a genuine, user-visible inconsistency between the
    on-screen numbers and the downloaded file. ***
    """
    comps = geometry.get("_compartments", [])
    special = geometry.get("special", {})
    mm3_to_l = 1e-6

    per_comp_rails_dikes_l = _rails_dikes_per_compartment(comps, geometry, special)   # same formula as Section 9, hard-coded mm3ToL here too
    adjusted = [{**leaf, "gross": max(0, leaf["gross"] - (per_comp_rails_dikes_l[i] if i < len(per_comp_rails_dikes_l) else 0))}
                for i, leaf in enumerate(leaves or [])]

    freezer_idx = next((i for i, c in enumerate(comps) if c["type"] == "freezer"), -1)
    fresh_idx = next((i for i, c in enumerate(comps) if c["type"] == "fresh"), -1)
    freezer_gross = adjusted[freezer_idx].get("gross", 0) if freezer_idx >= 0 else 0
    fresh_gross = adjusted[fresh_idx].get("gross", 0) if fresh_idx >= 0 else 0
    gross_volume = sum(l.get("gross", 0) for l in adjusted)

    obs = geometry.get("obstacles", {})
    divider_thick = geometry.get("dividerThickness", 20)
    Hb = geometry.get("Hb", 0)
    bottom1 = geometry.get("walls", {}).get("freezer", {}).get("bottom1",
                geometry.get("walls", {}).get("refrigerator", {}).get("bottom1", 40))
    floor_raised_y = geometry["H"] - Hb - bottom1

    freezer_comp = comps[freezer_idx] if freezer_idx >= 0 else (comps[0] if comps else None)
    freezer_is_bottommost = len(comps) == 1 or freezer_idx == len(comps) - 1
    freezer_top_world = get_comp_top_world_y_for(comps, max(freezer_idx, 0), divider_thick)
    f_height = (clamp(0, freezer_comp["height"], floor_raised_y - freezer_top_world)
                if (freezer_is_bottommost and freezer_comp) else (freezer_comp["height"] if freezer_comp else 0))
    f_inner_w = (geometry["W"] - freezer_comp["left"] - freezer_comp["right"]) if freezer_comp else 0
    evaporator_l = obs.get("evapDepth", 85) * f_height * f_inner_w * mm3_to_l

    fresh_comp = comps[fresh_idx] if fresh_idx >= 0 else (comps[0] if comps else None)
    is_top_freezer = fresh_idx > 0
    fresh_top_world = get_comp_top_world_y_for(comps, max(fresh_idx, 0), divider_thick)
    available_rear_h = (clamp(0, fresh_comp["height"], floor_raised_y - fresh_top_world)
                         if (is_top_freezer and fresh_comp) else (fresh_comp["height"] if fresh_comp else 0))
    ctrl_h_eff = min(obs.get("ctrlBoxH", 150), available_rear_h)
    rshower_h_eff = clamp(0, obs.get("rshowerH", 700), available_rear_h - ctrl_h_eff)
    control_box_l = ctrl_h_eff * obs.get("ctrlBoxW", 500) * obs.get("ctrlBoxL", 100) * mm3_to_l
    rshower_l = rshower_h_eff * obs.get("rshowerW", 500) * obs.get("rshowerL", 50) * mm3_to_l

    freezer_total = max(0, freezer_gross - evaporator_l)
    fresh_total = max(0, fresh_gross - control_box_l - rshower_l)
    total_volume = freezer_total + fresh_total

    fdoor_pu_l, rdoor_pu_l, total_dikes_l = pu_door_estimate(comps, geometry, special, mm3_to_l)   # same per-door loop as Section 9e
    ext_vol_mm3 = geometry["H"] * geometry["W"] * geometry["D"]
    cutout_vol_mm3 = geometry["Hb"] * (geometry["Db1"] + geometry["Db2"]) / 2 * geometry["W"]
    ext_vol_l = (ext_vol_mm3 - cutout_vol_mm3) * mm3_to_l

    cab_pu_l = ext_vol_l - gross_volume - total_dikes_l   # <-- no dividerPUVolL term (see note above)

    return {"freezerGross": freezer_gross, "freshGross": fresh_gross, "grossVolume": gross_volume,
            "freezerTotal": freezer_total, "freshTotal": fresh_total, "totalVolume": total_volume,
            "cabPUVolL": cab_pu_l, "fdoorPUVolL": fdoor_pu_l, "rdoorPUVolL": rdoor_pu_l,
            "cabPUweight": cab_pu_l * 32 / 1000, "fdoorPUweight": fdoor_pu_l * 32 / 1000, "rdoorPUweight": rdoor_pu_l * 32 / 1000}


def result_to_csv(cached_state: dict, config_name: str) -> str:
    """
    Builds the full downloadable CSV report. Volumes/PU come from
    compute_extended_volumes() above (with its dividerPUVolL omission baked
    in). The energy-rank threshold ladder here is IDENTICAL to main.js's
    get_rank() (Section 9i: 0.45/0.55/0.65/0.75 bands, else 'OUT OF RANKING',
    no 0.85 band) — matching main.js but NOT matching thermoUI.js's
    display_results() version (Section 10n), which has the extra 0.85 band
    and its own undefined-above-0.85 gap. So across the whole codebase there
    are 3 rank calculators total: 2 that agree (main.js, io.js) and 1 that
    diverges (thermoUI.js).
    Output format: a flat list of [label, value] row pairs (with literal
    '-------' and '======' visual divider rows interspersed), joined with
    commas per row and newlines between rows — a minimal, unstructured CSV
    (no header row, no per-section column alignment).
    """
    if not cached_state:
        return "No calculation state available\n"

    config = cached_state["config"]
    vols = cached_state.get("volumes", {})
    thermal = cached_state.get("thermal", {}) or {}
    geom = config["cabinet"]["geometry"]
    tr = thermal.get("results", {}) or {}
    te = thermal.get("energy", {}) or {}
    comp, hl, evap = tr.get("compressor", {}), tr.get("heatLoads", {}), tr.get("evapDetails", {})

    ext = compute_extended_volumes(geom, vols.get("leaves"))

    TF = config.get("fixedTemps", {}).get("TF", -18)
    monthly_e = te.get("EnergyConsumption_kWhMonth", 0)
    AV = ext["freezerTotal"] * (25 - TF) / 21 + ext["freshTotal"]
    ES_27, ES_29, ES_31 = AV * 0.57 + 800 * 0.9, AV * 0.57 + 800 * 0.8, AV * 0.57 + 800 * 0.6
    IEE_27, IEE_29, IEE_31 = (monthly_e * 12) / ES_27, (monthly_e * 12) / ES_29, (monthly_e * 12) / ES_31

    def get_rank(iee):
        if not iee or is_nan(iee):
            return "OUT OF RANKING"
        if iee <= 0.45: return "A"
        if iee <= 0.55: return "B"
        if iee <= 0.65: return "C"
        if iee <= 0.75: return "D"
        return "OUT OF RANKING"

    fmt = lambda v: f"{v:.2f}" if v is not None and not is_nan(v) else "--"

    rows = [
        ["Calculated Volumes:"], ["Gross Volume:"],
        ["Freezer Gross", fmt(ext["freezerGross"])], ["Fresh Gross", fmt(ext["freshGross"])],
        ["Gross Volume", fmt(ext["grossVolume"])], ["-------------------------"],
        ["Total Volume"], ["Freezer Total", fmt(ext["freezerTotal"])], ["Fresh Total", fmt(ext["freshTotal"])],
        ["Total Volume", fmt(ext["totalVolume"])], ["-------------------------"],
        ["PU Volume Estimation"],
        ["Estimated Cabinet PU Volume", fmt(ext["cabPUVolL"])],
        ["Estimated F-Door PU Volume", fmt(ext["fdoorPUVolL"])],
        ["Estimated R-Door PU Volume", fmt(ext["rdoorPUVolL"])], ["-------------------------"],
        ["PU Weight Estimation"],
        ["Estimated Cabinet PU Weight", fmt(ext["cabPUweight"])],
        ["Estimated F-Door PU Weight", fmt(ext["fdoorPUweight"])],
        ["Estimated R-Door PU Weight", fmt(ext["rdoorPUweight"])], ["=================="],
        ["Operating Points:"],
        ["Condensing temp TC", fmt(tr.get("TC"))], ["Subcool temp Tsubcool", fmt(tr.get("Tsubcool"))],
        ["Evaporating temp TE", fmt(tr.get("TE"))], ["Mixed inlet T1", fmt(evap.get("T1"))],
        ["Evap. outlet T2", fmt(tr.get("T2"))], ["Fan out Temp T3", fmt(tr.get("T3"))],
        ["Running Ratio PR", fmt(tr.get("PR"))], ["--------------------------"],
        ["Compressor Details:"],
        ["Evap. pressure Pe", fmt(comp.get("Pe"))], ["Cond. pressure Pc", fmt(comp.get("Pc"))],
        ["Vol. efficiency etaV", fmt(comp.get("etaV"))], ["Cooling capacity", fmt(comp.get("coolingCapacity"))],
        ["Input power", fmt(comp.get("inputPower"))], ["COP", fmt(comp.get("COP"))],
        ["Required Compressor RPM", f"{tr['RPM']:.0f}" if tr.get("RPM") is not None else "--"],
        ["Mass flow", fmt(comp.get("massFlow"))], ["--------------------------"],
        ["Energy Consumption:"],
        ["Daily energy", fmt(te.get("EnergyConsumption_kWhDay"))],
        ["Monthly energy", fmt(te.get("EnergyConsumption_kWhMonth"))],
        ["energy Rank:"], ["Rank_27", get_rank(IEE_27)], ["Rank_29", get_rank(IEE_29)], ["Rank_31", get_rank(IEE_31)],
        ["--------------------------"],
        ["Heat Loads (W):"],
        ["QF - Freezer compartment", fmt(hl.get("QF"))], ["QR - Refrigerator compartment", fmt(hl.get("QR"))],
        ["QEV - Evaporator total", fmt(hl.get("QEV"))], ["Fan load", fmt(hl.get("fanLoad"))],
        ["Defrost load", fmt(hl.get("defrostLoad"))], ["Total load", fmt(hl.get("totalLoad"))],
        ["--------------------------"],
        ["Airflow:"],
        ["Calculated Fan Air Speed", fmt(tr.get("fanAirSpeed"))], ["Calculated airflow", fmt(tr.get("fanAirflow"))],
        ["Freezer flow (MF)", fmt(tr.get("MF"))], ["Refrigerator flow (MR)", fmt(tr.get("MR"))],
        ["--------------------------"],
        ["Evaporator Performance:"],
        ["Surface area", fmt(evap.get("area"))], ["Air speed", fmt(evap.get("v"))],
        ["Heat transfer coeff alpha", fmt(evap.get("alpha"))], ["LMTD", fmt(evap.get("LMTD"))],
        ["Evap. capacity (calculated)", fmt(evap.get("Qevap"))],
    ]
    return "\n".join(",".join(str(cell) for cell in row) for row in rows)


def download_results_csv(cached_state: dict, config_name: str, filename: str = None):
    """No-ops if `document` is undefined. Builds the CSV via result_to_csv(),
    then the same Blob-URL synthetic-<a>-click download pattern as
    download_config_json(). Default filename is `{config_name or 'results'}.csv`."""
    ...
# ==============================================================================
# PART II — VERIFICATION STATUS & CROSS-CUTTING FINDINGS
# ==============================================================================
"""
VERIFIED against actual source, verbatim logic: compressorManager.js, settings.js,
main.js, thermoUI.js, schematic.js, graphUI.js, traversal.js, calc.js, io.js.

NOT REVIEWED (referenced but not provided): geometry.js's upgrade_config()
CALLERS — i.e. whoever, if anyone, actually invokes it on a loaded v1.0 file
(see finding #17 below; not present in any file reviewed so far).

DOM-heavy sections (compartment UI templating, modal HTML construction, canvas
pixel-drawing sequences) are described at a functional level with `...` bodies
rather than transcribed statement-by-statement, per your instruction — every
piece of actual math, control flow, and state-mutation logic is transcribed in
full; only literal HTML template strings and pure event-wiring boilerplate are
summarized.

------------------------------------------------------------------------------
CROSS-CUTTING FINDINGS (Part II, in addition to Part I's list):

9.  FOUR independently-written re-implementations of the same rails/dikes and
    PU-volume-estimation formulas exist across the codebase: main.js's
    export_volume(), display_precise_results(), and build_comparison_table()'s
    internal get_ext() (Section 9), plus io.js's compute_extended_volumes()
    (Section 15). The three main.js versions agree with each other; io.js's
    version has a REAL divergence, not just duplication — see finding #16 below.
    get_ext() and compute_extended_volumes() both hard-code mm3ToL=1e-6 instead
    of reading settings['mm3ToL'] like the other two (currently equal in value,
    but would silently diverge if the setting were ever changed).

10. THREE independently-written energy-efficiency RANK calculators exist, and
    they don't all agree: main.js's get_rank() (Section 9i) and io.js's
    result_to_csv() (Section 15) use IDENTICAL threshold ladders (0.45/0.55/
    0.65/0.75, else 'OUT OF RANKING', no band above 0.75) — those two agree.
    thermoUI.js's display_results() (Section 10n) diverges: it adds an extra
    `IEE <= 0.85` band that ALSO maps to 'OUT OF RANKING', but leaves IEE > 0.85
    producing no rank string at all (a real gap, not just a cosmetic
    difference). Also: display_results() computes an `Ann_EC = dailyEnergy *
    365` value that goes entirely unused — the IEE math underneath still uses
    monthly*12, not Ann_EC — suggesting Ann_EC is dead/vestigial code from an
    earlier version.

11. THREE different Damping-ratio ("Damp") defaults exist in the codebase:
    solver.js's `electrical.get('Damp', 1.0)` (Section 5b), thermoUI.js's
    module-level `thermal_advanced = {..., Damp: 0.6}` (Section 10), and
    saveThermalSettings()'s own fallback `Damp: 1.0` if the modal field is
    unparseable (Section 10). In practice the UI's 0.6 is what reaches the
    solver on a fresh install, since it's always explicitly included in the
    electrical config passed down — the solver's own 1.0 default is dead code
    on the live UI path, same pattern as several Part I findings.

12. Inverter volumetric efficiency (etaV) is computed THREE separate ways
    across the codebase depending on code path: (a) never, for inverter mode
    inside solveInner/evaluateCompressorSafely itself — Section 5b explicitly
    returns `VolumetricEfficiency: None`; (b) the constant-speed polynomial in
    compressor_power() (Section 4c), unrelated to inverters; (c) a bespoke
    manual recomputation inside thermoUI.js's display_results() (Section 10n)
    using a HARD-CODED 32.2C suction-temperature basis — different from the
    SUCTION_TEMP_C=30 constant used everywhere else in Sections 4-5. This
    display-only etaV is cosmetic (doesn't feed back into the solve) but uses
    a genuinely different reference temperature than the rest of the engine.

13. handle_inverter_run() (Section 10) refits the ENTIRE inverter compressor
    model (Ridge regression + cross-validated grid search, Section 4d) from
    scratch on every single button click, then immediately persists the
    freshly-refit model back into the compressor catalog via
    save_compressors() — there's no caching or dirty-check against whether the
    underlying data points actually changed since the last run.

14. compressorManager.js's ensureArrays()-based schema upgrade is bypassed in
    exactly one path: thermoUI.js's set_thermal_state() (Section 10), which
    overwrites an existing catalog entry via a raw localStorage write when
    restoring a loaded config's saved compressor — every other mutation path
    (loadCompressors, addCompressor, deleteCompressor+addCompressor in the
    edit flow) goes through ensureArrays() first.

15. traverse_and_compute_precise() (Section 13) computes the bottommost
    compartment's `floorLowerY` as `geom.H - (walls.bottom3 || walls.bottom1)`
    — falling back to bottom1 if bottom3 is falsy — purely to determine
    totalAvailableHeight for distributing ratio-based compartment heights. But
    calc_leaf_gross_precise() (Section 14b), which does the ACTUAL polygon-area
    volume calculation for that same compartment, computes its own
    `floorLowerY` as `geom.H - walls.bottom3` DIRECTLY, with no fallback at
    all. If bottom3 is ever 0/undefined for a real geometry, these two
    functions would disagree about where the lower floor line is — the
    compartment's assigned HEIGHT (from traversal) and the polygon it actually
    gets extruded into (from calc_leaf_gross_precise) would be built against
    two different floor lines.

16. io.js's compute_extended_volumes() (Section 15) — used only for CSV
    export — OMITS the divider-PU-volume addition (`+ dividerPUVolL`) that all
    THREE of main.js's rails/dikes/PU implementations include when
    `geometry.dividerHasPU` is set. This is a genuine, user-visible
    inconsistency: with divider PU insulation enabled, the "Estimated Cabinet
    PU Volume/Weight" numbers shown live in the Volume tab (and in the slot
    comparison table) will NOT match what's in the downloaded CSV.

17. io.js's config_from_json() (Section 15) accepts schemaVersion '1.0' as
    valid, but then unconditionally requires `cabinet.geometry` to be present
    — a key that only exists AFTER geometry.js's upgrade_config() (Section 0c)
    has transformed a genuine v1.0 file (which is shaped as `cabinet.external`
    + `cabinet.wallThicknessesByType` instead). config_from_json() never calls
    upgrade_config() itself, and main.js's Load-button handler (Section 9h)
    calls load_config_from_file() -> config_from_json() directly with no
    upgrade step visible in any file reviewed. Net effect: v1.0 backward
    compatibility is advertised (accepted in the version set) but appears
    non-functional as currently wired — a real v1.0 save file would fail the
    very next validation check and get rejected — unless upgrade_config() is
    invoked from somewhere not present in the files reviewed so far.

18. calc.js's derive_root_space() / walk_boundaries() / calc_leaf_gross()
    (Section 14a) — a simple-cuboid volume path referencing a third
    compartment type, 'flex', never seen anywhere else in the codebase —
    appear to be legacy/superseded code: nothing in main.js, thermoUI.js, or
    traversal.js as reviewed calls them. The live Volume-tab path exclusively
    uses calc_leaf_gross_precise() via traverse_and_compute_precise(). Same
    "real but dead" pattern as validateHeatLoad.js (Part I) — kept in the
    file and exported, but not reachable from the current UI.
"""
