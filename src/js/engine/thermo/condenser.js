
export function calcQCout(geom, TC, T0, TF, TR, PR, PIPEPITCH ,freezerPosition = 'top',backCondenserEfficiency=0) {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, tFright, tFleft } = geom;

  const sideArea    = ((H * (D - 60)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6;
  const backAreaRaw = (W * (H - Hb)) / 1e6;
  const backArea    = backAreaRaw * backCondenserEfficiency;
  const K_side = 1.0738 - 0.004152 * PIPEPITCH.side + 0.00000482 * PIPEPITCH.side ** 2;
  const K_back = 1.0738 - 0.004152 * PIPEPITCH.back + 0.00000482 * PIPEPITCH.back ** 2;
  const TRise_side = (TC - T0) * K_side;
  const TRise_back = (TC - T0) * K_back;
  const Qdpfr = (0.1984*(TC-T0)+0.1219*(TC-TF))*PR*(W-tFright - tFleft)/1000;

  const isTop    = freezerPosition === 'top';
  let Qdpf;
  let Qdpr;
  if (isTop) {
    Qdpf = (0.3395*(TC-T0)+0.0344*(TC-TF))*PR*(Hf*2+W)/1000;
    Qdpr = (0.3405*(TC-T0)+0.03322*(TC-TR))*PR*(Hr*2)/1000;
  }else{
    Qdpf = (0.3395*(TC-T0)+0.0344*(TC-TR))*PR*(Hr*2+W)/1000;
    Qdpr = (0.3405*(TC-T0)+0.03322*(TC-TF))*PR*(Hf*2)/1000;
  }

  return {
    Qdpfr,
    Qdpf,
    Qdpr,
    Qdp: Qdpfr + Qdpf + Qdpr,
    Qside: K_side * sideArea * (TC - T0),
    Qback: K_back * backArea * (TC - T0),
    QCout: Qdp + Qside + Qback
  };
}