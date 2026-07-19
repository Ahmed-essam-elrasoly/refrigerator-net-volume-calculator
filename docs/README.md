# Refrigerator Volume & Thermal Cycle Calculator

## Overview
An offline-first, client-side web application for the conceptual design of refrigerator cabinets. It performs precise volumetric analysis based on abstract geometric inputs and conducts thermodynamic cycle simulations to balance heat loads against compressor performance models (both constant-speed and inverter types).

## Core Capabilities

### 1. Geometric & Volumetric Engine
Calculates true usable space by evaluating the cabinet's exterior boundaries and systematically subtracting internal elements.
* **Inputs:** Overall dimensions (H, W, D), wall thicknesses, divider thicknesses, door gaps, and specific obstacle geometries (evaporator depth, control box dimensions, R-Shower dimensions, shelf rails, and door dikes).
* **Outputs:** Gross Volume (L / cu.ft), Total Usable Volume, Per-compartment breakdowns, and Polyurethane (PU) volume/weight estimations for the cabinet and doors.
* **Visuals:** Auto-generates scaled 2D Front and Side schematic views.

### 2. Thermodynamic Solver
Resolves the refrigeration cycle by balancing the calculated thermal loads of the physical geometry against imported compressor performance data.
* **Inputs:** Target compartment temperatures ($T_F$, $T_R$), ambient temperature ($T_0$), refrigerant type, defrost heater wattage, fan parameters (RPM, diameter), and Excel-imported compressor data (TE, TC, W, Q, and RPM).
* **Outputs:** System condensing/evaporating temperatures ($T_C$, $T_E$), required compressor RPM (for inverters), volumetric efficiency ($\eta_v$), cooling capacity, COP, mass flow rate, and estimated daily/monthly energy consumption (kWh).

## System Architecture

The codebase enforces a strict separation of concerns between the user interface and the underlying calculation engines:

*   `/js/ui/`: Presentation layer containing interface controllers (`thermoUI.js`, `settingsModal.js`) and Canvas 2D rendering (`schematic.js`).
*   `/js/engine/`: The geometric core (`calc.js`, `geometry.js`, `traversal.js`) responsible for calculating spatial constraints and structural volumes.
*   `/js/engine/thermo/`: The physics engine. Solves for heat loads, maps compressor performance using polynomial coefficients, and executes iterative numerical balancing (`solver.js`).
*   `/js/io/`: Manages state serialization (`io.js`), allowing users to save/load JSON configurations and export CSV results.