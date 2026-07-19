/**
 * @file types.js
 * JSDoc type definitions shared across the calculation and validation engines.
 * No runtime code — import this file for IDE type hints only.
 */

/**
 * @typedef {Object} ExternalDims
 * @property {number} height - Exterior height in mm
 * @property {number} width  - Exterior width in mm
 * @property {number} depth  - Exterior depth in mm
 */

/**
 * Available space passed down the node tree for volumetric calculations.
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
 * Fittings configuration for a leaf compartment (shelves, drawers, bins).
 * @typedef {Object} FittingConfig
 * @property {Shelf[]}       shelves
 * @property {number}        [shelfCount]    // Total count, calculated automatically
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
 * Union type representing any node in the layout tree.
 * @typedef {LeafNode|HorizontalSplitNode|VerticalSplitNode} Node
 */

/**
 * @typedef {Object} CabinetConfig
 * @property {string}         schemaVersion
 * @property {{ name: string, createdAt: string, updatedAt: string }} meta
 * @property {{ geometry: Object, layout: Node }} cabinet
 */

/**
 * @typedef {Object} WallThicknessesByType
 * @property {Object} fresh - {top, bottom, left, right, rear, door}
 * @property {Object} freezer
 * @property {Object} [flex] - optional
 */

/**
 * Per-leaf volume result (gross only).
 * @typedef {Object} LeafResult
 * @property {string} leafId
 * @property {number} gross - Litres
 */

/**
 * @typedef {Object} Totals
 * @property {number} gross  - Litres
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
 * Final result returned by the calculation engine.
 * @typedef {Object} CalcResult
 * @property {LeafResult[]}         leaves
 * @property {Totals|null}          totals
 * @property {ValidationError[]}    validationErrors
 * @property {CalcError[]}          calcErrors
 * @property {Warning[]}            warnings
 */