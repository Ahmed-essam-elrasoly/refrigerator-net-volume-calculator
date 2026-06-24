# Compressor pv73 - XLSM to Markdown Conversion

**Original file:** `Compressor pv73.xlsm`  
**Converted:** 2026-06-22 22:29:13

## Structure

This conversion creates **TWO versions** of each sheet:

- **VALUES** (`*_values.md`): Shows calculated/displayed values as seen in Excel
- **FORMULAS** (`*_formulas.md`): Shows original Excel formulas

## Sheets Converted

| Sheet Name | Values File | Formulas File |
|------------|-------------|---------------|
| DATA | [VALUES](values/DATA_values.md) | [FORMULAS](formulas/DATA_formulas.md) |
| Volumetric efficiency | [VALUES](values/Volumetric_efficiency_values.md) | [FORMULAS](formulas/Volumetric_efficiency_formulas.md) |
| Cooling capacity | [VALUES](values/Cooling_capacity_values.md) | [FORMULAS](formulas/Cooling_capacity_formulas.md) |
| Input | [VALUES](values/Input_values.md) | [FORMULAS](formulas/Input_formulas.md) |
| 入力Ｗ | [VALUES](values/入力Ｗ_values.md) | [FORMULAS](formulas/入力Ｗ_formulas.md) |
| 冷凍能力 | [VALUES](values/冷凍能力_values.md) | [FORMULAS](formulas/冷凍能力_formulas.md) |
| COP | [VALUES](values/COP_values.md) | [FORMULAS](formulas/COP_formulas.md) |
| 冷蔵庫条件冷凍能力 | [VALUES](values/冷蔵庫条件冷凍能力_values.md) | [FORMULAS](formulas/冷蔵庫条件冷凍能力_formulas.md) |
| 冷蔵庫条件COP | [VALUES](values/冷蔵庫条件COP_values.md) | [FORMULAS](formulas/冷蔵庫条件COP_formulas.md) |
| 冷蔵庫条件ＣＯＰ　比較 | [VALUES](values/冷蔵庫条件ＣＯＰ比較_values.md) | [FORMULAS](formulas/冷蔵庫条件ＣＯＰ比較_formulas.md) |
| Sheet1 | [VALUES](values/Sheet1_values.md) | [FORMULAS](formulas/Sheet1_formulas.md) |

## VBA Macros
- [Macro Documentation](MACROS.md)

## Directory Structure

```
73/
├── README.md (this file)
├── MACROS.md (VBA documentation)
├── values/
│   ├── DATA_values.md\n│   ├── Sheet1_values.md
│   └── ...
└── formulas/
    ├── DATA_formulas.md\n    ├── Sheet1_formulas.md
    └── ...
```

## Usage Tips

### Working with VALUES files
- These show the actual calculated results
- Numbers, dates, and text as they appear in Excel
- Great for documentation and reporting

### Working with FORMULAS files
- Formulas are shown in `code blocks` for visibility
- To reuse a formula in Excel: copy without backticks
- Static values (non-formulas) are shown as plain text

### Reconstructing in Excel
1. Create a new Excel file
2. Copy data from VALUES file for static data
3. Copy formulas from FORMULAS file (remove backticks)
4. Paste into cells starting with `=`
