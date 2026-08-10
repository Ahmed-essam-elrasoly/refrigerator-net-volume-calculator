# PHYSICS_AND_MATH.md

## I. Volumetric and Geometric Formulations

### 1.1 Compartment Nodal Traversal
The geometric evaluation relies on a hierarchical tree-shape traversal model. The internal volume is discretized into compartmental leaf nodes—specifically designated as `freezer` or `fresh`—originating from a horizontal root layout[cite: 1]. Gross volumes are derived from internal compartment heights, widths, and depths before being systematically reduced by subtracting internal physical constraints.

### 1.2 Stepped-Floor Polygon Definition
The lower boundary of the cabinet accounts for the compressor hump geometry through a trapezoidal volumetric deduction. The cutout volume $V_{cutout}$ is calculated using the following dimensional variables: overall width $W$, vertical step height $H_b$, and the two depth dimensions of the step, $D_{b1}$ and $D_{b2}$[cite: 1].

$$V_{cutout} = \frac{1}{2} H_b (D_{b1} + D_{b2}) W$$

The effective exterior volume $V_{ext}$ is therefore the standard rectangular cuboid minus this cutout:

$$V_{ext} = (H \cdot W \cdot D) - V_{cutout}$$

### 1.3 Wall Thickness Resolution
The global coordinate boundary mapping for wall thicknesses is dynamically resolved based on the compartment configuration (e.g., top-freezer versus bottom-freezer). The effective exterior structural thicknesses are established by finding the maximum bounds across the vertical stack for the `top`, `bottom`, `left`, `right`, `rear`, and `door` walls[cite: 1]. Specific base floor layers are mapped via `bottom1`, `bottom2`, and `bottom3` vectors to accurately constrain the Y-axis floor elevation[cite: 1].

### 1.4 Polyurethane (PU) Volume Estimation
Polyurethane volume estimations isolate the pure structural cavity space from gross volume and internal dike displacements. The estimation treats the door and cabinet PU distinctly.

The perimeter displacement for door dikes is formulated as:
$$V_{dikes} = A_{dike} \cdot \text{perimeter}$$

Where $A_{dike} = \frac{1}{2} H_{dike} (W_{base} + W_{top})$[cite: 1].

The total cabinet PU volume $V_{cabPU}$ is calculated as:
$$V_{cabPU} = V_{ext} - V_{gross} - \Sigma V_{dikes} + V_{dividerPU}$$[cite: 1]

---

## II. Thermodynamic Solver Architecture

### 2.1 System Energy Balance Equations
The thermodynamic numerical solver relies on satisfying three absolute boundary constraints simultaneously to achieve a converged state.
*   **Freezer Mass Balance:** $F_1(m_f, m_r) = 0$
*   **System Capacity Balance:** $F_2(Q_{evap}, Q_{comp}) = 0$
*   **Condenser Heat Rejection Balance:** $F_3(Q_{cond}, Q_{comp}, W_{in}) = 0$

### 2.2 Numerical Methods Pipeline
The solver architecture executes in a nested triad:
1.  **Outer Iteration (Secant Method):** Minimizes the residual of the capacity balance by adjusting the assumed condensing temperature ($T_C$) and capacity constraints.
2.  **Inner Iteration (2D Newton-Raphson):** Solves the coupled non-linear equations for the evaporator outlet temperature ($T_2$) against either the compressor Running Ratio (PR) for constant-speed models or RPM for inverter configurations[cite: 1].
3.  **Sub-Routine (Brent's Method):** Isolates the exact evaporating temperature ($T_E$) root required to satisfy the Log Mean Temperature Difference (LMTD) and resultant evaporator capacity.

### 2.3 Fail-Fast Validation Constraints
Execution is heavily gated by geometric and mathematical domain constraints. The codebase enforces boundary error handling that aborts processing if the structural node tree implies negative dimensions, or if empirical limits (e.g., required RPM drops below physically valid compressor limits) are breached[cite: 1]. 

---

## III. Empirical Component Models

### 3.1 Compressor Power & Efficiency Polynomials
Compressor outputs (volumetric efficiency $\eta_v$ and input power $W$) are governed by differing polynomial regressions based on hardware type.

**Constant-Speed:**
Modeled using a 5-term polynomial for input power and a 3-term polynomial for volumetric efficiency[cite: 1]:
$$W = A_W + B_W T_E + C_W T_C + D_W T_E + E_W$$
$$\eta_v = A + B \left(\frac{P_c}{P_e}\right) + C P_c$$

**Inverter:**
Modeled using a multi-variable Ridge regression matrix[cite: 1]. The architecture supports both global polynomials and piecewise regressions segmented across specific RPM breakpoints[cite: 1]. The `n_quad` equation format dictates:
$$f(n, T_E, T_C) = c_1 n + c_2 n^2 + c_3 n T_E + c_4 n T_C + c_5 n T_C T_E + c_6 n T_E^2$$[cite: 1]

### 3.2 Suction Line Heat Exchanger (SLHX) Balance
The SLHX module calculates the enthalpy exchange boundary. Subcooling liquid from the condenser transfers heat to the returning vapor, defined explicitly by the approach temperature differentials and specific heat capacities of the refrigerant.

### 3.3 Evaporator Heat Transfer
Total air mass flow across the evaporator is the sum of freezer ($M_F$) and fresh food ($M_R$) flow rates[cite: 1]. Mixed inlet temperature ($T_1$) is algebraically resolved before applying LMTD logic:

$$T_1 = \frac{M_F T_F + M_R T_R}{M_F + M_R}$$

The overall evaporator capacity $Q_{evap}$ scales linearly with the calculated heat transfer coefficient $\alpha$ and LMTD[cite: 1]:

$$Q_{evap} = \alpha \cdot A_{evap} \cdot \text{LMTD}$$

---

## IV. Energy Rating Analytics

### 4.1 Index of Energy Efficiency (IEE)
The system's energy ranking conforms directly to regulatory constraints (derived from EU/EN labelling methodology). Ranks are partitioned into threshold bands: A ($\leq 0.45$), B ($\leq 0.55$), C ($\leq 0.65$), and D ($\leq 0.75$)[cite: 1].

The standard energy equivalent ($ES$) varies by tested ambient temperature limits (27°C, 29°C, 31°C) and utilizes structural constants:
$$AV = \left( V_{freezer} \cdot \frac{25 - T_F}{21} \right) + V_{fresh}$$
$$ES_{27} = AV \cdot 0.57 + (800 \cdot 0.9)$$[cite: 1]
$$ES_{29} = AV \cdot 0.57 + (800 \cdot 0.8)$$[cite: 1]
$$ES_{31} = AV \cdot 0.57 + (800 \cdot 0.6)$$[cite: 1]

The finalized IEE index evaluates annualized consumption against this baseline:
$$\text{IEE} = \frac{E_{monthly} \cdot 12}{ES}$$[cite: 1]

### 4.2 Peak-Load Safety Constraints
The model strictly injects a 43°C ambient temperature override check to confirm peak-load compressor viability[cite: 1]. This ensures structural and mechanical conformity with the Tropical (T) climate class certification limits before allowing standard $25^\circ\text{C}$ or $32^\circ\text{C}$ evaluations to proceed.