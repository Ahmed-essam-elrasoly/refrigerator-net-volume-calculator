/**
 * @file js/io/io.js
 * I/O layer - JSON config save/load and CSV export.
 */
const SCHEMA_VERSION = '2.0';
const ACCEPTED_VERSIONS = new Set(['1.0', '2.0']);

// 1. Config Serialization
export function configToJSON(config, name) {
  const now = new Date().toISOString();
  const out = {
    ...config,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name:      name ?? config.meta?.name ?? 'Untitled',
      createdAt: config.meta?.createdAt ?? now,
      updatedAt: now,
    },
  };
  return JSON.stringify(out, null, 2);
}

// 2. Fail-Fast Validation
export function configFromJSON(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Parse Exception: Invalid JSON format. ${e.message}`);
  }
  if (!parsed.schemaVersion || !ACCEPTED_VERSIONS.has(parsed.schemaVersion)) {
    throw new Error(`Schema Violation: Unsupported version v${parsed.schemaVersion}.`);
  }
  if (!parsed.cabinet?.geometry) {
    throw new Error('Data Integrity Error: Missing cabinet.geometry boundary constraints.');
  }
  
  const { H, W, D } = parsed.cabinet.geometry;
  if (typeof H !== 'number' || H <= 0) throw new Error('Boundary Error: Cabinet Height (H) must be > 0.');
  if (typeof W !== 'number' || W <= 0) throw new Error('Boundary Error: Cabinet Width (W) must be > 0.');
  if (typeof D !== 'number' || D <= 0) throw new Error('Boundary Error: Cabinet Depth (D) must be > 0.');
  
  return parsed;
}

// 3. File Loader
export function loadConfigFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      try { resolve(configFromJSON(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

// 4. Metadata Prompting
export function downloadConfigJSON(config, defaultName) {
  if (typeof document === 'undefined') return;
  const json = configToJSON(config);
  const suggestedName = defaultName ?? config.meta?.name ?? 'config';
  const filename = prompt('Enter filename to save configuration:', suggestedName);
  
  if (!filename) return; 
  
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  
  a.href     = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// --- Extended Geometry Helper (Reconstructs UI parameters) ---
function computeExtendedVolumes(geometry, leaves) {
    const comps = geometry._compartments || [];
    const special = geometry.special || {};
    const mm3ToL = 1e-6; 

    // Rail and Dike volumes
    const perCompRailsDikesL = comps.map(c => {
        const shelfCount = c.shelfCount || 0;
        const innerW = geometry.W - c.left - c.right;
        const innerD = geometry.D - c.rear;

        const railH = special.railHeight || 0;
        const railW = special.railWidth || 0;
        const railDepthPct = (special.railDepthPct || 0) / 100;
        const railsVol = railH * railW * railDepthPct * innerD * shelfCount * 2 * mm3ToL;

        const dikeH = special.doorDikeHeight || 0;
        const dikeBaseW = special.doorDikeBaseWidth || 0;
        const dikeTopW = special.doorDikeTopWidth || 0;
        const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
        
        const perimeter = 2 * (innerW + c.height);
        const dikesVol = dikeArea * perimeter * mm3ToL;

        return railsVol + dikesVol;
    });

    const adjustedLeaves = (leaves || []).map((leaf, idx) => ({
        ...leaf,
        gross: Math.max(0, leaf.gross - (perCompRailsDikesL[idx] || 0)),
    }));

    const freezerIdx = comps.findIndex(c => c.type === 'freezer');
    const freshIdx   = comps.findIndex(c => c.type === 'fresh');
    const freezerGross = freezerIdx >= 0 ? adjustedLeaves[freezerIdx]?.gross : 0;
    const freshGross   = freshIdx >= 0 ? adjustedLeaves[freshIdx]?.gross : 0;
    const grossVolume  = adjustedLeaves.reduce((sum, l) => sum + (l.gross || 0), 0);

    const obs = geometry.obstacles || {};
    const dividerThick = geometry.dividerThickness ?? 20;
    const evapDepth = obs.evapDepth ?? 85;
    const ctrlH = obs.ctrlBoxH ?? 150;
    const ctrlW = obs.ctrlBoxW ?? 500;
    const ctrlL = obs.ctrlBoxL ?? 100;
    const rshowerH = obs.rshowerH ?? 700;
    const rshowerW = obs.rshowerW ?? 500;
    const rshowerL = obs.rshowerL ?? 50;

    const Hb = geometry.Hb || 0;
    const bottom1 = geometry.walls?.freezer?.bottom1 ?? geometry.walls?.refrigerator?.bottom1 ?? 40;
    const floorRaisedY = geometry.H - Hb - bottom1;

    const getCompTopWorldYFor = (compsList, idx, divThick) => {
        let y = compsList[0]?.top || 0;
        for (let i = 0; i < idx; i++) {
            y += compsList[i].height;
            if (i < compsList.length - 1) y += divThick;
        }
        return y;
    };

    // Calculate Obstacle specific cuts
    const freezerComp = freezerIdx >= 0 ? comps[freezerIdx] : comps[0];
    const freezerIsBottommost = comps.length === 1 || freezerIdx === comps.length - 1;
    const freezerTopWorld = getCompTopWorldYFor(comps, freezerIdx >= 0 ? freezerIdx : 0, dividerThick);
    const fHeight = freezerIsBottommost && freezerComp ? Math.max(0, Math.min(freezerComp.height, floorRaisedY - freezerTopWorld)) : (freezerComp?.height || 0);
    const fInnerW = freezerComp ? (geometry.W - freezerComp.left - freezerComp.right) : 0;
    const evaporatorL = (evapDepth * fHeight * fInnerW) * mm3ToL;

    const freshComp = comps[freshIdx >= 0 ? freshIdx : 0];
    const isTopFreezer = freshIdx > 0;
    const freshTopWorld = getCompTopWorldYFor(comps, freshIdx >= 0 ? freshIdx : 0, dividerThick);
    const availableRearH = isTopFreezer && freshComp ? Math.max(0, Math.min(freshComp.height, floorRaisedY - freshTopWorld)) : (freshComp?.height || 0);
    const effectiveCtrlH = Math.min(ctrlH, availableRearH);
    const effectiveRShowerH = Math.max(0, Math.min(rshowerH, availableRearH - effectiveCtrlH));
    
    const controlBoxL = (effectiveCtrlH * ctrlW * ctrlL) * mm3ToL;
    const rshowerLiters = (effectiveRShowerH * rshowerW * rshowerL) * mm3ToL;

    const freezerTotal = Math.max(0, freezerGross - evaporatorL);
    const freshTotal = Math.max(0, freshGross - controlBoxL - rshowerLiters);
    const totalVolume = freezerTotal + freshTotal;

    // PU Loop
    let fdoorPUVolL = 0, rdoorPUVolL = 0, totalDikesL = 0;
    let doorStartY = 0;
    let yOffset = comps[0]?.top || 0;
    
    for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        const innerW = geometry.W - c.left - c.right;
        const doorThick = c.door || 0;

        let doorEndY;
        if (i === comps.length - 1) {
            doorEndY = geometry.H;
        } else {
            const compBottomY = yOffset + c.height;
            const dividerMidpoint = compBottomY + (geometry.dividerThickness / 2);
            doorEndY = dividerMidpoint - (geometry.doorGap / 2);
        }
        
        const outerDoorHeight = doorEndY - doorStartY;
        const baseVol = doorThick * geometry.W * outerDoorHeight * mm3ToL;

        const dikeH = special.doorDikeHeight || 0;
        const dikeBaseW = special.doorDikeBaseWidth || 0;
        const dikeTopW = special.doorDikeTopWidth || 0;
        const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
        const perimeter = 2 * (innerW + c.height);
        const dikeVolL = dikeArea * perimeter * mm3ToL;
        
        totalDikesL += dikeVolL;

        const totalDoorVol = baseVol + dikeVolL;
        if (c.type === 'freezer') fdoorPUVolL = totalDoorVol;
        else if (c.type === 'fresh') rdoorPUVolL = totalDoorVol;

        if (i < comps.length - 1) {
            const compBottomY = yOffset + c.height;
            const dividerMidpoint = compBottomY + (geometry.dividerThickness / 2);
            doorStartY = dividerMidpoint + (geometry.doorGap / 2);
            yOffset = compBottomY + geometry.dividerThickness;
        }
    }

    const extVolMm3 = geometry.H * geometry.W * geometry.D;
    const cutoutVolMm3 = geometry.Hb * (geometry.Db1 + geometry.Db2) / 2 * geometry.W;
    const extVolL = (extVolMm3 - cutoutVolMm3) * mm3ToL;
    const cabPUVolL = extVolL - grossVolume - totalDikesL;

    return {
        freezerGross, freshGross, grossVolume,
        freezerTotal, freshTotal, totalVolume,
        cabPUVolL, fdoorPUVolL, rdoorPUVolL,
        cabPUweight: cabPUVolL * 32 / 1000,
        fdoorPUweight: fdoorPUVolL * 32 / 1000,
        rdoorPUweight: rdoorPUVolL * 32 / 1000
    };
}

// 5. State-Driven Export & Comprehensive Data Analytics
export function resultToCSV(cachedState, configName) {
  if (!cachedState) return 'No calculation state available\n';

  const { config, volumes: vols, thermal } = cachedState;
  const geom = config.cabinet.geometry;
  const tr = thermal?.results || {};
  const te = thermal?.energy || {};
  const comp = tr.compressor || {};
  const hl = tr.heatLoads || {};
  const evap = tr.evapDetails || {};

  const ext = computeExtendedVolumes(geom, vols?.leaves);

  // Ranks Evaluation
  const TF = config.fixedTemps?.TF ?? -18;
  const monthlyE = te.EnergyConsumption_kWhMonth ?? 0;
  const AV = (ext.freezerTotal * (25 - TF) / 21) + ext.freshTotal;
  const ES_27 = AV * 0.57 + (800 * 0.9);
  const ES_29 = AV * 0.57 + (800 * 0.8);
  const ES_31 = AV * 0.57 + (800 * 0.6);
  const IEE_27 = (monthlyE * 12) / ES_27;
  const IEE_29 = (monthlyE * 12) / ES_29;
  const IEE_31 = (monthlyE * 12) / ES_31;

  const getRank = (iee) => {
    if (!iee || isNaN(iee)) return 'OUT OF RANKING';
    if (iee <= 0.45) return 'A';
    if (iee <= 0.55) return 'B';
    if (iee <= 0.65) return 'C';
    if (iee <= 0.75) return 'D';
    return 'OUT OF RANKING';
  };

  const fmt = (val) => val != null && !isNaN(val) ? Number(val).toFixed(2) : '--';

  const rows = [];
  
  rows.push(['Calculated Volumes:']);
  rows.push(['Gross Volume:']);
  rows.push(['Freezer Gross', fmt(ext.freezerGross)]);
  rows.push(['Fresh Gross', fmt(ext.freshGross)]);
  rows.push(['Gross Volume', fmt(ext.grossVolume)]);
  rows.push(['-------------------------']);
  rows.push(['Total Volume']);
  rows.push(['Freezer Total', fmt(ext.freezerTotal)]);
  rows.push(['Fresh Total', fmt(ext.freshTotal)]);
  rows.push(['Total Volume', fmt(ext.totalVolume)]);
  rows.push(['-------------------------']);
  rows.push(['PU Volume Estimation']);
  rows.push(['Estimated Cabinet PU Volume', fmt(ext.cabPUVolL)]);
  rows.push(['Estimated F-Door PU Volume', fmt(ext.fdoorPUVolL)]);
  rows.push(['Estimated R-Door PU Volume', fmt(ext.rdoorPUVolL)]);
  rows.push(['-------------------------']);
  rows.push(['PU Weight Estimation']);
  rows.push(['Estimated Cabinet PU Weight', fmt(ext.cabPUweight)]);
  rows.push(['Estimated F-Door PU Weight', fmt(ext.fdoorPUweight)]);
  rows.push(['Estimated R-Door PU Weight', fmt(ext.rdoorPUweight)]);
  rows.push(['==================']);
  
  rows.push(['Operating Points:']);
  rows.push(['Condensing temp TC', fmt(tr.TC)]);
  rows.push(['Subcool temp Tsubcool', fmt(tr.Tsubcool)]);
  rows.push(['Evaporating temp TE', fmt(tr.TE)]);
  rows.push(['Mixed inlet T1', fmt(evap.T1)]);
  rows.push(['Evap. outlet T2', fmt(tr.T2)]);
  rows.push(['Fan out Temp T3', fmt(tr.T3)]);
  rows.push(['Running Ratio PR', fmt(tr.PR)]);
  rows.push(['--------------------------']);
  
  rows.push(['Compressor Details:']);
  rows.push(['Evap. pressure Pe', fmt(comp.Pe)]);
  rows.push(['Cond. pressure Pc', fmt(comp.Pc)]);
  rows.push(['Vol. efficiency ηv', fmt(comp.etaV)]);
  rows.push(['Cooling capacity', fmt(comp.coolingCapacity)]);
  rows.push(['Input power', fmt(comp.inputPower)]);
  rows.push(['COP', fmt(comp.COP)]);
  rows.push(['Required Compressor RPM', tr.RPM != null ? Number(tr.RPM).toFixed(0) : '--']);
  rows.push(['Mass flow', fmt(comp.massFlow)]);
  rows.push(['--------------------------']);
  
  rows.push(['Energy Consumption:']);
  rows.push(['Daily energy', fmt(te.EnergyConsumption_kWhDay)]);
  rows.push(['Monthly energy', fmt(te.EnergyConsumption_kWhMonth)]);
  rows.push(['energy Rank:']);
  rows.push(['Rank_27', getRank(IEE_27)]);
  rows.push(['Rank_29', getRank(IEE_29)]);
  rows.push(['Rank_31', getRank(IEE_31)]);
  rows.push(['--------------------------']);
  
  rows.push(['Heat Loads (W):']);
  rows.push(['QF — Freezer compartment', fmt(hl.QF)]);
  rows.push(['QR — Refrigerator compartment', fmt(hl.QR)]);
  rows.push(['QEV — Evaporator total', fmt(hl.QEV)]);
  rows.push(['Fan load', fmt(hl.fanLoad)]);
  rows.push(['Defrost load', fmt(hl.defrostLoad)]);
  rows.push(['Total load', fmt(hl.totalLoad)]);
  rows.push(['--------------------------']);
  
  rows.push(['Airflow:']);
  rows.push(['Calculated Fan Air Speed', fmt(tr.fanAirSpeed)]);
  rows.push(['Calculated airflow', fmt(tr.fanAirflow)]);
  rows.push(['Freezer flow (MF)', fmt(tr.MF)]);
  rows.push(['Refrigerator flow (MR)', fmt(tr.MR)]);
  rows.push(['--------------------------']);
  
  rows.push(['Evaporator Performance:']);
  rows.push(['Surface area', fmt(evap.area)]);
  rows.push(['Air speed', fmt(evap.v)]);
  rows.push(['Heat transfer coeff α', fmt(evap.alpha)]);
  rows.push(['LMTD', fmt(evap.LMTD)]);
  rows.push(['Evap. capacity (calculated)', fmt(evap.Qevap)]);

  return rows.map(r => r.join(',')).join('\n');
}

export function downloadResultsCSV(cachedState, configName, filename) {
  if (typeof document === 'undefined') return;
  const csv  = resultToCSV(cachedState, configName);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  
  a.href     = url;
  a.download = filename ?? `${configName ?? 'results'}.csv`;
  a.click();
  
  URL.revokeObjectURL(url);
}