// explainHeatLoad.js
// COMPLETE Detailed tracer for the refrigerator heat load model

const PC = {
    surfaceCoefficients: { outside: 6.977, inside: 11.628 },
    insulation: { packing: 0.035 }
};

function lambdaUrethane(T_in, T_out) {
    const T_avg = (T_in + T_out) / 2;
    return 0.0165 + 0.00011 * (T_avg - 25) * 1.16279;
}

function kExterior(thk, T_in, T_out, name) {
    const lam = lambdaUrethane(T_in, T_out);
    const k = 1 / (1 / PC.surfaceCoefficients.outside + 1 / PC.surfaceCoefficients.inside + (thk / 1000) / lam);
    console.log(`      U-Value [${name}] (Thk: ${thk}mm, lam: ${lam.toFixed(4)}): ${k.toFixed(4)} W/(m²·K)`);
    return k;
}

function kInterior(thk, T1, T2, name) {
    const lam = lambdaUrethane(T1, T2);
    const k = 1 / (1 / PC.surfaceCoefficients.inside + 1 / PC.surfaceCoefficients.inside + (thk / 1000) / lam);
    console.log(`      U-Value [${name}] (Thk: ${thk}mm, lam: ${lam.toFixed(4)}): ${k.toFixed(4)} W/(m²·K)`);
    return k;
}

// Data from 73.json
const geom = {
    H: 1800, W: 795, D: 650, Hf: 670, Hr: 945, Hb: 314, Db1: 192, Db2: 217,
    doorGap: 10, packingPos: 15,
    tFtop: 50, tFleft: 80, tFright: 80, tFbottom: 50, tFdoor: 70, tFback: 80, tEvaBack: 85,
    tRtop: 55, tRleft: 55, tRright: 55, tRback: 55, tRdoor: 55,
    tRbottom1: 75, tRbottom2: 80, tRbottom3: 80,
    tFfloor1: 75, tFfloor2: 80, tFfloor3: 80, tRfloor: 75
};

const temps = { T0: 30, TF: -18, TR: 3, TC: 54.4, T2: -20.5, PR: 0.999, TE: -25 };
const PIPEPITCH = { side: 130, back: 0 }; 
const isTopFreezer = false; // Bottom freezer configuration

console.log("==================================================");
console.log(" FULL REFRIGERATOR HEAT LOAD TRACE ");
console.log("==================================================\n");

// --- Condenser Heating Effects ---
console.log(">>> 0. CONDENSER HEATING EFFECTS <<<");
const K_side = 1.0738 - 0.004152 * PIPEPITCH.side + 0.00000482 * Math.pow(PIPEPITCH.side, 2);
const TRise_side = (temps.TC - temps.T0) * K_side;
const T_wallSide = temps.T0 + TRise_side * temps.PR;
const T_compZone = temps.T0 + (temps.TC - temps.T0) * temps.PR;

console.log(`   Side Pipe Pitch: ${PIPEPITCH.side}mm`);
console.log(`   K_side multiplier = ${K_side.toFixed(4)}`);
console.log(`   Side Wall Temp (T_wallSide) = T0 + (TC - T0) * K_side * PR = ${temps.T0} + (${temps.TC} - 30) * ${K_side.toFixed(4)} * ${temps.PR} = ${T_wallSide.toFixed(2)}°C`);
console.log(`   Compressor Zone Temp (T_compZone) = ${T_compZone.toFixed(2)}°C\n`);

let QF = 0;
let QR = 0;

console.log(">>> 1. FREEZER COMPARTMENT (QF) <<<");

// 1. Top
const AFtop = (geom.W - (geom.tFleft + geom.tFright) / 2) * (geom.D - geom.tFback / 2) / 1e6;
const qF_top = kInterior(geom.tFtop, temps.TF, temps.TR, "F-Top (Internal)") * AFtop * (temps.TR - temps.TF);
console.log(`   1. Top Area = ${AFtop.toFixed(4)} m² -> Heat = ${qF_top.toFixed(2)} W`);
QF += qF_top;

// 2. Sides (Heated by condenser!)
const fSideHeight = geom.Hf - (geom.tFtop + geom.tFfloor1) / 2;
const AFleft1 = (fSideHeight * (geom.D - geom.tFback / 2) - (geom.Db1 + geom.Db2) * geom.Hb / 2 - geom.tEvaBack * (fSideHeight - geom.Hb)) / 1e6;
const AFleft2 = (geom.tEvaBack) * (fSideHeight - geom.Hb) / 1e6;
const AFright1 = AFleft1;
const AFright2 = AFleft2;

const qF_sideL1 = kExterior(geom.tFleft, temps.TF, T_wallSide, "F-SideLeft1") * AFleft1 * (T_wallSide - temps.TF);
const qF_sideR1 = kExterior(geom.tFright, temps.TF, T_wallSide, "F-SideRight1") * AFright1 * (T_wallSide - temps.TF);
const qF_sideL2 = kExterior(geom.tFleft, temps.T2, T_wallSide, "F-SideLeft2") * AFleft2 * (T_wallSide - temps.T2);
const qF_sideR2 = kExterior(geom.tFright, temps.T2, T_wallSide, "F-SideRight2") * AFright2 * (T_wallSide - temps.T2);
console.log(`   2. Sides (Exposed to ${T_wallSide.toFixed(1)}°C)`);
console.log(`      AFleft1/Right1 = ${AFleft1.toFixed(4)} m² -> Heat = ${(qF_sideL1 + qF_sideR1).toFixed(2)} W`);
console.log(`      AFleft2/Right2 = ${AFleft2.toFixed(4)} m² -> Heat = ${(qF_sideL2 + qF_sideR2).toFixed(2)} W`);
QF += (qF_sideL1 + qF_sideR1 + qF_sideL2 + qF_sideR2);

// 3. Bottom (Stepped over comp)
const AFb1 = (geom.W - (geom.tFleft + geom.tFright) / 2) * geom.Db1 / 1e6;
const AFb2 = (geom.W - (geom.tFleft + geom.tFright) / 2) * Math.sqrt(geom.Hb * geom.Hb + Math.pow(geom.Db2 - geom.Db1, 2)) / 1e6;
const AFb3 = (geom.W - (geom.tFleft + geom.tFright) / 2) * (geom.D - geom.Db2) / 1e6;
const qF_b1 = kExterior(geom.tFfloor1, temps.TF, T_compZone, "F-Floor1") * AFb1 * (T_compZone - temps.TF);
const qF_b2 = kExterior(geom.tFfloor2, temps.TF, T_compZone, "F-Floor2") * AFb2 * (T_compZone - temps.TF);
const qF_b3 = kExterior(geom.tFfloor3, temps.TF, temps.T0, "F-Floor3") * AFb3 * (temps.T0 - temps.TF);
console.log(`   3. Bottom (Stepped over ${T_compZone.toFixed(1)}°C compressor) -> Heat = ${(qF_b1 + qF_b2 + qF_b3).toFixed(2)} W`);
QF += (qF_b1 + qF_b2 + qF_b3);

// 4. Door & Gasket
const AFdoor = (geom.Hf - geom.doorGap / 2 - 2 * geom.packingPos) * (geom.W - 2 * geom.packingPos) / 1e6;
const AFpackin = ((geom.Hf - 2 * geom.packingPos) + (geom.W - 2 * geom.packingPos)) * 2 / 1000;
const qF_door = kExterior(geom.tFdoor, temps.TF, temps.T0, "F-Door") * AFdoor * (temps.T0 - temps.TF);
const qF_gasket = PC.insulation.packing * AFpackin * (temps.T0 - temps.TF);
console.log(`   4. Door Area = ${AFdoor.toFixed(4)} m² -> Heat = ${qF_door.toFixed(2)} W`);
console.log(`   5. Door Gasket = ${AFpackin.toFixed(4)} m -> Heat = ${qF_gasket.toFixed(2)} W`);
QF += qF_door + qF_gasket;

// 5. Partition DP Condenser Losses
const qF_part1 = (0.1219 * (temps.TC - temps.TF) * temps.PR + 0.07551 * (temps.T0 - temps.TF) * (1 - temps.PR)) * (geom.W - geom.tFleft - geom.tFright) / 1000;
const qF_part2 = (0.0344 * (temps.TC - temps.TF) - 0.031235 * (temps.T0 - temps.TF)) * temps.PR * (geom.Hf * 2 + geom.W) / 1000;
console.log(`   6. Frame/Partition Heaters (DP Condenser) -> Heat = ${(qF_part1 + qF_part2).toFixed(2)} W`);
QF += qF_part1 + qF_part2;

console.log(`\n--- FREEZER PRE-MULTIPLIER = ${QF.toFixed(2)} W ---`);
console.log(`+++ FREEZER FINAL = ${(QF * 1.16279).toFixed(2)} W +++\n`);


console.log(">>> 2. REFRIGERATOR COMPARTMENT (QR) <<<");

// 1. Top
const ARtop = (geom.W - (geom.tRleft + geom.tRright) / 2) * (geom.D - geom.tRback / 2) / 1e6;
const qR_top = kExterior(geom.tRtop, temps.TR, temps.T0, "R-Top") * ARtop * (temps.T0 - temps.TR);
console.log(`   1. Top Area = ${ARtop.toFixed(4)} m² -> Heat = ${qR_top.toFixed(2)} W`);
QR += qR_top;

// 2. Sides
const rH = geom.Hr - (geom.tRtop + geom.tRfloor) / 2;
const ARleft = (rH * (geom.D - geom.tRback / 2)) / 1e6;
const qR_sideL = kExterior(geom.tRleft, temps.TR, T_wallSide, "R-SideLeft") * ARleft * (T_wallSide - temps.TR);
const qR_sideR = kExterior(geom.tRright, temps.TR, T_wallSide, "R-SideRight") * ARleft * (T_wallSide - temps.TR);
console.log(`   2. Sides Area = ${ARleft.toFixed(4)} m² (x2) (Exposed to ${T_wallSide.toFixed(1)}°C) -> Heat = ${(qR_sideL + qR_sideR).toFixed(2)} W`);
QR += qR_sideL + qR_sideR;

// 3. Back
const ARback = (geom.Hr - (geom.tRtop + geom.tRfloor) / 2) * (geom.W - (geom.tRleft + geom.tRright) / 2) / 1e6;
const qR_back = kExterior(geom.tRback, temps.TR, temps.T0, "R-Back") * ARback * (temps.T0 - temps.TR);
console.log(`   3. Back Area = ${ARback.toFixed(4)} m² -> Heat = ${qR_back.toFixed(2)} W`);
QR += qR_back;

// 4. Bottom (Partition)
const ARbottom = (geom.W - (geom.tRleft + geom.tRright) / 2) * (geom.D - geom.tRback / 2) / 1e6;
const qR_bottom = kInterior(geom.tRfloor, temps.TF, temps.TR, "R-Bottom-Partition") * ARbottom * (temps.TR - temps.TF);
console.log(`   4. Bottom Area (Partition) = ${ARbottom.toFixed(4)} m² -> Heat = ${qR_bottom.toFixed(2)} W`);
QR += qR_bottom;

// 5. Door & Gasket
const ARdoor = (geom.Hr - geom.doorGap / 2 - 2 * geom.packingPos) * (geom.W - 2 * geom.packingPos) / 1e6;
const ARpackin = ((geom.Hr - 2 * geom.packingPos) + (geom.W - 2 * geom.packingPos)) * 2 / 1000;
const qR_door = kExterior(geom.tRdoor, temps.TR, temps.T0, "R-Door") * ARdoor * (temps.T0 - temps.TR);
const qR_gasket = PC.insulation.packing * ARpackin * (temps.T0 - temps.TR);
console.log(`   5. Door Area = ${ARdoor.toFixed(4)} m² -> Heat = ${qR_door.toFixed(2)} W`);
console.log(`   6. Door Gasket = ${ARpackin.toFixed(4)} m -> Heat = ${qR_gasket.toFixed(2)} W`);
QR += qR_door + qR_gasket;

// 6. Partition DP Condenser Losses
const qR_part = (0.03322 * (temps.TC - temps.TR) - 0.030267 * (temps.T0 - temps.TR)) * temps.PR * (geom.Hr * 2) / 1000;
console.log(`   7. Frame/Partition Heaters (DP Condenser) -> Heat = ${qR_part.toFixed(2)} W`);
QR += qR_part;

console.log(`\n--- REFRIGERATOR PRE-MULTIPLIER = ${QR.toFixed(2)} W ---`);
console.log(`+++ REFRIGERATOR FINAL = ${(QR * 1.16279).toFixed(2)} W +++\n`);

// --- Evaporator Back Load ---
const A_evaBack = (geom.W - (geom.tFleft + geom.tFright) / 2) * (geom.Hf - geom.Hb - (geom.tFtop + geom.tFfloor1) / 2) / 1e6;
const QEV_cond = kExterior(geom.tEvaBack, temps.T2, temps.T0, "Evap-Back") * A_evaBack * (temps.T0 - temps.T2);
console.log(`>>> 3. EVAPORATOR BACK (QEV) <<<`);
console.log(`   Evap Back Area = ${A_evaBack.toFixed(4)} m² -> Pre-Multiplier Heat = ${QEV_cond.toFixed(2)} W`);
console.log(`+++ EVAPORATOR BACK FINAL = ${(QEV_cond * 1.16279).toFixed(2)} W +++`);