# 54H calc - XLSM to Markdown Conversion

**Original file:** `54H calc.xlsm`  
**Converted:** 2026-06-22 22:29:36

## Structure

This conversion creates **TWO versions** of each sheet:

- **VALUES** (`*_values.md`): Shows calculated/displayed values as seen in Excel
- **FORMULAS** (`*_formulas.md`): Shows original Excel formulas

## Sheets Converted

| Sheet Name | Values File | Formulas File |
|------------|-------------|---------------|
| MAIN | [VALUES](values/MAIN_values.md) | [FORMULAS](formulas/MAIN_formulas.md) |
| SIZE | [VALUES](values/SIZE_values.md) | [FORMULAS](formulas/SIZE_formulas.md) |
| 熱負荷分布 | [VALUES](values/熱負荷分布_values.md) | [FORMULAS](formulas/熱負荷分布_formulas.md) |

## VBA Macros
- [Macro Documentation](MACROS.md)

## Directory Structure

```
54c/
├── README.md (this file)
├── MACROS.md (VBA documentation)
├── values/
│   ├── MAIN_values.md\n│   ├── SIZE_values.md
│   └── ...
└── formulas/
    ├── MAIN_formulas.md\n    ├── SIZE_formulas.md
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
