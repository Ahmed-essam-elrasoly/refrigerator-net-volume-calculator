"""
Compressor Multi‑Speed Model Selector (Final Corrected)
========================================================
Automatically evaluates global polynomial/log‑transformed models and a piecewise
alternative, selects the best strategy that achieves RMSE ≤ TARGET_RMSE, and
prints the final predictive equations in engineering‑units form.

Usage:
    - Adjust FILEPATH and layout parameters (SKIPROWS, USE_COLS) for your data.
    - Set TARGET_RMSE to your desired accuracy threshold.
    - Run the script. It will output the chosen model(s) and their equations.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.metrics import mean_squared_error

# ----------------------------------------------------------------------
# USER SETTINGS
# ----------------------------------------------------------------------
FILEPATH = r"D:\refrigerator-volume-calculator\Compressor cooling performance DZ90A1X.xlsm"
FILE_TYPE = "excel"                        # "excel" or "csv"
SHEET_NAME = 0                              # sheet name or index (for Excel)
SKIPROWS = 1                                # rows to skip at top (e.g., title row)
USE_COLS = "A:E"                            # columns to read: RPM, T_E, T_C, W, Q
TARGET_RMSE = 3.0                           # maximum allowed RMSE per target
CENTER_TE = -25.0                           # centering value for evaporating temp
CENTER_TC = 45.0                            # centering value for condensing temp
NORMALIZE_RPM = 4320                        # RPM max for normalising speed (global models)
ALPHAS = [0.001, 0.01, 0.1, 1, 10, 100]    # Ridge regularisation candidates
PIECEWISE_SPLIT = 'auto'                    # 'auto' or a specific RPM (e.g., 3000)
# ----------------------------------------------------------------------

# ----------------------------------------------------------------------
# 1. DATA LOADING
# ----------------------------------------------------------------------
def load_data(filepath, file_type, sheet_name, skiprows=0, usecols=None):
    if file_type == "excel":
        df = pd.read_excel(filepath, sheet_name=sheet_name, engine='openpyxl',
                           skiprows=skiprows, usecols=usecols)
    else:
        df = pd.read_csv(filepath, skiprows=skiprows, usecols=usecols)
    expected = ['RPM', 'T_E', 'T_C', 'W', 'Q']
    if set(expected).issubset(df.columns):
        df = df[expected]
    elif df.shape[1] == 5:
        df.columns = expected
    else:
        raise KeyError(f"Cannot identify columns. Got: {df.columns.tolist()}")
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.dropna(inplace=True)
    return df.reset_index(drop=True)

# ----------------------------------------------------------------------
# 2. FEATURE BUILDING (global models)
# ----------------------------------------------------------------------
def make_global_features(df, rpm_form):
    n = df['RPM'] / NORMALIZE_RPM
    te = df['T_E'] - CENTER_TE
    tc = df['T_C'] - CENTER_TC
    if rpm_form == 'n_lin':
        return pd.DataFrame({'n': n, 'n_te': n*te, 'n_tc': n*tc,
                             'n_tc_te': n*tc*te, 'n_te2': n*te**2})
    elif rpm_form == 'n_quad':
        return pd.DataFrame({'n': n, 'n2': n**2, 'n_te': n*te,
                             'n_tc': n*tc, 'n_tc_te': n*tc*te, 'n_te2': n*te**2})
    elif rpm_form == 'ln_n_lin':
        ln_n = np.log(n.clip(1e-6))
        return pd.DataFrame({'ln_n': ln_n, 'ln_n_te': ln_n*te, 'ln_n_tc': ln_n*tc,
                             'ln_n_tc_te': ln_n*tc*te, 'ln_n_te2': ln_n*te**2})
    elif rpm_form == 'ln_n_quad':
        ln_n = np.log(n.clip(1e-6))
        return pd.DataFrame({'ln_n': ln_n, 'ln_n2': ln_n**2, 'ln_n_te': ln_n*te,
                             'ln_n_tc': ln_n*tc, 'ln_n_tc_te': ln_n*tc*te, 'ln_n_te2': ln_n*te**2})
    else:
        raise ValueError(f"Unknown rpm_form: {rpm_form}")

# ----------------------------------------------------------------------
# 3. CROSS-VALIDATION FOR GLOBAL MODELS
# ----------------------------------------------------------------------
def cv_global_model(df, target_col, rpm_form, log_transform, alphas):
    X = make_global_features(df, rpm_form).values
    y_raw = df[target_col].values
    y = np.log(y_raw) if log_transform else y_raw
    groups = df['RPM'].values
    logo = LeaveOneGroupOut()
    best_alpha = None
    best_avg = np.inf
    best_folds = {}
    for alpha in alphas:
        fold_rmses = []
        fold_dict = {}
        for train_idx, test_idx in logo.split(X, y, groups):
            rpm_test = df.iloc[test_idx[0]]['RPM']
            X_tr, X_te = X[train_idx], X[test_idx]
            y_tr, y_te = y[train_idx], y[test_idx]
            scaler = StandardScaler()
            X_tr_s = scaler.fit_transform(X_tr)
            X_te_s = scaler.transform(X_te)
            model = Ridge(alpha=alpha)
            model.fit(X_tr_s, y_tr)
            pred = model.predict(X_te_s)
            if log_transform:
                pred_orig = np.exp(pred)
                y_te_orig = np.exp(y_te)
                rmse = np.sqrt(mean_squared_error(y_te_orig, pred_orig))
            else:
                rmse = np.sqrt(mean_squared_error(y_te, pred))
            fold_rmses.append(rmse)
            fold_dict[rpm_test] = rmse
        avg_rmse = np.mean(fold_rmses)
        if avg_rmse < best_avg:
            best_avg = avg_rmse
            best_alpha = alpha
            best_folds = fold_dict
    return best_alpha, best_avg, best_folds

# ----------------------------------------------------------------------
# 4. PIECEWISE MODEL (low‑range quadratic + lookup + interpolation)
# ----------------------------------------------------------------------
def fit_piecewise_low(df, target_col, split_rpm, alpha=1.0):
    df_low = df[df['RPM'] <= split_rpm].copy()
    N_low = split_rpm
    df_low['n'] = df_low['RPM'] / N_low
    df_low['te'] = df_low['T_E'] - CENTER_TE
    df_low['tc'] = df_low['T_C'] - CENTER_TC
    df_low['n2'] = df_low['n']**2
    df_low['n_te'] = df_low['n'] * df_low['te']
    df_low['n_tc'] = df_low['n'] * df_low['tc']
    df_low['n_tc_te'] = df_low['n'] * df_low['tc'] * df_low['te']
    df_low['n_te2'] = df_low['n'] * df_low['te']**2
    features = ['n', 'n2', 'n_te', 'n_tc', 'n_tc_te', 'n_te2']
    X = df_low[features].values
    y = df_low[target_col].values
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)
    model = Ridge(alpha=alpha)
    model.fit(X_s, y)
    return scaler, model, features, N_low

def evaluate_piecewise(df, target_col, split_rpm_input):
    """Piecewise RMSE and predictor. Returns (rmse, predict_func, scaler, model, features, N_low_eff, max_rpm, split_eff)"""
    max_rpm = df['RPM'].max()
    # Determine effective split: must be strictly less than max_rpm and exist in data
    if split_rpm_input >= max_rpm or split_rpm_input not in df['RPM'].values:
        # default to second highest RPM
        unique_rpms = sorted(df['RPM'].unique())
        if len(unique_rpms) >= 2:
            split_rpm = unique_rpms[-2]
        else:
            split_rpm = max_rpm  # fallback (no interpolation)
    else:
        split_rpm = split_rpm_input
    # If after adjustment split still >= max_rpm (only one RPM), piecewise is meaningless
    if split_rpm >= max_rpm:
        return np.inf, None, None, None, None, None, None, None

    df_low = df[df['RPM'] <= split_rpm].copy()
    if len(df_low) < 6:
        return np.inf, None, None, None, None, None, None, None

    scaler, model, features, N_low = fit_piecewise_low(df, target_col, split_rpm, alpha=1.0)

    # lookup for max RPM
    df_max = df[df['RPM'] == max_rpm]
    lookup = {}
    for _, row in df_max.iterrows():
        lookup[(row['T_E'], row['T_C'])] = row[target_col]

    def predict_piecewise(RPM, TE, TC):
        if RPM <= split_rpm:
            n = RPM / N_low
            te = TE - CENTER_TE
            tc = TC - CENTER_TC
            feat = np.array([n, n**2, n*te, n*tc, n*tc*te, n*te**2]).reshape(1, -1)
            feat_s = scaler.transform(feat)
            return model.predict(feat_s)[0]
        elif RPM == max_rpm:
            return lookup[(TE, TC)]
        else:  # split_rpm < RPM < max_rpm
            val_low = predict_piecewise(split_rpm, TE, TC)
            val_max = predict_piecewise(max_rpm, TE, TC)
            frac = (RPM - split_rpm) / (max_rpm - split_rpm)
            return val_low + (val_max - val_low) * frac

    preds = np.array([predict_piecewise(r['RPM'], r['T_E'], r['T_C']) for _, r in df.iterrows()])
    rmse = np.sqrt(mean_squared_error(df[target_col], preds))
    return rmse, predict_piecewise, scaler, model, features, N_low, max_rpm, split_rpm

# ----------------------------------------------------------------------
# 5. AUTO SPLIT DETECTION
# ----------------------------------------------------------------------
def auto_split_rpm(df, target_col):
    _, _, folds = cv_global_model(df, target_col, 'n_quad', log_transform=False, alphas=[0.001])
    if len(folds) < 2:
        return None
    rpms = list(folds.keys())
    errors = list(folds.values())
    median_err = np.median(errors)
    max_rpm = max(rpms)
    max_err = folds[max_rpm]
    if max_err > 2.0 * median_err and max_err > TARGET_RMSE:
        return max_rpm
    return None

# ----------------------------------------------------------------------
# 6. MAIN SELECTION
# ----------------------------------------------------------------------
def select_best_model(df, target_col, global_candidates, log_options, alphas, target_rmse):
    best_global_rmse = np.inf
    best_global_spec = None
    for rpm_form, label in global_candidates:
        for log_trans in log_options:
            alpha, avg_rmse, folds = cv_global_model(df, target_col, rpm_form, log_trans, alphas)
            if avg_rmse < best_global_rmse:
                best_global_rmse = avg_rmse
                best_global_spec = {
                    'rpm_form': rpm_form,
                    'log_transform': log_trans,
                    'alpha': alpha
                }
        if best_global_rmse <= target_rmse:
            return 'global', best_global_spec, best_global_rmse, None, None, None, None, None, None

    # Try piecewise
    split_rpm_input = PIECEWISE_SPLIT if PIECEWISE_SPLIT != 'auto' else auto_split_rpm(df, target_col)
    if split_rpm_input is None:
        split_rpm_input = df['RPM'].max()
    rmse_pw, pw_func, scaler_pw, model_pw, features_pw, N_low_eff, max_rpm, split_eff = evaluate_piecewise(df, target_col, split_rpm_input)
    if rmse_pw <= target_rmse:
        spec = {
            'split_eff': split_eff,
            'max_rpm': max_rpm,
            'N_low': N_low_eff,
            'predict_func': pw_func
        }
        return 'piecewise', spec, rmse_pw, scaler_pw, model_pw, features_pw, N_low_eff, max_rpm, split_eff
    return 'none', None, min(best_global_rmse, rmse_pw), None, None, None, None, None, None

# ----------------------------------------------------------------------
# 7. EQUATION PRINTING HELPERS
# ----------------------------------------------------------------------
def get_unscaled_coefficients(scaler, model, features):
    coefs = model.coef_
    intercept = model.intercept_
    means = scaler.mean_
    stds = scaler.scale_
    intercept_unscaled = intercept - np.sum(coefs * means / stds)
    coefs_unscaled = coefs / stds
    return intercept_unscaled, coefs_unscaled

def print_global_equation(df, target, spec):
    """Fit final global model on all data and print equation."""
    rpm_form = spec['rpm_form']
    log_trans = spec['log_transform']
    alpha = spec['alpha']
    X = make_global_features(df, rpm_form).values
    y_raw = df[target].values
    y = np.log(y_raw) if log_trans else y_raw
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)
    model = Ridge(alpha=alpha)
    model.fit(X_s, y)
    features_names = make_global_features(df, rpm_form).columns.tolist()
    intercept_u, coefs_u = get_unscaled_coefficients(scaler, model, features_names)
    print(f"\n{target} model: GLOBAL ({rpm_form}, log={log_trans})")
    if log_trans:
        print(f"ln({target}) = {intercept_u:.6f}", end='')
        for name, c in zip(features_names, coefs_u):
            if abs(c) > 1e-9:
                print(f" + {c:.6f} * {name}", end='')
        print(f"\n  -> {target} = exp( above )")
    else:
        print(f"{target} = {intercept_u:.6f}", end='')
        for name, c in zip(features_names, coefs_u):
            if abs(c) > 1e-9:
                print(f" + {c:.6f} * {name}", end='')
        print()

def print_piecewise_equation(df, target, scaler, model, features, N_low, split_eff, max_rpm):
    """Print low‑range quadratic equation and lookup table, using actual effective split."""
    intercept_u, coefs_u = get_unscaled_coefficients(scaler, model, features)
    print(f"\n{target} model: PIECEWISE")
    print(f"Low‑range equation (for RPM ≤ {split_eff}):")
    print(f"  n = RPM / {N_low}")
    print(f"  te = T_E - ({CENTER_TE})")
    print(f"  tc = T_C - ({CENTER_TC})")
    print(f"  {target} = {intercept_u:.6f}", end='')
    for name, c in zip(features, coefs_u):
        if abs(c) > 1e-9:
            print(f" + {c:.6f} * {name}", end='')
    print()
    print(f"At exactly {max_rpm} RPM, use lookup table:")
    df_max = df[df['RPM'] == max_rpm][['T_E', 'T_C', target]]
    for _, row in df_max.iterrows():
        print(f"  T_E={row['T_E']}, T_C={row['T_C']}  => {target} = {row[target]:.4f}")
    if split_eff < max_rpm:
        print(f"For {split_eff} < RPM < {max_rpm}: linear interpolation between low‑range prediction at {split_eff} RPM and table value at {max_rpm} RPM.")
    else:
        print("(No interpolation range; low‑range covers all RPMs up to max RPM.)")

# ----------------------------------------------------------------------
# 8. MAIN EXECUTION
# ----------------------------------------------------------------------
if __name__ == "__main__":
    df = load_data(FILEPATH, FILE_TYPE, SHEET_NAME, skiprows=SKIPROWS, usecols=USE_COLS)
    print(f"Data loaded: {df.shape[0]} points, RPMs = {sorted(df['RPM'].unique())}")

    global_candidates = [
        ('n_lin', 'Linear RPM'),
        ('n_quad', 'Quadratic RPM'),
        ('ln_n_lin', 'ln(RPM) linear'),
        ('ln_n_quad', 'ln(RPM) quadratic')
    ]
    log_options = [False, True]

    models = {}
    for target in ['W', 'Q']:
        print(f"\n--- Selecting model for {target} ---")
        mtype, spec, rmse, scaler_pw, model_pw, features_pw, N_low_eff, max_rpm, split_eff = select_best_model(
            df, target, global_candidates, log_options, ALPHAS, TARGET_RMSE
        )
        models[target] = (mtype, spec, rmse)
        if mtype == 'global':
            print(f"Chosen: GLOBAL ({spec['rpm_form']}, log={spec['log_transform']}) CV RMSE = {rmse:.3f}")
            print_global_equation(df, target, spec)
        elif mtype == 'piecewise':
            print(f"Chosen: PIECEWISE (effective split at {spec['split_eff']} RPM) train RMSE = {rmse:.3f}")
            print_piecewise_equation(df, target, scaler_pw, model_pw, features_pw, N_low_eff, split_eff, max_rpm)
        else:
            print(f"WARNING: No model meets target. Best RMSE = {rmse:.3f}")

    # Build unified predictor if both targets have valid models
    if models['W'][0] != 'none' and models['Q'][0] != 'none':
        if models['W'][0] == 'piecewise' and models['Q'][0] == 'piecewise':
            predict_W = models['W'][1]['predict_func']
            predict_Q = models['Q'][1]['predict_func']
            def predict(RPM, TE, TC):
                return predict_W(RPM, TE, TC), predict_Q(RPM, TE, TC)
            print("\nUnified predict() function ready.")
        else:
            print("\nMixed model types – implement separate predictors for W and Q.")
