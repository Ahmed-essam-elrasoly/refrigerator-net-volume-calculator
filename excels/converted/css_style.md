# style.css

**Original file:** `style.css`

**File type:** .CSS

**Size:** 3,937 bytes

**Last modified:** 2026-05-12 22:54:06


---

## Content

```css
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background: #f8f9fa;
    color: #333;
    height: 100vh;
    overflow: hidden;      /* prevent page-level scrolling */
}

.page {
    display: flex;
    height: 100vh;
    overflow: hidden;
}

.left-panel {
  flex: 0 0 450px;           /* initial width; overridden by JS */
  overflow-y: auto;
  padding: 10px 15px;
  box-sizing: border-box;
}

.splitter {
  flex: 0 0 5px;
  background: #ccc;
  cursor: col-resize;
  user-select: none;
}

.right-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  gap: 10px;
  padding: 15px;
  overflow: hidden;
}

.right-panel canvas {
  flex: 0 0 auto;
  border: 1px solid #ddd;
  background: #fff;
}
canvas {
    max-width: 100%;
    max-height: 100%;
    border: 1px solid #ddd;
    background: #fff;
}

fieldset {
    margin-bottom: 8px;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 6px 10px;
}

legend {
    font-weight: bold;
    padding: 0 5px;
    font-size: 14px;
}

label {
    display: inline-block;
    margin: 3px 8px 3px 0;
    font-size: 13px;
}

input[type="number"] {
    width: 70px;
    font-size: 13px;
    padding: 2px;
}

button {
    margin: 4px 8px 4px 0;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 13px;
}

#results p {
    font-weight: bold;
    margin: 5px 0;
    font-size: 14px;
}

.error { color: red; }
.warning { color: orange; }
#messages { margin-top: 5px; font-size: 13px; }

.verticalSubContainer fieldset {
    margin-left: 10px;
    border-color: #aaa;
}

/* Sticky buttons */
.sticky-buttons {
    position: sticky;
    top: 0;
    background: #f8f9fa;
    z-index: 10;
    padding: 6px 0;
    margin-top: 8px;
}

/* Separator lines between fittings */
.shelfContainer > div,
.drawerContainer > div,
.binContainer > div {
    border-bottom: 1px dashed #ccc;
    padding-bottom: 6px;
    margin-bottom: 6px;
}

/* Schematic overlay (dirty indicator) */
.schematic-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
    pointer-events: none;
    z-index: 20;
}
.schematic-overlay.hidden {
    display: none;
}

/* Tooltip */
.schematic-tooltip {
    position: absolute;
    background: rgba(0,0,0,0.85);
    color: #fff;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    z-index: 30;
    white-space: pre-line;
    max-width: 220px;
}
.schematic-tooltip.hidden {
    display: none;
}

/* ---- Settings Modal ---- */
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: rgba(0,0,0,0.5);
}
.modal.hidden {
  display: none;
}
.modal-content {
  background: #fff;
  margin: 5% auto;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}
.close-btn {
  position: absolute;
  right: 15px;
  top: 10px;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
  color: #aaa;
}
.close-btn:hover { color: #000; }
.modal h2 { margin-top: 0; }
.modal fieldset { margin-bottom: 12px; }
.modal label { display: block; margin: 6px 0; }
.settings-actions { margin-top: 15px; display: flex; flex-wrap: wrap; gap: 8px; }
.settings-actions button { flex: 1; min-width: 80px; }
.remove-fitting-btn {
    background: #e74c3c;
    color: white;
    border: none;
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 3px;
    margin-left: 6px;
}
.remove-fitting-btn:hover {
    background: #c0392b;
}
```


---

*Converted from `style.css` on 2026-05-23 11:54:21*
