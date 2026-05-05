/**
 * @file types.js
 * JSDoc type definitions shared across the calculation and validation engines.
 * No runtime code — import this file for IDE type hints only.
 */

/**
 * @typedef {Object} ExternalDims
 * @property {number} height - mm
 * @property {number} width  - mm
 * @property {number} depth  - mm
 */

/**
 * Available space passed down the node tree.
 * All values in mm. Derived once per node from parent context.
 * @typedef {Object} Space
 * @property {number} width
 * @property {number} height
 * @property {number} depth
 */

/**
 * @typedef {Object} Shelf
 * @property {string} id
 * @property {number} positionFromFloor - mm
 * @property {number} thickness         - mm
 * @property {number} depth             - mm
 * @property {number|null} width        - mm; null = full availableWidth
 */

/**
 * @typedef {Object} Drawer
 * @property {string} id
 * @property {number} outerWidth
 * @property {number} outerDepth
 * @property {number} outerHeight
 * @property {number} wallThickness
 */

/**
 * @typedef {Object} DoorBin
 * @property {string} id
 * @property {number} outerWidth
 * @property {number} outerHeight
 * @property {number} outerDepth
 * @property {number} wallThickness
 */

/**
 * @typedef {Object} HousingVolume
 * @property {number|null} volume - L; null = not present
 */

/**
 * @typedef {Object} FittingConfig
 * @property {Shelf[]}       shelves
 * @property {Drawer[]}      drawers
 * @property {DoorBin[]}     doorBins
 * @property {HousingVolume} iceMakerHousing
 * @property {HousingVolume} lightHousing
 */

/**
 * @typedef {Object} LeafNode
 * @property {'leaf'}       nodeType
 * @property {string}       id
 * @property {'fresh'|'freezer'|'flex'} type
 * @property {FittingConfig} fittings
 */

/**
 * @typedef {Object} HorizontalChild
 * @property {'ratio'|'explicit'} heightMode
 * @property {number}             heightValue
 * @property {Node}               node
 */

/**
 * @typedef {Object} Divider
 * @property {number} afterChildIndex
 * @property {number} thickness
 */

/**
 * @typedef {Object} HorizontalSplitNode
 * @property {'horizontal'}    nodeType
 * @property {string}          id
 * @property {HorizontalChild[]} children
 * @property {Divider[]}       dividers
 */

/**
 * @typedef {Object} VerticalSplitNode
 * @property {'vertical'} nodeType
 * @property {string}     id
 * @property {number}     dividerThickness
 * @property {number}     leftWidthRatio
 * @property {Node}       left
 * @property {Node}       right
 */

/**
 * @typedef {LeafNode|HorizontalSplitNode|VerticalSplitNode} Node
 */

/**
 * @typedef {Object} CabinetConfig
 * @property {string}         schemaVersion
 * @property {{ name: string, createdAt: string, updatedAt: string }} meta
  * @property {{ external: ExternalDims, wallThicknessesByType: WallThicknessesByType, airGap: number, layout: Node }} cabinet
 */

/**
 * @typedef {Object} WallThicknessesByType
 * @property {Object} fresh - {top, bottom, left, right, rear, door}
 * @property {Object} freezer
 * @property {Object} flex
 */
/**
 * Per-leaf volume result. All volumes in L at full precision.
 * Rounded values are derived at display time only.
 * @typedef {Object} LeafResult
 * @property {string}  leafId
 * @property {string}  leafType
 * @property {Space}   space        - resolved available space (mm)
 * @property {number}  gross        - L, full precision
 * @property {number}  egNet        - L, full precision
 * @property {number}  iecNet       - L, full precision
 * @property {string[]} fittingErrors - ids of fittings excluded due to validation failure
 */

/**
 * @typedef {Object} Totals
 * @property {number} gross  - L
 * @property {number} egNet  - L
 * @property {number} iecNet - L
 */

/**
 * @typedef {Object} ValidationError
 * @property {string}  rule
 * @property {string}  [nodeId]
 * @property {string}  message
 * @property {boolean} [childrenSkipped]
 */

/**
 * @typedef {Object} CalcError
 * @property {string} rule
 * @property {string} message
 */

/**
 * @typedef {Object} Warning
 * @property {string} rule
 * @property {string} message
 */

/**
 * Top-level result returned by runCalculation().
 * errors[] is always present; non-empty means output should be flagged.
 * @typedef {Object} CalcResult
 * * @property {FittingConfig} fittings    
 * @property {Totals|null}          totals
 * @property {ValidationError[]}    validationErrors
 * @property {CalcError[]}          calcErrors
 * @property {Warning[]}            warnings
 */
