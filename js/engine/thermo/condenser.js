/**
 * @file condenser.js
 * @description Evaluates the heat rejection capacity of the system's condenser.
 */

/**
 * Computes the total heat rejected by the condenser (QC_out).
 * Accounts for side skin condensers, back condensers, and door perimeter heating (DP).
 * 
 * @param {Object} geom - The flat thermal geometry object.
 * @param {number} TC - Condensing temperature (°C).
 * @param {number} T0 - Ambient temperature (°C).
 * @param {number} TF - Freezer temperature (°C).
 * @param {number} TR - Refrigerator temperature (°C).
 * @param {number} PR - Compressor running ratio.
 * @param {Object} PIPEPITCH - Pipe pitch for side and back panels (mm).
 * @param {string} freezerPosition - 'top' or 'bottom'.
 * @param {number} backCondenserEfficiency - Effectiveness of the back panel.
 * @returns {Object} Individual heat rejection vectors and total QCout.
 */
export function calcQCout(geom, TC, T0, TF, TR, PR, PIPEPITCH, freezerPosition = 'top', backCondenserEfficiency = 0) {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, tFright, tFleft } = geom;

  // 1. Available exterior surface areas (m²)
  const sideArea    = ((H * (D - 60)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6;
  const backAreaRaw = (W * (H - Hb)) / 1e6;
  const backArea    = backAreaRaw * backCondenserEfficiency;
  
  // 2. Pipe pitch correction factors (empirical quadratic fit)
  const K_side = 1.0738 - 0.004152 * PIPEPITCH.side + 0.00000482 * PIPEPITCH.side ** 2;
  const K_back = 1.0738 - 0.004152 * PIPEPITCH.back + 0.00000482 * PIPEPITCH.back ** 2;

  // 3. Dew Point (DP) perimeter heater heat rejection
  const Qdpfr = (0.1984*(TC-T0)+0.1219*(TC-TF))*PR*(W-tFright - tFleft)/1000 * 1.16279;

  const isTop = freezerPosition === 'top';
  let Qdpf;
  let Qdpr;
  if (isTop) {
    Qdpf = (0.3395*(TC-T0)+0.0344*(TC-TF))*PR*(Hf*2+W)/1000 * 1.16279;
    Qdpr = (0.3405*(TC-T0)+0.03322*(TC-TR))*PR*(Hr*2)/1000 * 1.16279;
  } else {
    Qdpf = (0.3395*(TC-T0)+0.0344*(TC-TF))*PR*(Hf*2)/1000 * 1.16279;
    Qdpr = (0.3405*(TC-T0)+0.03322*(TC-TR))*PR*(Hr*2+W)/1000 * 1.16279;
  }
  const Qdp = Qdpfr + Qdpf + Qdpr;

  // 4. Primary condenser heat rejection (Sides and Back)
  const Qside = K_side * sideArea * (TC - T0) * 1.16279;
  const Qback = K_back * backArea * (TC - T0) * 1.16279;
  
  return { 
    Qdpfr, Qdpf, Qdpr, Qdp, Qside, Qback, 
    QCout: Qdp + Qside + Qback 
  };
}