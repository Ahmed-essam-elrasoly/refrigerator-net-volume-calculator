# Refrigerator Net Storage Volume Calculator

A web‑based parametric calculator that estimates the **net storage volume** and **thermodynamic performance** of a refrigerator from external cabinet dimensions and internal layout configurations. 
Built for product designers and engineers during the concept design phase.

## Features
*   **Geometric Modeling:** Input external cabinet dimensions (H×W×D) and per‑face wall/insulation thicknesses. Define 1 to 2 compartments (fresh food, freezer) via horizontal dividers[cite: 1].
*   **Volumetric Analysis:** Three volume outputs simultaneously (Gross Volume, Egyptian Net Volume ES 3794, IEC 62552 Net Volume) in liters and cubic feet, alongside Polyurethane (PU) volume and weight estimations[cite: 1].
*   **Thermal & Inverter Analysis:** Calculate heat loads, airflow, evaporator performance, and thermodynamic constraints for both Constant-Speed and Inverter compressors[cite: 1].
*   **Parametric Graphing:** Run calculation sweeps on independent variables and visualize dependent outputs using interactive charts[cite: 1].
*   **Utilities:** Save/load configurations (JSON), export results (CSV), view 2D CAD-like schematics, and run side‑by‑side comparisons of two saved states[cite: 1].

## Architecture Overview & Data Flow
The application is built on a decoupled, client-side architecture where the user interface serves strictly as an input scraper and rendering target. 
*   **DOM Scraping & Object Construction:** The application orchestrators (`main.js` for volume, `thermoUI.js` for thermal) scrape the DOM inputs to build unified geometry and layout objects[cite: 1].
*   **Dual Calculation Engines:** The system utilizes two independent calculation engines that share the scraped geometry[cite: 1].
    *   **Volume Engine:** Computes precise internal volumes via `traverseAndComputePrecise()`[cite: 1].
    *   **Thermal Engine:** Computes thermodynamic constraints and energy consumption via `runThermoAnalysis()`[cite: 1].

## Core Calculation Engines

### Volume Engine (`engine/index.js`, `traversal.js`, `validationPass1.js`, `calc.js`)
*   Handles all geometric abstraction and volumetric calculations[cite: 1].
*   Utilizes a **Two-Pass Validation Model**[cite: 1].
    *   **Pass 1:** Validates the structural and tree-shape integrity of the configuration[cite: 1].
    *   **Pass 2:** Validates specific dimensional constraints[cite: 1].
    *   **Blocking Condition:** If Pass 1 fails, Pass 2 is entirely blocked from execution[cite: 1].

### Thermal Engine (`engine/thermo/*`)
*   Calculates heat loads, airflow, and evaporator performance[cite: 1].
*   Supports both Constant-Speed and Inverter compressor modeling[cite: 1].
*   Generates analytical equations for Inverter models dynamically if enough data points are provided via user-uploaded Excel/CSV files[cite: 1].

## Schema Versioning & Data Migration
*Note: This is a critical path for debugging loaded JSON configuration files.*
*   The application employs a silent migration path for handling legacy save files[cite: 1].
*   The schema versioning system upgrades older `v1.0` files to `v2.0` automatically via `upgradeConfig()` within `geometry.js`[cite: 1].
*   Similarly, `compressorManager.js` utilizes an `ensureArrays()` utility to upgrade legacy compressor definitions, dynamically converting older keyed-object coefficients into the flat arrays required by the current solver matrix[cite: 1].

## Technology Stack
*   HTML / CSS / JavaScript (vanilla, no framework)[cite: 1].
*   `Chart.umd.js` (local vendor library) for parametric graphing[cite: 1].
*   Runs entirely in the browser – no installation required.

## Getting Started
Simply open `src/index.html` in a web browser[cite: 1].

## Status
Project in early development (concept phase). 
Refer to `docs/refrigerator_project_brief.docx` for detailed specifications.

## License
Confidential – internal use only.

## Acknowledgements
Eng. Abdelhameed Galal & Eng. Mohamed Elhady