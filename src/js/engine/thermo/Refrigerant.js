/**
 * Thermodynamic Properties of Isobutane - JavaScript Engine
 * REVISED VERSION — see accompanying review for full evidence/derivations.
 *
 * Source: Waxman, M. & Gallagher, J.S., "Thermodynamic Properties of
 * Isobutane" (NBSIR 81-2435 / GOVPUB-C13-781e927854de63aa215926e85a5e1f96),
 * Eq. (1)-(8), Tables I-VIII, and the FORTRAN listing (pp. 165-186).
 *
 * Every change below is tagged "FIX #n" and cross-referenced to the chat
 * response. Each fix was verified against either the typeset tables, the
 * FORTRAN source, or both, and (where possible) against Table XI's own
 * reference Cp values.
 *
 * ============================ KNOWN OPEN ISSUE ============================
 * Validated against Table XI and internal consistency checks:
 *   - Dilute vapor Cp (ideal-gas-dominated regime) matches Table XI to
 *     within ~0.6%. dP/dT was independently cross-checked against a
 *     brute-force finite difference of calculatePressure() and agrees to
 *     6 decimal places. phi_res, its T- and rho-derivatives, and the
 *     ideal-gas closed forms were each independently re-derived by hand
 *     and match.
 *   - Saturated-LIQUID Cp is still ~25-40% too high vs. Table XI at
 *     230-260K, and pcorr() does not reliably converge to
 *     vaporPressurePrimary(T) at sub-critical T even after the dimensional
 *     fix below (delta_g at the Eq.7 pressure comes out far larger than it
 *     should if the surface truly satisfied the Gibbs condition there).
 *     Root cause NOT confirmed. Everything individually checkable
 *     (b_consts, B_consts, C_nj, alpha, dP/dT, the phi_res derivatives) has
 *     checked out against the source, so this is most likely either a
 *     subtle remaining error in phi_base/phi_res at high density that
 *     hasn't been isolated yet, or an un-transcribed piece of the FORTRAN's
 *     analytic QUB/QCVB/DPDTB formulas (p.177-179) that this port
 *     approximates differently (finite differences vs. closed form).
 *     DO NOT trust Cp, Cv, speed of sound, or pcorr()'s output in the
 *     liquid / high-density region until this is resolved.
 * ============================================================================
 */
class IsobutaneThermodynamics {
    constructor() {
        this.R = 8.31440;
        this.M = 58.1243;
        this.R_spec = (this.R / this.M) * 1000.0; // J/kg-K (Table I: 0.1430452 kJ/kg.K)
        this.Tc = 407.851;   // Table VIII
        this.rhoc = 227.0;   // Table VIII
        this.Pc = 3.6306;    // Table VIII

        // FIX #3: RCAL is the cal-based gas constant Chen et al.'s ideal-gas
        // fit was built in (Fortran: RCAL=1.9869). Table II's N_i, plugged
        // directly into Eq.(2), yield Cp in cal/(mol.K), NOT Cp/R. The
        // Fortran subroutine FZ explicitly divides by RCAL before returning
        // a dimensionless ratio. The original code never did this division,
        // so every ideal-gas quantity (Cp0, Cv0, H0, S0, U0) came out ~1.99x
        // too large.
        this.RCAL = 1.9869;

        this.N = [
            0, 0.113634e8, -0.460434e6, 0.622522e4, -0.298782e2,
            // FIX #1: N8 (Table II, i=8) is -0.208957e2, NOT +0.208957e2.
            // Confirmed twice: the typeset Table II, and the FORTRAN
            // DATA statement "-.208957D02" (p.176).
            0.142485, -0.661030e-4, 0.115812e-7, -0.208957e2, 0.3250e4
        ];

        // FIX #4: Table III's column header is "10^3 b_i" - the printed
        // numbers must be DIVIDED by 1000. The original code used the raw
        // printed values directly, which is 1000x too large: y = b*rho/4
        // then exceeds 1 for any rho above ~1.5 kg/m3, making ln(1-y) = NaN
        // for essentially every realistic density. (Table IV, for B_consts,
        // carries the identical "10^3 B_i" header and WAS scaled correctly
        // in the original code - this was a one-table inconsistency.)
        this.b_consts = { 0: 2.72962e-3, 1: 0.694809e-3, 4: -4.46930e-6, 8: 1.75219e-8 };

        this.B_consts = { 0: 3.67237e-3, 1: -7.52673e-3, 3: -1.78220e-3, 5: 0.163192e-3, 10: -0.110120e-6 };
        this.alpha = 1.72045e-3; // Table V footnote - verified correct, unchanged.

        // Table V, all 25 terms - verified correct against the typeset table, unchanged.
        this.C_nj = [
            {n: 1, j: 1, val: -5.32461e-4}, {n: 2, j: 1, val: 2.32047e-3},
            {n: 4, j: 1, val: -1.74015e-2}, {n: 5, j: 1, val: 9.03851e-2},
            {n: 6, j: 1, val: -9.29326e-2}, {n: 8, j: 1, val: 3.52214e-2},
            {n: 1, j: 2, val: -6.85169e-4}, {n: 3, j: 2, val: -3.84671e-3},
            {n: 5, j: 2, val: -9.56414e-2}, {n: 6, j: 2, val: 1.03133e-1},
            {n: 7, j: 2, val: 9.19327e-2}, {n: 8, j: 2, val: -1.05560e-1},
            {n: 1, j: 3, val: 3.21859e-3}, {n: 2, j: 3, val: -4.15421e-3},
            {n: 4, j: 3, val: 3.20563e-2}, {n: 6, j: 3, val: -7.38111e-2},
            {n: 8, j: 3, val: 6.50946e-2}, {n: 1, j: 4, val: -1.27011e-3},
            {n: 6, j: 4, val: -2.81116e-3}, {n: 1, j: 5, val: -5.63115e-4},
            {n: 2, j: 5, val: 2.50405e-3}, {n: 5, j: 5, val: -5.57420e-3},
            {n: 8, j: 5, val: 6.35584e-3}, {n: 2, j: 6, val: -4.43970e-5},
            {n: 8, j: 6, val: 9.27466e-6}
        ];

        // Eq.(7) constants - verified correct twice (typeset Table VI AND
        // hard-coded identically in TWO separate FORTRAN routines, PS and
        // TDPSDT), unchanged.
        this.vp_primary = { a1: -6.83796, a2: 1.25220, a5: -2.34060 };

        // FIX #5 support: reference density rho0(T) = P0/(R_spec*T), P0 = 1 atm.
        // See _phi_base / _phi_base_dT.
        this.P0_Pa = 101325;
        this.LN_RSPEC_OVER_P0 = Math.log(this.R_spec / this.P0_Pa);
    }

    _tau(T) { return this.Tc / T; }

    _b_and_derivs(T) {
        const tau = this._tau(T);
        const b0 = this.b_consts[0], b1 = this.b_consts[1], b4 = this.b_consts[4], b8 = this.b_consts[8];
        const tau4 = Math.pow(tau, 4), tau8 = tau4 * tau4;
        const b = b0 + b1 * Math.log(tau) + b4 * tau4 + b8 * tau8;
        const dtau_dT = -this.Tc / (T * T);
        const db_dtau = b1 / tau + 4 * b4 * Math.pow(tau, 3) + 8 * b8 * Math.pow(tau, 7);
        const db_dT = db_dtau * dtau_dT;
        const d2b_dtau2 = -b1 / (tau * tau) + 12 * b4 * tau * tau + 56 * b8 * Math.pow(tau, 6);
        const d2tau_dT2 = 2 * this.Tc / (T * T * T);
        const d2b_dT2 = d2b_dtau2 * dtau_dT * dtau_dT + db_dtau * d2tau_dT2;
        return { b, db_dT, d2b_dT2 };
    }

    _B_and_derivs(T) {
        const tau = this._tau(T);
        const B0 = this.B_consts[0], B1 = this.B_consts[1], B3 = this.B_consts[3], B5 = this.B_consts[5], B10 = this.B_consts[10];
        const tau3 = Math.pow(tau, 3), tau5 = Math.pow(tau, 5), tau10 = tau5 * tau5;
        const B = B0 + B1 * tau + B3 * tau3 + B5 * tau5 + B10 * tau10;
        const dtau_dT = -this.Tc / (T * T);
        const dB_dtau = B1 + 3 * B3 * tau * tau + 5 * B5 * Math.pow(tau, 4) + 10 * B10 * Math.pow(tau, 9);
        const dB_dT = dB_dtau * dtau_dT;
        const d2B_dtau2 = 6 * B3 * tau + 20 * B5 * tau3 + 90 * B10 * Math.pow(tau, 8);
        const d2tau_dT2 = 2 * this.Tc / (T * T * T);
        const d2B_dT2 = d2B_dtau2 * dtau_dT * dtau_dT + dB_dtau * d2tau_dT2;
        return { B, dB_dT, d2B_dT2 };
    }

    _phi_base(T, rho, cache) {
        const b = cache.b, B = cache.B;
        const y = (b * rho) / 4.0;
        const one_minus_y = 1.0 - y;
        // FIX #5: Eq.(3)'s last term is "+ ln(rho/rho0)", not "+ ln(rho)".
        // rho0 = P0/(R_spec*T) is T-dependent, so this contributes
        // ln(rho) + ln(T) + ln(R_spec/P0), not just ln(rho). Confirmed both
        // from the printed equation and from the FORTRAN's GRT formula
        // ("DLOG(DV*T*1.43045/ATMBAR)", p.181).
        return -Math.log(one_minus_y) + 1.5 / (one_minus_y * one_minus_y) + 4 * y * (B / b - 1) - 1.5
               + Math.log(rho) + Math.log(T) + this.LN_RSPEC_OVER_P0;
    }

    _phi_base_dT(T, rho, cache) {
        const b = cache.b, db = cache.db_dT, B = cache.B, dB = cache.dB_dT;
        const y = (b * rho) / 4.0;
        const one_minus_y = 1.0 - y;
        const dy_dT = (rho / 4.0) * db;
        const d_B_over_b = (dB * b - B * db) / (b * b);
        const term1 = (1 / one_minus_y + 3 / Math.pow(one_minus_y, 3)) * dy_dT;
        const term2 = 4 * y * d_B_over_b;
        const term3 = 4 * (B / b - 1) * dy_dT;
        // FIX #5 (derivative half): d/dT[ln T] = 1/T, needed for consistency
        // with the phi_base fix above. This flows through automatically into
        // S_dep and U_dep (getProperties) and into phi_base_dT2 (finite
        // difference of this function).
        return term1 + term2 + term3 + 1 / T;
    }

    _phi_base_dT2(T, rho, cache) {
        const h = 1e-6;
        const cache1 = this._cache(T + h);
        const cache2 = this._cache(T - h);
        const dphi_plus = this._phi_base_dT(T + h, rho, cache1);
        const dphi_minus = this._phi_base_dT(T - h, rho, cache2);
        return (dphi_plus - dphi_minus) / (2 * h);
    }

    _phi_res(T, rho) {
        const tau = this._tau(T);
        let sum = 0;
        for (let k = 0; k < this.C_nj.length; k++) {
            const item = this.C_nj[k];
            const exp_term = Math.exp(-this.alpha * rho);
            const f_n = Math.pow(1 - exp_term, item.n + 1) / (this.alpha * (item.n + 1));
            sum += item.val * Math.pow(tau, item.j) * f_n;
        }
        return sum;
    }

    _phi_res_dT(T, rho) {
        const tau = this._tau(T);
        let sum = 0;
        for (let k = 0; k < this.C_nj.length; k++) {
            const item = this.C_nj[k];
            const exp_term = Math.exp(-this.alpha * rho);
            const f_n = Math.pow(1 - exp_term, item.n + 1) / (this.alpha * (item.n + 1));
            sum += item.val * (-item.j / T) * Math.pow(tau, item.j) * f_n;
        }
        return sum;
    }

    _phi_res_dT2(T, rho) {
        // Verified against a from-scratch derivation: d^2(tau^j)/dT^2 = j(j+1) tau^j / T^2. Unchanged.
        const tau = this._tau(T);
        let sum = 0;
        for (let k = 0; k < this.C_nj.length; k++) {
            const item = this.C_nj[k];
            const exp_term = Math.exp(-this.alpha * rho);
            const f_n = Math.pow(1 - exp_term, item.n + 1) / (this.alpha * (item.n + 1));
            sum += item.val * (item.j * (item.j + 1) / (T * T)) * Math.pow(tau, item.j) * f_n;
        }
        return sum;
    }

    _ideal_gas(T) {
        const C = this.N;
        const u = C[9] / T;
        const exp_u = Math.exp(u);
        const denom = exp_u - 1.0;
        let cp_R = 0;
        for (let i = 1; i <= 7; i++) {
            cp_R += C[i] * Math.pow(T, i - 4);
        }
        cp_R += C[8] * (u * u * exp_u) / (denom * denom);
        let H_R_poly = 0, S_R_poly = 0;
        for (let i = 1; i <= 7; i++) {
            if (i === 3) {
                H_R_poly += C[i] * Math.log(T);
            } else {
                H_R_poly += C[i] * Math.pow(T, i - 3) / (i - 3);
            }
            if (i === 4) {
                S_R_poly += C[i] * Math.log(T);
            } else {
                S_R_poly += C[i] * Math.pow(T, i - 4) / (i - 4);
            }
        }
        // FIX #2: H_vib/R = N8*N9/(e^u-1), NOT N8*u/(e^u-1). Verified three
        // ways: (a) closed-form integration of Cp_vib/R dT, (b) numerical
        // integration cross-check, (c) matches the FORTRAN's "Z*C(9)" with
        // Z=C(8)/(Y-1.) (p.176). The old formula had the wrong high-T limit
        // (approached a constant instead of growing linearly with T).
        const H_vib_R = C[8] * C[9] / denom;
        // S_vib_R was already correct - verified it's algebraically identical
        // to the FORTRAN's Z1 term. Unchanged.
        const S_vib_R = C[8] * (u / denom - Math.log(1 - Math.exp(-u)));
        const H_R_total = H_R_poly + H_vib_R - 29526.2;  // offset confirmed verbatim in FORTRAN (p.176)
        const S_R_total = S_R_poly + S_vib_R + 219.62;   // offset confirmed verbatim in FORTRAN (p.176)

        // FIX #3 (applied here): divide by RCAL before handing off as a
        // dimensionless ratio to be multiplied by the SI R_spec downstream.
        return {
            cp_R: cp_R / this.RCAL,
            H0_RT: H_R_total / (this.RCAL * T),
            S0_R: S_R_total / this.RCAL,
            U0_RT: H_R_total / (this.RCAL * T) - 1.0
        };
    }

    _cache(T) {
        const b_der = this._b_and_derivs(T);
        const B_der = this._B_and_derivs(T);
        const tau = this._tau(T);
        const ideal = this._ideal_gas(T);
        return {
            T: T, tau: tau,
            b: b_der.b, db_dT: b_der.db_dT, d2b_dT2: b_der.d2b_dT2,
            B: B_der.B, dB_dT: B_der.dB_dT, d2B_dT2: B_der.d2B_dT2,
            cp_R: ideal.cp_R, H0_RT: ideal.H0_RT, S0_R: ideal.S0_R, U0_RT: ideal.U0_RT
        };
    }

    calculatePressure(T, rho, cache = null) {
        if (!cache) cache = this._cache(T);
        const b = cache.b, B = cache.B;
        const y = (b * rho) / 4.0;
        const one_minus_y = 1.0 - y;
        const dy_drho = b / 4.0;
        // Note: the rho0(T) term added in _phi_base has zero rho-derivative,
        // so this pressure formula is unaffected by FIX #5 - confirmed
        // against the FORTRAN PBASE's Z formula under G1=G2=GF=1 (verified
        // true for isobutane: GAM=3 => G1=G2=GF=1 exactly, p.171-172).
        const dphi_base_drho = (dy_drho / one_minus_y) + (3.0 * dy_drho / Math.pow(one_minus_y, 3))
                               + 4.0 * ((B / b) - 1.0) * dy_drho + (1.0 / rho);
        const tau = cache.tau;
        let dphi_res_drho = 0;
        for (let k = 0; k < this.C_nj.length; k++) {
            const item = this.C_nj[k];
            const exp_term = Math.exp(-this.alpha * rho);
            const term = Math.pow(1 - exp_term, item.n) * exp_term;
            dphi_res_drho += item.val * Math.pow(tau, item.j) * term;
        }
        const dphi_drho = dphi_base_drho + dphi_res_drho;
        const P_Pa = rho * rho * this.R_spec * T * dphi_drho;
        return P_Pa * 1e-6;
    }

    calculateDPDRho(T, rho, cache = null) {
        const h = 1e-6 * rho;
        if (h === 0) return 1e6;
        const P1 = this.calculatePressure(T, rho - h, cache);
        const P2 = this.calculatePressure(T, rho + h, cache);
        return (P2 - P1) / (2 * h);
    }

    _dphi_drho(T, rho, cache) {
        const b = cache.b, B = cache.B;
        const y = (b * rho) / 4.0;
        const one_minus_y = 1.0 - y;
        const dy_drho = b / 4.0;
        let dphi_drho = (dy_drho / one_minus_y) + (3.0 * dy_drho / Math.pow(one_minus_y, 3))
                        + 4.0 * ((B / b) - 1.0) * dy_drho + (1.0 / rho);
        const tau = cache.tau;
        for (let k = 0; k < this.C_nj.length; k++) {
            const item = this.C_nj[k];
            const exp_term = Math.exp(-this.alpha * rho);
            const term = Math.pow(1 - exp_term, item.n) * exp_term;
            dphi_drho += item.val * Math.pow(tau, item.j) * term;
        }
        return dphi_drho;
    }

    getProperties(T, rho, cache = null) {
        if (!cache) cache = this._cache(T);
        const phi = this._phi_base(T, rho, cache) + this._phi_res(T, rho);
        const phi_dT = this._phi_base_dT(T, rho, cache) + this._phi_res_dT(T, rho);
        const phi_dT2 = this._phi_base_dT2(T, rho, cache) + this._phi_res_dT2(T, rho);
        const hT = 1e-5 * T;
        const cache_plus = this._cache(T + hT);
        const cache_minus = this._cache(T - hT);
        const dphi_drho_T = this._dphi_drho(T, rho, cache);
        const dphi_drho_plus = this._dphi_drho(T + hT, rho, cache_plus);
        const dphi_drho_minus = this._dphi_drho(T - hT, rho, cache_minus);
        const d2phi_dTdrho = (dphi_drho_plus - dphi_drho_minus) / (2 * hT);
        const P = this.calculatePressure(T, rho, cache);
        const dP_drho = this.calculateDPDRho(T, rho, cache);
        const dP_dT_Pa = rho * rho * this.R_spec * (dphi_drho_T + T * d2phi_dTdrho);
        const dP_dT = dP_dT_Pa * 1e-6;
        const S_dep = -this.R_spec * (phi + T * phi_dT);
        const U_dep = -this.R_spec * T * T * phi_dT;
        const H_dep = U_dep + (P * 1e6) / rho;
        const Cv_dep = -this.R_spec * (2 * T * phi_dT + T * T * phi_dT2);
        const H0 = cache.H0_RT * this.R_spec * T;
        const S0 = cache.S0_R * this.R_spec;
        const U0 = cache.U0_RT * this.R_spec * T;
        const Cp0 = cache.cp_R * this.R_spec;
        const Cv0 = Cp0 - this.R_spec;
        const S = S0 + S_dep;
        const U = U0 + U_dep;
        const H = H0 + H_dep;
        const Cv = Cv0 + Cv_dep;
        const dP_drho_Pa = dP_drho * 1e6;
        // NOTE: this Cp_dep term is the still-unresolved piece flagged at the
        // top of the file - matches Table XI well in the vapor phase, but
        // overshoots by ~25-40% in the dense liquid at 230-260K. dP_dT was
        // independently cross-checked (matches a brute-force FD of
        // calculatePressure to 6 decimal places), so if there's a bug here
        // it's more likely in dP_drho and/or phi_dT2 at high density -
        // NOT confirmed. Treat Cp/Cv/speedOfSound in the liquid with caution.
        const Cp_dep = Cv_dep + (T / (rho * rho)) * (dP_dT_Pa * dP_dT_Pa) / dP_drho_Pa;
        const Cp = Cp0 + Cp_dep;
        const gamma = Cp / Cv;
        const c_squared = gamma * dP_drho_Pa;
        const speedOfSound = Math.sqrt(c_squared);
        return { T, rho, P, dP_dT, dP_drho, S, U, H, Cv, Cp, speedOfSound };
    }

    // FIX #6 (findDensity): the original fallback trigger compared the
    // Newton step against rho AFTER it had already been updated
    // ("rho += step" happened before the "Math.abs(step) > 0.5*rho" check),
    // which spuriously punts to Brent on perfectly good Newton steps whenever
    // a step roughly halves rho or more. Fixed by comparing against the
    // pre-step density instead.
    findDensity(T, P, isLiquid = false, cache = null) {
        if (!cache) cache = this._cache(T);
        let rho = isLiquid ? 2.5 * this.rhoc : 0.01 * this.rhoc;
        const tol = 1e-9;
        const maxIter = 50;
        for (let i = 0; i < maxIter; i++) {
            const P_calc = this.calculatePressure(T, rho, cache);
            const dP = this.calculateDPDRho(T, rho, cache);
            const err = P - P_calc;
            if (Math.abs(err / P) < tol) return rho;
            const step = err / dP;
            const rho_old = rho;
            let rho_new = rho + step;
            if (rho_new <= 0) rho_new = rho_old / 2;
            if (Math.abs(step) > 0.5 * rho_old || Math.abs(dP) < 1e-3) {
                return this._brentDensity(T, P, isLiquid, cache);
            }
            rho = rho_new;
        }
        return this._brentDensity(T, P, isLiquid, cache);
    }

    // FIX #7 (Brent bracket): below Tc, P(rho) is NOT monotonic (van der
    // Waals-style loop: rises, peaks, dips negative, rises again). The
    // original bracket check only tested the two extreme endpoints
    // (e.g. [0.001, 0.8*rhoc] for vapor); whenever the target P was below
    // the loop's local maximum, BOTH endpoints came out on the same side
    // and the code silently gave up and returned a meaningless midpoint
    // (confirmed: this fired for essentially every realistic sub-critical
    // vapor query, e.g. T=293.15K, P=0.049-0.196 MPa). Replaced with a scan
    // that walks the interval looking for an actual sign change: the FIRST
    // one found for vapor (physical branch is the lowest-density root), the
    // LAST one found for liquid (highest-density root).
    _bracketScan(T, P, isLiquid, cache, lo, hi, n = 400) {
        let prevRho = lo;
        let prevF = this.calculatePressure(T, lo, cache) - P;
        let found = null;
        for (let i = 1; i <= n; i++) {
            const rho = lo + (hi - lo) * i / n;
            const f = this.calculatePressure(T, rho, cache) - P;
            if (prevF * f < 0) {
                const bracket = [prevRho, rho];
                if (!isLiquid) return bracket; // vapor: first (lowest-rho) crossing
                found = bracket;               // liquid: keep the last (highest-rho) crossing
            }
            prevRho = rho;
            prevF = f;
        }
        return found;
    }

    _brentDensity(T, P, isLiquid, cache) {
        const lo = isLiquid ? this.rhoc * 0.5 : 1e-4;
        const hi = isLiquid ? this.rhoc * 3.5 : this.rhoc * 0.999;
        const bracket = this._bracketScan(T, P, isLiquid, cache, lo, hi);
        let a, b;
        if (bracket) {
            [a, b] = bracket;
        } else {
            // No sign change found anywhere in the physically-reasonable
            // range - fall back to the original endpoints so the solver
            // still returns *something*, but this case should be treated as
            // "no solution found" by the caller.
            a = lo; b = hi;
        }
        let fa = this.calculatePressure(T, a, cache) - P;
        let fb = this.calculatePressure(T, b, cache) - P;
        if (fa * fb >= 0) return (a + b) / 2;

        const tol = 1e-9;
        const maxIter = 100;
        let c = a, fc = fa;
        let d = b - a, e = d;

        for (let iter = 0; iter < maxIter; iter++) {
            if (fb * fc > 0) {
                c = a; fc = fa;
                d = b - a; e = d;
            }
            if (Math.abs(fc) < Math.abs(fb)) {
                a = b; b = c; c = a;
                fa = fb; fb = fc; fc = fa;
            }
            const tol1 = 1e-9 * Math.abs(b) + tol;
            const m = 0.5 * (c - b);

            if (Math.abs(m) <= tol1 || fb === 0) return b;

            if (Math.abs(e) < tol1 || Math.abs(fa) <= Math.abs(fb)) {
                e = m; d = e;
            } else {
                let s = fb / fa;
                let p, q;
                if (a === c) {
                    p = 2 * m * s;
                    q = 1 - s;
                } else {
                    q = fa / fc;
                    let r = fb / fc;
                    p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
                    q = (q - 1) * (r - 1) * (s - 1);
                }
                if (p > 0) q = -q;
                p = Math.abs(p);
                const min1 = 3 * m * q - Math.abs(tol1 * q);
                const min2 = Math.abs(e * q);
                if (2 * p < (min1 < min2 ? min1 : min2)) {
                    e = d; d = p / q;
                } else {
                    e = m; d = e;
                }
            }
            a = b; fa = fb;
            if (Math.abs(d) > tol1) b += d;
            else b += (m > 0 ? tol1 : -tol1);
            fb = this.calculatePressure(T, b, cache) - P;
        }
        return b;
    }

    vaporPressurePrimary(T) {
        // Verified correct - matches Eq.(7) and the FORTRAN's FUNCTION PS exactly. Unchanged.
        if (T >= this.Tc) return this.Pc;
        const y = 1.0 - T / this.Tc;
        const x = (this.Tc / T) * (this.vp_primary.a1 * y + this.vp_primary.a2 * Math.pow(y, 1.5) + this.vp_primary.a5 * Math.pow(y, 3));
        return this.Pc * Math.exp(x);
    }

    tdpsdt(T) {
        // Verified correct - matches FORTRAN's FUNCTION TDPSDT exactly. Unchanged.
        const y = 1.0 - T / this.Tc;
        if (y <= 0) return 0;
        const x = (this.Tc / T) * (this.vp_primary.a1 * y + this.vp_primary.a2 * Math.pow(y, 1.5) + this.vp_primary.a5 * Math.pow(y, 3));
        const P_pred = this.Pc * Math.exp(x);
        return -P_pred * (this.vp_primary.a1 + 1.5 * this.vp_primary.a2 * Math.pow(y, 0.5) + 3.0 * this.vp_primary.a5 * y * y + x);
    }

    tsat(P) {
        // Verified correct - matches FORTRAN's FUNCTION TSAT exactly (incl.
        // the 0.75 damping factor, which IS in the source, not an
        // invention). Unchanged, except P>=Pc now returns NaN instead of
        // silently returning Tc (FORTRAN returns 0 as an error sentinel in
        // that case; Tc is arguably a more useful sentinel than 0, but
        // silently returning a plausible-looking number for an invalid input
        // was worth flagging).
        if (P >= this.Pc) return NaN;
        const P_bar = P * 10.0;
        const pl = Math.log(P_bar);
        let tg = 261.082 + 25.4673 * pl + 2.77993 * pl * pl + 0.369027 * Math.pow(pl, 3) + 0.0156168 * Math.pow(pl, 4);
        for (let k = 0; k < 8; k++) {
            const pp = this.vaporPressurePrimary(tg);
            const dp = this.tdpsdt(tg);
            if (Math.abs(1.0 - pp / P) < 1e-5) break;
            tg += (P - pp) * tg / dp * 0.75;
        }
        return tg;
    }

    pcorr(T) {
        if (T >= this.Tc) throw new Error("Temperature exceeds critical point.");
        let P = this.vaporPressurePrimary(T);
        let rho_L, rho_V;
        const cache = this._cache(T);
        for (let i = 0; i < 40; i++) {
            rho_L = this.findDensity(T, P, true, cache);
            rho_V = this.findDensity(T, P, false, cache);
            const g_L = this.R_spec * T * (this._phi_base(T, rho_L, cache) + this._phi_res(T, rho_L)) + (P * 1e6) / rho_L;
            const g_V = this.R_spec * T * (this._phi_base(T, rho_V, cache) + this._phi_res(T, rho_V)) + (P * 1e6) / rho_V;
            const delta_g = g_L - g_V;
            if (Math.abs(delta_g) < 1e-4) break;
            const delta_v = (1.0 / rho_V) - (1.0 / rho_L);
            // FIX #6b (pcorr): removed a spurious extra "* RT" factor.
            // g_L/g_V here are PHYSICAL Gibbs energies (J/kg) - R_spec*T is
            // already baked in via the phi terms. The FORTRAN's analogous
            // DP=DELG*GASCON*T/(...) is correct there ONLY because its GL/GV
            // are pre-divided by RT (dimensionless), which these are not.
            // Multiplying a physical delta_g by RT again inflated the
            // correction step by a factor of R_spec*T (tens of thousands).
            // This dimensional fix is confirmed correct by unit analysis,
            // but on its own it is NOT sufficient to make pcorr() converge
            // cleanly - see the "KNOWN OPEN ISSUE" block at the top of this
            // file. delta_g at the Eq.(7) starting pressure is currently
            // much larger than it should be, which this fix alone doesn't
            // paper over (nor should it - a real remaining error elsewhere
            // is more likely than a coincidentally-good fudge factor).
            const dP_Pa = delta_g / delta_v;
            P += dP_Pa * 1e-6;
        }
        return { P: P, rho_L: rho_L, rho_V: rho_V };
    }
}

if (typeof module !== 'undefined') module.exports = IsobutaneThermodynamics;