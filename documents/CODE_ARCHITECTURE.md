# CODE_ARCHITECTURE.md

## I. System Architecture & Separation of Concerns

### 1.1 High-Level Topology
The application relies on a strict separation between the frontend Document Object Model (DOM) management and the mathematical calculation backend.
*   **UI Orchestration:** Managed primarily by `main.js` for volumetric parameters[cite: 1] and `thermoUI.js` for thermal parameter states[cite: 1].
*   **Geometric Volume Engine:** Contained within `engine/traversal.js` and `engine/calc.js`.
*   **Thermodynamic Solver:** Contained within the `engine/thermo/` directory, treating the geometric outputs as immutable inputs.

### 1.2 Data Flow Pipeline
The architecture enforces a unidirectional data flow pipeline triggered by user interaction:
1.  **DOM Scraping & Normalization:** `readGeometryFromPanel()` extracts and parses raw user inputs into standardized metric variables[cite: 1].
2.  **Geometric Object Construction:** `buildLayoutNodeForPrecise()` generates a hierarchical node tree representing the compartment ratios and physical layouts[cite: 1].
3.  **Engine Injection:** Data is passed to `traverseAndComputePrecise()` for volumetric limits[cite: 1] and subsequently to `runThermoAnalysis()` via `buildDefaultConfig()` for thermodynamic evaluation[cite: 1].
4.  **Result Render:** Outputs are formatted and injected back into the DOM via `displayPreciseResults()`[cite: 1] and `displayResults()`[cite: 1].

---

## II. Core Calculation Engines

### 2.1 Volume Engine (`traversal.js` & `calc.js`)
The volume engine traverses the generated geometric node tree to calculate absolute internal capacity. 
*   **Node Type System:** The engine anticipates three node types: `leaf`, `horizontal`, and `vertical`.
*   **Dead Code Clarification:** While the `vertical` split node type is defined within the schema (e.g., `types.js`), it is currently unhandled within the traversal logic which only processes horizontal root nodes. This is an incomplete feature and must be treated as dead code during integrations; attempting to pass a vertical split will fail silently or yield undefined geometric bounds.

### 2.2 Thermodynamic Engine Controller (`thermo/index.js` & `solver.js`)
The thermal engine operates as a black-box solver. It is initialized by passing a consolidated configuration payload from `thermoUI.js`[cite: 1]. The engine computes the mass flow, evaporating temperatures, and input power dynamically, fully decoupled from the UI state variables[cite: 1].

---

## III. Rigid Validation Framework

### 3.1 Two-Pass Validation Model
The execution pathway utilizes a strict fail-fast validation structure.
*   **Pass 1 (Structural Validation):** Evaluates the tree-shape integrity and compartment topology. If a structural impossibility is detected, the engine throws a hard failure, immediately halting execution and completely blocking Pass 2.
*   **Pass 2 (Dimensional Validation):** Evaluates physical dimensional constraints, ensuring boundaries do not collide, overlap, or yield negative physical volumes (e.g., internal component displacements exceeding compartment bounds).

### 3.2 Error and Warning Dispatch
The engine returns an object containing `{ leaves, errors, warnings }`[cite: 1]. 
*   **Errors** halt the rendering of schemas and numerical tables. They are passed directly to the UI layer and injected into the DOM (`<p class="error">`)[cite: 1].
*   **Warnings** indicate sub-optimal but mathematically resolvable configurations (e.g., fallback compressor substitutions)[cite: 1]. Execution proceeds, but alerts are raised to the operator (`<p class="warning">`)[cite: 1].

---

## IV. State Management & Data Structures

### 4.1 Configuration Schema Reference
The global state is preserved using a unified JSON format handled by local storage and file I/O protocols.
*   `cabinet.geometry`: Defines the absolute external dimensions (H, W, D) and wall thicknesses[cite: 1].
*   `cabinet.layout`: Contains the recursive node tree detailing compartment segmentation (`_compartments`)[cite: 1].
*   `thermal`: Stores the environmental and hardware constants (e.g., T0, TF, TR, selected compressor ID, and fan parameters)[cite: 1].

### 4.2 Schema Versioning & Migrations (`geometry.js`)
The transition from schema `v1.0` to `v2.0` is managed silently via the `upgradeConfig()` function. 
*   **Migration Warning:** `v1.0` utilized basic approximation models for structural dimensions. When parsing a legacy `v1.0` file, `upgradeConfig()` translates these approximations into absolute physical coordinates. Certain legacy fallback variables are irreversibly discarded in this process. Developers debugging saved states must check the `schemaVersion` header to trace layout origin.

---

## V. Module Map & Dependency Graph

### 5.1 File Registry
| Module Path | Primary Responsibility |
| :--- | :--- |
| `js/main.js` | Primary UI orchestrator for volumetric parameters; binds the DOM, manages dynamic inputs, and handles 2D canvas rendering dispatch[cite: 1]. |
| `js/ui/thermoUI.js` | Binds the thermal analysis tabs; scrapes inputs, manages advanced settings, and invokes the thermal engine[cite: 1]. |
| `js/ui/schematic.js` | Generates the 2D CAD-like canvas representations (`drawFrontView`, `drawSideView`) mapping abstract coordinates to pixels[cite: 1]. |
| `js/ui/graphUI.js` | Manages parametric sweep calculations and binds dynamic charting via Chart.js[cite: 1]. |
| `js/compressorManager.js` | Manages the available compressor catalog, standardizes coefficient arrays, and handles legacy data migrations[cite: 1]. |
| `js/settings.js` | Global application state manager; handles deep merging and local storage persistence for UI preferences and advanced parameters[cite: 1]. |

### 5.2 Known Technical Debt
Critical algorithmic redundancies exist across the codebase that pose immediate maintenance risks:
1.  **Polyurethane (PU) Estimations:** The formulas used to deduce cabinet and door PU volume/weight are duplicated. They are manually calculated in `main.js` (`displayPreciseResults()`)[cite: 1], again in `main.js` (`buildComparisonTable()`)[cite: 1], and within the legacy `io.js` implementations. Modification to PU math requires updating all redundant blocks until refactored into a single geometry utility.
2.  **Energy Rating (IEE) Methodology:** The logic used to establish EU/EN energy labels (Rank_27, Rank_29, Rank_31) is hardcoded inside `thermoUI.js` (`displayResults()`)[cite: 1] and replicated exactly inside `main.js` (`buildComparisonTable()`)[cite: 1]. This logic must be extracted into a centralized physics calculation layer.