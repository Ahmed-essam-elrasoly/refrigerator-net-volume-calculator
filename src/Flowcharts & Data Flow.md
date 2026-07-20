graph TD
    A[User clicks 'Calculate'] --> B[main.js: readGeometryFromPanel]
    B --> C[main.js: buildLayoutNodeForPrecise]
    C --> D[engine/traversal.js: traverseAndComputePrecise]
    
    subgraph Geometric Engine
    D --> E[Calculate Gross Boundaries]
    D --> F[Compute Obstacles: Rails, Dikes, Evap, Ctrl Box]
    F --> G[Subtract Obstacles from Gross]
    end
    
    G --> H[main.js: displayPreciseResults]
    G --> I[ui/schematic.js: drawFrontView / drawSideView]
    H --> J[Render Volumes & PU Estimates to UI]
    I --> K[Render 2D Canvas Overlays]

graph TD
    A[User clicks 'Run Thermal Analysis'] --> B[thermoUI.js: getGeometryFn]
    B --> C[thermoUI.js: computeFanAirflow]
    
    subgraph Compressor Data Prep
    D[Compressor Data loaded via Excel] --> E[thermoUI.js: fitInverterCoefficients / computeCompressorCoefficients]
    E --> F[Polynomial & Equation Storage]
    end
    
    C --> G[thermo/index.js: buildDefaultConfig]
    F --> G
    
    subgraph Thermodynamic Solver Loop
    G --> H[thermo/solver.js: runThermoAnalysis]
    H --> I[Calculate Heat Loads QF, QR, QEV]
    H --> J[Iterate TC, TE, Mass Flow against Compressor Limits]
    J --> K[Check Convergence]
    K -- No --> J
    K -- Yes --> L[Final Operating State]
    end
    
    L --> M[thermo/solver.js: EnergyConsumption]
    M --> N[thermoUI.js: displayResults]
    N --> O[Render COP, Energy, Temperatures to UI]