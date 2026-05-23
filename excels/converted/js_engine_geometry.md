# geometry.js

**Original file:** `geometry.js`

**File type:** .JS

**Size:** 4,196 bytes

**Last modified:** 2026-05-16 00:28:00


---

## Content

```javascript
// src/js/engine/geometry.js

export const DEFAULT_CABINET = Object.freeze({
  // External dimensions (mm)
  H: 1680,  W: 800,  D: 630,

  // Bottom heel / machine compartment (mm)
  Hb: 260,
  Db1: 210,
  Db2: 230,

  // Door gap & packing position (mm)
  doorGap: 10,
  packingPos: 15,

  // Air gap (mm) – no longer used in calculations
  airGap: 5,
});

export function toVolumeFormat(geom) {
  const { H, W, D, walls } = geom;
  const t = {
    fresh: {
      top: walls.refrigerator.top,
      bottom: walls.refrigerator.bottom1,
      left: walls.refrigerator.left,
      right: walls.refrigerator.right,
      rear: walls.refrigerator.rear,
      door: walls.refrigerator.door
    },
    freezer: {
      top: walls.freezer.top,
      bottom: walls.freezer.bottom,
      left: walls.freezer.left,
      right: walls.freezer.right,
      rear: walls.freezer.rear,
      door: walls.freezer.door
    },
    flex: {
      top: walls.refrigerator.top,
      bottom: walls.refrigerator.bottom1,
      left: walls.refrigerator.left,
      right: walls.refrigerator.right,
      rear: walls.refrigerator.rear,
      door: walls.refrigerator.door
    }
  };
  return {
    external: { height: H, width: W, depth: D },
    wallThicknessesByType: t,
    airGap: 0
  };
}

export function toThermalFormat(geom) {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos, walls } = geom;
  return {
    H, W, D,
    Hf, Hr,
    Hb, Db1, Db2,
    doorGap, packingPos,
    tFtop:    walls.freezer.top,
    tFleft:   walls.freezer.left,
    tFright:  walls.freezer.right,
    tFbottom: walls.freezer.bottom,
    tFdoor:   walls.freezer.door,
    tEvaBack: walls.freezer.rear,
    tRtop:    walls.refrigerator.top,
    tRleft:   walls.refrigerator.left,
    tRright:  walls.refrigerator.right,
    tRback:   walls.refrigerator.rear,
    tRbottom1:walls.refrigerator.bottom1,
    tRbottom2:walls.refrigerator.bottom2,
    tRbottom3:walls.refrigerator.bottom3,
    tRdoor:   walls.refrigerator.door,
  };
}

/**
 * Upgrade an old configuration (v1.0) to the new unified format.
 * Old config: { schemaVersion:"1.0", meta:{...}, cabinet:{ external, wallThicknessesByType, airGap, layout } }
 * Returns a valid v2.0 config.
 */
export function upgradeConfig(oldConfig) {
  if (!oldConfig?.cabinet) throw new Error('Invalid old config');

  const { external, wallThicknessesByType, airGap, layout } = oldConfig.cabinet;
  const def = DEFAULT_CABINET;

  const walls = {
    freezer: {
      top:    wallThicknessesByType?.freezer?.top    ?? def.walls.freezer.top,
      bottom: wallThicknessesByType?.freezer?.bottom ?? def.walls.freezer.bottom,
      left:   wallThicknessesByType?.freezer?.left   ?? def.walls.freezer.left,
      right:  wallThicknessesByType?.freezer?.right  ?? def.walls.freezer.right,
      door:   wallThicknessesByType?.freezer?.door   ?? def.walls.freezer.door,
      rear:   def.walls.freezer.rear   // old format had no "rear" for freezer
    },
    refrigerator: {
      top:    wallThicknessesByType?.fresh?.top    ?? def.walls.refrigerator.top,
      bottom1:wallThicknessesByType?.fresh?.bottom ?? def.walls.refrigerator.bottom1,
      bottom2:def.walls.refrigerator.bottom2,
      bottom3:def.walls.refrigerator.bottom3,
      left:   wallThicknessesByType?.fresh?.left   ?? def.walls.refrigerator.left,
      right:  wallThicknessesByType?.fresh?.right  ?? def.walls.refrigerator.right,
      door:   wallThicknessesByType?.fresh?.door   ?? def.walls.refrigerator.door,
      rear:   def.walls.refrigerator.rear
    }
  };

  const geom = {
    H: external.height,
    W: external.width,
    D: external.depth,
    Hf: def.Hf,
    Hr: def.Hr,
    Hb: def.Hb,
    Db1: def.Db1,
    Db2: def.Db2,
    doorGap: def.doorGap,
    packingPos: def.packingPos,
    airGap: airGap ?? def.airGap,
    walls
  };

  return {
    schemaVersion: '2.0',
    meta: {
      ...oldConfig.meta,
      updatedAt: new Date().toISOString(),
      upgradedFrom: oldConfig.schemaVersion
    },
    cabinet: {
      geometry: geom,
      layout
    }
  };
}
```


---

*Converted from `geometry.js` on 2026-05-23 11:54:20*
