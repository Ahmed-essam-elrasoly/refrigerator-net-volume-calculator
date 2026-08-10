# USER_MANUAL.md

## I. Interface Overview

### 1.1 Application Layout
The application interface is strictly bifurcated to separate input mechanics from output visualizations. The left-hand panel serves as the primary data entry interface, housing all geometric, thermal, and configuration inputs. The right-hand panel provides real-time, dynamic outputs, rendering the 2D schematic diagrams (front and side views) and displaying the final numerical thermal results table. 

### 1.2 Tab Navigation
The interface is organized into three specific operational tabs that govern the calculation context:
*   **Volume Tab:** Manages all physical cabinet dimensions, internal compartment layouts, wall thicknesses, and structural obstacles.
*   **Thermal Tab:** Dedicated to constant-speed compressor evaluations, requiring standard environmental inputs and refrigerant selections.
*   **Inverter Tab:** Dedicated to variable-speed compressor evaluations, utilizing the same base geometry but altering the thermal solver to account for variable RPM requirements.

### 1.3 The Parametric Graph
For comprehensive design analysis, the application includes a parametric sweep tool accessed via the "Parametric Graph" button. This feature allows operators to select an independent variable (the X-Axis) and define a specific minimum, maximum, and step range. The user can then select multiple dependent output variables (the Y-Axis) from a checklist to execute iterative backend calculations, generating a continuous plot of the system's performance boundaries.

---

## II. Geometric Configuration (Volume Tab)

### 2.1 Cabinet Dimensions
Accurate structural volume calculations require precise exterior dimensions. Operators must define the overall Height (H), Width (W), and Depth (D) of the cabinet in millimeters. Furthermore, the stepped-floor geometry accommodating the compressor requires exact parameters: the vertical step height (Hb) and the two corresponding depth dimensions (Db1, Db2). 

### 2.2 Compartment Definitions
The calculator supports either single or dual compartment architectures. Operators can select 1 or 2 compartments and define the exact partition divider thickness. For each compartment, the user specifies the internal height ratio, the number of shelves, and the structural insulation thickness for the top, bottom, left, right, rear, and door boundaries. 

### 2.3 Internal Obstacles & Fallback Defaults
To calculate the true usable net volume, physical obstacles must be subtracted from the gross cavity. Input fields are provided for the Evaporator depth, Control Box dimensions, and R-Shower dimensions. 

If an operator loads a partial JSON configuration file or leaves fields blank, the system silently injects hardcoded fallback defaults to prevent mathematical execution failures. These absolute defaults are:
*   **Evaporator Depth:** 85 mm.
*   **Control Box Height:** 150 mm.
*   **Control Box Width:** 500 mm.
*   **Control Box Length:** 100 mm.
*   **R-Shower Height:** 700 mm.
*   **Bottom Insulation Layers (1, 2, 3):** 40 mm.

### 2.4 Volume Output Metrics
Upon clicking "Calculate", the engine processes the node tree and populates the Volume Results panel. This display strictly differentiates between **Gross Volume** (the raw internal cavity minus the compressor step) and **Total/Usable Volume** (the gross volume minus evaporators, control boxes, rails, and dikes). Additionally, the system provides precise Polyurethane (PU) estimations, yielding the total expected volume (in Liters) and weight (in kg) for the main cabinet and the individual doors.

---

## III. Thermal & Inverter Simulation

### 3.1 Environmental Parameters
Prior to running a thermodynamic solver, environmental baselines must be established. The operator must input the target operating temperatures in degrees Celsius for the Ambient environment (T0), the Freezer compartment (TF), and the Refrigerator compartment (TR). The system also requires the selection of a specific refrigerant gas index (e.g., R-600a, R-134a).

### 3.2 Constant-Speed vs. Inverter
The execution requirements differ strictly based on the compressor hardware:
*   **Thermal Analysis (Constant-Speed):** Evaluates the system using standard, fixed-RPM performance tables. 
*   **Inverter Analysis (Variable-Speed):** Bypasses the fixed-speed parameters and requires the operator to explicitly define a target **Running Ratio (PR)**. This PR value must be a valid decimal between 0.01 and 1. The inner numerical solver will iteratively determine the required compressor RPM to satisfy this designated running ratio.

### 3.3 Advanced Thermal Settings
Clicking the "Advanced" button opens a critical configuration modal. This menu bypasses the base UI to allow granular manipulation of the heat transfer mathematics, including:
*   **Condenser:** Side and back pipe pitch dimensions in millimeters.
*   **Evaporator:** Physical dimensions, tube outer diameter (OD), fin height, fin length, and total number of fins.
*   **Fan Parameters:** Tip diameter and operational RPM.
*   **Electrical Loads:** Base input power for the fan, PWB active/standby power, and defrost heater wattage paired with its daily operational duration in minutes.

---

## IV. Custom Compressor Ingestion

### 4.1 Supported File Formats
The application utilizes an onboard Excel/CSV parser to ingest raw compressor performance data. Users can upload standard `.xlsx`, `.xls`, or `.csv` files directly via the "Add Custom Compressor" modal interface. 

### 4.2 Minimum Data Requirements
To successfully execute the polynomial regression fits (Ordinary Least Squares for constant-speed or Ridge regression for inverters), the uploaded dataset must contain an absolute minimum of 5 valid, non-null data points. Files providing fewer points will trigger a hard validation error.

### 4.3 Column Header Formatting (Fuzzy Matching)
The file parser ignores strict column order and relies on fuzzy substring matching within the header row to identify parameters. To ensure successful ingestion, the headers must conform to the following substring rules:
*   **Evaporating Temperature (°C):** The header must contain `te` or `evap temp`.
*   **Condensing Temperature (°C):** The header must contain `tc` or `cond temp`.
*   **Input Power (W):** The header must contain `w` or `power`.
*   **Cooling Capacity (W):** The header must contain `q` or `capacity`.
*   **Compressor Speed (Inverter Only):** The header must contain `rpm`, `speed`, or `r/min`.

### 4.4 Handling Fit Failures
If the mathematical regression step fails (e.g., due to a singular matrix or non-converging data), the modal will output a "Fitting failed" error string. To resolve this, operators must inspect the source CSV to ensure no invalid characters exist, ensure temperature limits do not represent physically impossible conditions, and verify the minimum 5-point data threshold is met.

---

## V. State Management & I/O

### 5.1 Saving and Loading (.json)
The entire operational state of the calculator can be serialized and exported. Clicking "Save JSON" generates a comprehensive schema (v2.0) file containing the strict geometric object tree, hardware fittings, and advanced thermal boundary limits. Clicking "Load JSON" will parse an existing file, silently rebuild the internal data dictionaries, and immediately sync the visual UI inputs to match the loaded state without triggering an immediate calculation.

### 5.2 CSV Export
To extract the resulting output data rather than the input configuration, the operator uses the "Export CSV" function. This triggers a data dump of the most recent calculation cache, flattening the hierarchical volume results, the PU mass estimations, and the specific thermodynamic operating points into a readable spreadsheet.

### 5.3 Side-by-Side Comparison (Slots A & B)
The system facilitates direct delta evaluation between two different hardware or geometric setups.
1.  Run a successful calculation.
2.  Click **"Store Slot A"** to commit the state to local memory.
3.  Modify the parameters (e.g., switch the compressor or alter the compartment ratios) and recalculate.
4.  Click **"Store Slot B"** to commit the new state.
5.  Click **"Compare"** to render a side-by-side modal table. This comparison explicitly aligns Gross/Total volumes, precise PU weights, operating temperatures ($T_C$, $T_E$, $T_2$), mass flows, and the standardized Index of Energy Efficiency (IEE) rankings across multiple ambient test classes (Rank_27, Rank_29, Rank_31).