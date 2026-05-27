(base) PS D:\\refrigerator-volume-calculator> node validate.mjs

════════════════════════════════════════════════════════════════

1. refrigerant.js — R-600a property equations
════════════════════════════════════════════════════════════════
ℹ️        Saturation pressures (bar)
✅ PASS  satPressure(TE\_rated=-23.3): 0.639918  (ref 0.639918, Δ0.0000%)
✅ PASS  satPressure(TC\_rated=54.4): 7.835777  (ref 7.835777, Δ0.0000%)
✅ PASS  satPressure(TE\_op=-25.265): 0.586591  (ref 0.586591, Δ0.0000%)
✅ PASS  satPressure(TC\_op=40.906): 5.602337  (ref 5.602337, Δ0.0000%)
ℹ️        Specific volume (m³/kg)
✅ PASS  specificVolume(32.2, Pe\_rated) \[rated]: 0.686006  (ref 0.686006, Δ0.0000%)
✅ PASS  specificVolume(T0=30, Pe\_op) \[operating]: 0.743520  (ref 0.743520, Δ0.0000%)
ℹ️        Vapour enthalpy (kcal/kg)
✅ PASS  vaporEnthalpy(32.2, Pe\_rated) = Hout: 174.079266  (ref 174.079266, Δ0.0000%)
✅ PASS  vaporEnthalpy(TE\_op, Pe\_op)  = Hevout: 152.440100  (ref 152.440100, Δ0.0000%)
ℹ️        Liquid enthalpy (kcal/kg)
✅ PASS  liquidEnthalpy(32.2) = Hin: 94.323476  (ref 94.323476, Δ0.0000%)
✅ PASS  liquidEnthalpy(Tsub=30.906) = Hevin: 93.532774  (ref 93.532774, Δ0.0000%)
ℹ️        getRefrigerantFunctions dispatch – R-600a
✅ PASS  getRefrigerantFunctions returns object with satPressure
✅ PASS  dispatch: satPressure(-23.3) via rf object: 0.639918  (ref 0.639918, Δ0.0000%)
ℹ️        getRefrigerantFunctions dispatch – R-134a (smoke test, not Excel-verified)
✅ PASS  getRefrigerantFunctions("R-134a") returns object
✅ PASS  R-134a satPressure(-23.3) plausible range (bar): 1.171334 in \[0.8, 1.4]  got 1.171334

════════════════════════════════════════════════════════════════
2. compressor.js — 54H EGX80CLC polynomial model
════════════════════════════════════════════════════════════════
ℹ️        Volumetric efficiency at rated corner (TC=54.4, TE=-23.3)
✅ PASS  ηv at rated corner: 0.757824  (ref 0.757824, Δ0.0000%)
ℹ️        compressorState at rated corner (no T0 → falls back to T\_suction=32.2)
✅ PASS  etaV  (rated): 0.757824  (ref 0.757824, Δ0.0000%)
✅ PASS  massFlow G (rated): 2.141286  (ref 2.141286, Δ0.0000%)
❌ FAIL  coolingCapacity (rated): got 109.464456, ref 170.779941, Δ35.903% 

✅ PASS  inputPower W (rated): 110.478433  (ref 110.478433, Δ0.0000%)
ℹ️        compressorState at operating point (T0=30 used for specific volume)
✅ PASS  etaV  (operating): 0.796043  (ref 0.796043, Δ0.0000%)
✅ PASS  massFlow G (operating): 2.075287  (ref 2.075287, Δ0.0000%)
✅ PASS  coolingCapacity Qcomp (operating): 122.249625  (ref 122.249625, Δ0.0000%)
✅ PASS  inputPower Wcomp (operating): 98.410647  (ref 98.410647, Δ0.0000%)
ℹ️        Key enthalpies returned
✅ PASS  h\_evap\_out at TE\_op: 152.440100  (ref 152.440100, Δ0.0000%)
✅ PASS  h\_liquid at Tsub: 93.532774  (ref 93.532774, Δ0.0000%)
ℹ️        useMap flag absent on 54H → polynomial path used
✅ PASS  SJ54H\_COMPONENTS.compressor.useMap is falsy

════════════════════════════════════════════════════════════════
3. compressorMap.js — pv73 SQ47LAEG map + bilinear interpolation
════════════════════════════════════════════════════════════════
ℹ️        Grid boundary: exact grid-point lookup (no interpolation, tx=ty=0)
✅ PASS  Q at (TC=40, TE=-24) \[grid point]: 123.770000  (ref 123.770000, Δ0.0000%)
✅ PASS  W at (TC=40, TE=-24) \[grid point]: 62.420000  (ref 62.420000, Δ0.0000%)
✅ PASS  Q at (TC=45, TE=-20) \[grid point]: 147.950000  (ref 147.950000, Δ0.0000%)
✅ PASS  W at (TC=45, TE=-20) \[grid point]: 99.440000  (ref 99.440000, Δ0.0000%)
ℹ️        Grid boundary: TC=35, TE=-32 (corner point)
✅ PASS  Q at (TC=35, TE=-32) \[corner]: 82.750000  (ref 82.750000, Δ0.0000%)
✅ PASS  W at (TC=35, TE=-32) \[corner]: 43.400000  (ref 43.400000, Δ0.0000%)
ℹ️        Bilinear interpolation midpoint (TC=42.5, TE=-25 – between grid cells)
✅ PASS  Q at (TC=42.5, TE=-25) in plausible range: 116.510000 in \[100, 145]  got 116.510000
✅ PASS  W at (TC=42.5, TE=-25) in plausible range: 71.907500 in \[60, 120]  got 71.907500
ℹ️        Clamping: TC=60 (above grid max 55) → clamped to TC=55
✅ PASS  Clamped TC=60 equals TC=55 result: 142.080000  (ref 142.080000, Δ0.0000%)
ℹ️        useMap flag set on pv73 components
✅ PASS  SJ\_PV73K\_COMPONENTS.compressor.useMap === true

════════════════════════════════════════════════════════════════
4. heatLoad.js — 54H top-freezer heat loads at Excel converged state
════════════════════════════════════════════════════════════════
ℹ️        Total heat load components vs Excel SIZE totals
✅ PASS  QF  (kcal/h): 27.358180  (ref 27.358180, Δ0.0000%)
❌ FAIL  QR  (kcal/h): got 35.877759, ref 39.405077, Δ8.951%
✅ PASS  QEV (kcal/h): 5.433042  (ref 5.433042, Δ0.0000%)
ℹ️        QEV sub-components
✅ PASS  QEV\_cond (EVA BACK panel): 4.366482  (ref 4.366482, Δ0.0000%)
✅ PASS  fanLoad: 1.066560  (ref 1.066560, Δ0.0000%)
✅ PASS  defrostLoad (0 defrost time): 0.000000  (ref 0.000000, Δ0.0000%)
ℹ️        Sanity: QF > 0 (freezer always gains heat from outside)
✅ PASS  QF > 0
ℹ️        Sanity: QR > 0 (refrigerator always gains heat from outside)
✅ PASS  QR > 0
ℹ️        Condenser wall temperatures (derived inside heatLoad)
✅ PASS  T\_wallSide (Excel SIZE Cab Side = 33.475): 33.474602  (ref 33.474602, Δ0.0000%)
✅ PASS  T\_wallBack (Excel SIZE Back cab = 32.686): 32.685651  (ref 32.685651, Δ0.0000%)
ℹ️        (Wall temps are internal to heatLoad — above confirms the formula is consistent)
ℹ️        K\_side and K\_back from PIPEPITCH (catches XOR ^ vs power \*\* bug)
✅ PASS  K\_side at pitch=150mm: 5.395000  (ref 5.395000, Δ0.0000%)
✅ PASS  K\_back at pitch=200mm: 4.170000  (ref 4.170000, Δ0.0000%)

════════════════════════════════════════════════════════════════
5. heatLoad.js — pv73 bottom-freezer heat loads at Excel trial state
════════════════════════════════════════════════════════════════
ℹ️        pv73 Excel is a TRIAL state (TC=48 hardcoded; F3 ≠ 0).
ℹ️        Effective TC for wall temps = T0 + X3 = 25 + 5.412 = 30.412°C.
ℹ️        We use TC\_eff=30.412 to match Excel SIZE panel calculations.
❌ FAIL  QF  (kcal/h): got 26.856680, ref 25.565059, Δ5.052%
❌ FAIL  QR  (kcal/h): got 17.787068, ref 24.750050, Δ28.133%
✅ PASS  QEV (kcal/h): 4.709591  (ref 4.709591, Δ0.0000%)
ℹ️        Orientation sanity checks (bottom-freezer physics)
✅ PASS  QR > 0  (top compartment gains heat from outside)
✅ PASS  QEV > 0 (evaporator back panel gains heat)
✅ PASS  QF > 0  (net freezer heat gain)

════════════════════════════════════════════════════════════════
6. condenser.js — computeCondenserAreas for both models
════════════════════════════════════════════════════════════════
ℹ️        ─── 54H (top-freezer) ───
ℹ️        Side/back area calculations
✅ PASS  sideArea (m²): 1.901600  (ref 1.901600, Δ0.0000%)
✅ PASS  backArea (m²): 0.795200  (ref 0.795200, Δ0.0000%)
ℹ️        KA products – catches K\_side/K\_back key-name mismatch (undefined → NaN)
✅ PASS  sideKA = K\_side × sideArea: 10.259132  (ref 10.261000, Δ0.0182%)
✅ PASS  backKA = K\_back × backArea: 3.315984  (ref 3.316000, Δ0.0005%)
ℹ️        Condenser lengths – catches missing freezerPosition dispatch
✅ PASS  RFrontLength  = Hr×2/1000 (m): 2.260000  (ref 2.260000, Δ0.0000%)
✅ PASS  FRPartitionLength (m): 0.690000  (ref 0.690000, Δ0.0000%)
✅ PASS  FFrontLength  = Hf×2/1000 (m): 1.100000  (ref 1.100000, Δ0.0000%)
ℹ️        ─── pv73 (bottom-freezer) ───
ℹ️        Requires freezerPosition dispatch: RFront→Hf×2, FFront→Hr×2, FRPartition→(W-tFtop-tFleft)
❌ FAIL  RFrontLength  = Hf×2/1000 (m) \[bottom-freezer]: got 2.096000, ref 1.492000, Δ40.483%
❌ FAIL  FRPartitionLength  (m) \[bottom-freezer]: got 0.683000, ref 0.681000, Δ0.294%
❌ FAIL  FFrontLength  = Hr×2/1000 (m) \[bottom-freezer]: got 1.492000, ref 2.096000, Δ28.817%
ℹ️        pv73 side/back areas (smoke check)
✅ PASS  pv73 sideArea (m²) in \[1.5, 3.0]: 2.244228 in \[1.5, 3]  got 2.244228
✅ PASS  pv73 backKA plausible: 3.587655 in \[2, 6]  got 3.587655

════════════════════════════════════════════════════════════════
7. condenser.js — calcQCout vs Excel MAIN condenser heat exchange
════════════════════════════════════════════════════════════════
ℹ️        Total QCout vs Excel MAIN H40 = 171.236 kcal/h
❌ FAIL  QCout total (kcal/h): got 172.812741, ref 171.236120, Δ0.921%
ℹ️        Diagnosing QCout deviation — checking individual components:
ℹ️          RFront with k\_RFront2×(TC-TR) \[CORRECT]: 11.237961  (ref 11.237961)
ℹ️          RFront with k\_RFront2×(TC-TF) \[BUG]    : 12.814582
ℹ️          If QCout ≈ 171.236120 → code is correct
ℹ️          If QCout ≈ 172.812741     → k\_RFront2 uses dT\_TC\_TF instead of dT\_TC\_TR
ℹ️          If QCout = NaN                 → K\_side or K\_back is undefined (key name mismatch)
ℹ️        Individual QCout components (reference values from Excel MAIN H35–H39)
✅ PASS  R Front component: 11.237961  (ref 11.237961, Δ0.0000%)
✅ PASS  FR Partition component: 6.447523  (ref 6.447523, Δ0.0000%)
✅ PASS  F Front component: 5.507009  (ref 5.507009, Δ0.0000%)
✅ PASS  Side condenser KA×ΔT: 111.881115  (ref 111.881115, Δ0.0000%)
✅ PASS  Back condenser KA×ΔT: 36.162512  (ref 36.162512, Δ0.0000%)
ℹ️        ─── pv73 QCout (bottom-freezer orientation) ───
❌ FAIL  pv73 QCout total (kcal/h): got 101.090256, ref 127.057084, Δ20.437%

════════════════════════════════════════════════════════════════
8. QCin — condenser energy balance at 54H operating point
════════════════════════════════════════════════════════════════
ℹ️        QCin is computed inline in the solver using resolveCompressorState.
ℹ️        Excel MAIN: QCin = G × (Hcond\_in − Hcond\_out)
ℹ️        Excel uses liquidEnthalpy(TC) for Hcond\_out (saturated liquid).
ℹ️        Bug 7 fix uses liquidEnthalpy(Tsub=TC−10) — physically correct but shifts TC.
ℹ️        Hcond\_in (discharge enthalpy at Td=60°C): 182.241348
ℹ️        Hcond\_out at TC=40.906 \[Excel method]:  99.729345  (ref 99.729)
ℹ️        Hcond\_out at Tsub=30.906 \[fixed method]: 93.532774  (ref 93.533)
ℹ️        QCin Excel method: 171.236112  (ref 171.236 — should balance QCout)
ℹ️        QCin fixed method: 184.095777  (higher → solver converges to higher TC)
✅ PASS  Hcond\_in (discharge enthalpy): 182.241348  (ref 182.241348, Δ0.0000%)
✅ PASS  Hcond\_out at TC \[Excel method]: 99.729345  (ref 99.729345, Δ0.0000%)
✅ PASS  Hcond\_out at Tsub \[fixed]: 93.532774  (ref 93.532774, Δ0.0000%)
✅ PASS  QCin\_excel balances QCout (Δ < 0.05 kcal/h): Δ=0.000008
ℹ️        ⚠️  QCin\_fixed vs QCout: Δ=12.859657 kcal/h — expected deviation from Bug 7 fix

════════════════════════════════════════════════════════════════
9. compressor.js — resolveCompressorState dispatch (polynomial vs map)
════════════════════════════════════════════════════════════════
ℹ️        This section requires resolveCompressorState to be exported from compressor.js.
ℹ️        If it crashes, the function is not exported or missing imports.
✅ PASS  resolveCompressorState is exported
ℹ️        Polynomial path (useMap=false, 54H)
✅ PASS  54H dispatch: coolingCapacity: 122.249625  (ref 122.249625, Δ0.0000%)
✅ PASS  54H dispatch: inputPower: 98.410647  (ref 98.410647, Δ0.0000%)
ℹ️        Map path (useMap=true, pv73)
✅ PASS  pv73 compParams.useMap === true
✅ PASS  pv73 dispatch: coolingCapacity at (TC=40,TE=-24): 123.770000  (ref 123.770000, Δ0.0000%)
✅ PASS  pv73 dispatch: inputPower     at (TC=40,TE=-24): 62.420000  (ref 62.420000, Δ0.0000%)

════════════════════════════════════════════════════════════════
10. solver.js — 54H full thermal solver convergence
════════════════════════════════════════════════════════════════
ℹ️        Running solveThermalSystem (fixed TE=-25.27)...
💥 CRASH  EXCEPTION in "10. solver.js — 54H full thermal solver convergence": getRefrigerantFunctions is not defined
at solveThermalSystem (file:///D:/refrigerator-volume-calculator/src/js/engine/thermo/solver.js:125:16)
at file:///D:/refrigerator-volume-calculator/validate.mjs:647:15
at section (file:///D:/refrigerator-volume-calculator/validate.mjs:141:15)

════════════════════════════════════════════════════════════════
11. solver.js — pv73 bottom-freezer solver convergence
════════════════════════════════════════════════════════════════
ℹ️        No exact Excel reference for converged pv73 (TC=48 is a trial value).
ℹ️        Testing: convergence, physical plausibility, bottom-freezer orientation.
ℹ️        Running solveThermalSystem for pv73...
💥 CRASH  EXCEPTION in "11. solver.js — pv73 bottom-freezer solver convergence": getRefrigerantFunctions is not defined
at solveThermalSystem (file:///D:/refrigerator-volume-calculator/src/js/engine/thermo/solver.js:125:16)
at file:///D:/refrigerator-volume-calculator/validate.mjs:727:15
at section (file:///D:/refrigerator-volume-calculator/validate.mjs:141:15)

════════════════════════════════════════════════════════════════
12. solver.js — runThermalAnalysisDynamic TE iteration (54H)
════════════════════════════════════════════════════════════════
ℹ️        Runs 5 outer TE iterations using NTU evaporator model.
ℹ️        TE should converge to near Excel −25.265°C (within ±2°C due to Bug 7 effect).
💥 CRASH  EXCEPTION in "12. solver.js — runThermalAnalysisDynamic TE iteration (54H)": getRefrigerantFunctions is not defined
at solveThermalSystem (file:///D:/refrigerator-volume-calculator/src/js/engine/thermo/solver.js:125:16)
at runThermalAnalysisDynamic (file:///D:/refrigerator-volume-calculator/src/js/engine/thermo/solver.js:160:14)
at file:///D:/refrigerator-volume-calculator/validate.mjs:773:15

════════════════════════════════════════════════════════════════
13. defaultComponents.js — component data integrity
════════════════════════════════════════════════════════════════
ℹ️        ─── SJ54H\_COMPONENTS ───
✅ PASS  Vc = 11.14 cc: 11.140000  (ref 11.140000, Δ0.0000%)
✅ PASS  rpm = 2900: 2900.000000  (ref 2900.000000, Δ0.0000%)
✅ PASS  AW coefficient: 135.175000  (ref 135.175000, Δ0.0000%)
✅ PASS  K\_side 5.395: 5.395000  (ref 5.395000, Δ0.0000%)
✅ PASS  K\_back 4.17: 4.170000  (ref 4.170000, Δ0.0000%)
✅ PASS  sidePipePitch 150mm: 150.000000  (ref 150.000000, Δ0.0000%)
✅ PASS  backPipePitch 200mm: 200.000000  (ref 200.000000, Δ0.0000%)
✅ PASS  subcool 10K: 10.000000  (ref 10.000000, Δ0.0000%)
✅ PASS  fan airflow 59.5 m³/h: 59.500000  (ref 59.500000, Δ0.0000%)
✅ PASS  evapArea 1.754 m²: 1.754000  (ref 1.754000, Δ0.0000%)
ℹ️        ─── SJ\_PV73K\_COMPONENTS ───
✅ PASS  SJ\_PV73K\_COMPONENTS exists
✅ PASS  Vc = 10.17 cc: 10.170000  (ref 10.170000, Δ0.0000%)
✅ PASS  rpm = 2220: 2220.000000  (ref 2220.000000, Δ0.0000%)
✅ PASS  fan airflow 146.4 m³/h: 146.400000  (ref 146.400000, Δ0.0000%)
✅ PASS  evapArea 1.2985 m²: 1.298500  (ref 1.298500, Δ0.0000%)
✅ PASS  freezerPosition = "bottom"
✅ PASS  useMap = true
ℹ️        ─── No cross-contamination between models ───
✅ PASS  54H rpm ≠ pv73 rpm
✅ PASS  54H Vc ≠ pv73 Vc

════════════════════════════════════════════════════════════════
SUMMARY
════════════════════════════════════════════════════════════════
✅ Passed  : 93
❌ Failed  : 12
⚠️  Warnings: 0

Critical failures:

1. coolingCapacity (rated): got 109.464456, ref 170.779941, Δ35.903%
2. QR  (kcal/h): got 35.877759, ref 39.405077, Δ8.951%
3. QF  (kcal/h): got 26.856680, ref 25.565059, Δ5.052%
4. QR  (kcal/h): got 17.787068, ref 24.750050, Δ28.133%
5. RFrontLength  = Hf×2/1000 (m) \[bottom-freezer]: got 2.096000, ref 1.492000, Δ40.483%
6. FRPartitionLength  (m) \[bottom-freezer]: got 0.683000, ref 0.681000, Δ0.294%
7. FFrontLength  = Hr×2/1000 (m) \[bottom-freezer]: got 1.492000, ref 2.096000, Δ28.817%
8. QCout total (kcal/h): got 172.812741, ref 171.236120, Δ0.921%
9. pv73 QCout total (kcal/h): got 101.090256, ref 127.057084, Δ20.437%
10. EXCEPTION in "10. solver.js — 54H full thermal solver convergence": getRefrigerantFunctions is not defined
11. EXCEPTION in "11. solver.js — pv73 bottom-freezer solver convergence": getRefrigerantFunctions is not defined
12. EXCEPTION in "12. solver.js — runThermalAnalysisDynamic TE iteration (54H)": getRefrigerantFunctions is not defined

Known intentional deviations from Excel:
• TC \~1–3°C higher than Excel (Bug 7 fix: Tsub vs TC in QCin h\_liquid)
• ARb3 uses (D−Db2) not Db2 (user confirmed intentional)
• R TOP area uses tRleft not tFleft for top-freezer (ignored)

🔴 FAILURES DETECTED — see list above
════════════════════════════════════════════════════════════════

