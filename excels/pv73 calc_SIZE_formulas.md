# Sheet: SIZE - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| =MAIN!A1 | Column_B | Column_C | Column_D | PR= | =MAIN!E38 | TF= | =MAIN!B5 | T2= | =MAIN!E37 | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `=MAIN!A2` |  | CP | 70mm |  |  | TR= | `=MAIN!B6` | Cab Side | `=MAIN!I50` |  |  |  |  |  |  |  |
|  |  |  |  | Comp temp | `=50*F1+H4` | TC= | `=MAIN!B7` | Back cab | `=MAIN!I51` |  |  |  |  |  |  |  |
| ◇  Ｓ  Ｉ  Ｚ  Ｅ  ◇ | (mm) |  |  |  |  | T0= | `=MAIN!B8` | Cab Bottom | `=(F3-H4)*F1+H4` |  |  |  |  |  |  |  |
| ◇  BASIC  SIZE  ◇ |  |  | ◇  Heat Load  ◇ |  |  |  | B=K*S |  |  |  |  |  |  |  |  |  |
| TOTAL HIGHT         H | 1794 |  | POSITION | Q(kcal/h) | S(m2) or L(m) | K | B | INSIDE TEMP | OUTSIDE TEMP |  |  |  |  |  |  |  |
| R HIGHT             HR | 1048 |  | R TOP | `=H7*(J7-I7)` | `=(B$9-(B$18+B$19)/2)*(B10-B20/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B17/1000/(B$34+0.00011*(I7+J7)/2))` | `=G7*F7` | `=H2` | `=H4` |  |  |  |  |  |  |  |
| F HIGHT             HF | 746 |  | R LERT | `=H8*(J8-I8)` | `=(B10-B20/2)*(B7-(B17+B21)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B18/1000/(B$34+0.00011*(I8+J8)/2))` | `=G8*F8` | `=H2` | `=J2` |  |  |  |  |  |  |  |
| WIDTH               W | 795 |  | R RIGHT | `=H9*(J9-I9)` | `=F8` | `=1/(1/B$40+1/B$41+B19/1000/(B$34+0.00011*(I9+J9)/2))` | `=G9*F9` | `=H2` | `=J2` |  |  |  |  |  |  |  |
| DEPTH               D | 687 |  | R BOTTOM | `=H10*(J10-I10)` | `=(B10-B20/2)*(B9-(B18+B19)/2)*10^(-6)` | `=1/(1/B$41+1/B$41+B21/1000/(B$34+0.00011*(I10+J10)/2))` | `=G10*F10` | `=H2` | `=H1` |  |  |  |  |  |  |  |
| BOTOM HIGHT        Hb | 248 |  | R BACK | `=H11*(J11-I11)` | `=(B7-(B17+B21)/2)*(B9-(B18+B19)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B20/1000/(B$34+0.00011*(I11+J11)/2))` | `=G11*F11` | `=H2` | `=J3` |  |  |  |  |  |  |  |
| BOTTOM DEPTH       Db1 | 195 |  | R DOOR | `=H12*(J12-I12)` | `=(B7-B14/2-B36*2)*(B9-B36*2)*10^(-6)` | `=1/(1/B$40+1/B$41+B22/1000/(B$34+0.00011*(I12+J12)/2))` | `=G12*F12` | `=H2` | `=H4` |  |  |  |  |  |  |  |
| BOTTOM DEPTH       Db2 | 261 |  | R PACKIN | `=H13*(J13-I13)` | `=((B7-B36*2)+(B9-B36*2))*2*10^(-3)` | `=B37` | `=G13*F13` | `=H2` | `=H4` |  |  |  |  |  |  |  |
| Door gap of F&R door | 10 |  | R DPCON1(RR-Partition) | `=(0.1219*(H3-H1)*F1+0.1219*((0.1984*H4+0.1219*H1)/(0.1984+0.1219)-H1)*(1-F1))*F14` | `=(B9-B18-B19)*10^(-3)` | * | * | * | * |  |  |  |  |  |  |  |
|  |  |  | R DPCON2(R-Rront) | `=(0.0791*(MAIN!B7-MAIN!B5)-0.072*(MAIN!B8-MAIN!B5))*F15*MAIN!E38` | `=(B7*2+B9)*10^(-3)` | * | * | * | * |  |  |  |  |  |  |  |
| ◇ THICKNESS OF WALL ◇ |  |  | F TOP | `=H16*(J16-I16)` | `=(B$9-(B$24+B$25)/2)*(B10-B$26/2)*10^(-6)` | `=1/(1/B$41+1/B$41+B23/1000/(B$34+0.00011*(I16+J16)/2))` | `=G16*F16` | `=H1` | `=H2` |  |  |  |  |  |  |  |
| R TOP | 55 |  | F LEFT | `=H17*(J17-I17)` | `=((B8-(B21+B27)/2)*(B10-B26/2)-((B13+B12)*B11/2))*10^(-6)` | `=1/(1/B$40+1/B$41+B24/1000/(B$34+0.00011*(I17+J17)/2))` | `=G17*F17` | `=H1` | `=J2` |  |  |  |  |  |  |  |
| R LEFT | 57 |  | F FIGHT | `=H18*(J18-I18)` | `=F17` | `=1/(1/B$40+1/B$41+B25/1000/(B$34+0.00011*(I18+J18)/2))` | `=G18*F18` | `=H1` | `=J2` |  |  |  |  |  |  |  |
| R RIGHT | 57 |  | F BOTTOM　1 | `=H19*(J19-I19)` | `=(B9-(B24+B25)/2)*B12*10^(-6)` | `=1/(1/B$40+1/B$41+B27/1000/(B$34+0.00011*(I19+J19)/2))` | `=G19*F19` | `=H1` | `=J4` |  |  |  |  |  |  |  |
| R BACK | 80 |  | F BOTTOM　2 | `=H20*(J20-I20)` | `=(B9-(B24+B25)/2)*(SQRT(B11^2+(B13-B12)^2))*10^(-6)` | `=1/(1/B$40+1/B$41+B28/1000/(B$34+0.00011*(I20+J20)/2))` | `=G20*F20` | `=H1` | `=J4` |  |  |  |  |  |  |  |
| R BOTTOM ※ | 32 |  | F BOTTOM　3 | `=H21*(J21-I21)` | `=(B9-(B24+B25)/2)*(B10-B13)*10^(-6)` | `=1/(1/B$40+1/B$41+B29/1000/(B$34+0.00011*(I21+J21)/2))` | `=G21*F21` | `=H1` | `=H4` |  |  |  |  |  |  |  |
| R DOOR | 58 |  | F DOOF | `=H22*(J22-I22)` | `=(B9-B36*2)*(B8-B14/2-B36*2)*10^(-6)` | `=1/(1/B$40+1/B$41+B30/1000/(B$34+0.00011*(I22+J22)/2))` | `=G22*F22` | `=H1` | `=H4` |  |  |  |  |  |  |  |
| F TOP ※ | 32 |  | F PACKIN | `=H23*(J23-I23)` | `=((B8-B36*2)+(B9-B36*2))*2*10^(-3)` | `=B37` | `=G23*F23` | `=H1` | `=H4` |  |  |  |  |  |  | 1 |
| F LEFT | 82 |  | F DPCON(F-FFont) | `=(0.0546*(MAIN!B7-MAIN!B5)-0.0491*(MAIN!B8-MAIN!B5))*F24*MAIN!E38` | `=(B8*2+B9)*10^(-3)` | * | * | * | * |  |  |  |  |  |  | 2 |
| F RIGHT | 82 |  | PWB Heat LOAD | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| EVA BACK | 55 |  | EVA BACK | `=H26*(J26-I26)` | `=(B9-(B24+B25)/2)*(B8-B11-(B23+B27)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B26/1000/(B$34+0.00011*(I26+J26)/2))` | `=G26*F26` | `=J1` | `=J3` |  |  |  |  |  | 3 |  |
| F BOTTOM 1 | 76 |  | FAN LOAD (FAN INPUT*0.86*Pr） | `=MAIN!B14*0.86*MAIN!E38` |  |  |  |  |  |  |  |  |  |  |  |  |
| F BOTTOM 2 | 80 |  | DEF. HEATER LOAD | `=MAIN!B15*0.86*MAIN!B19/60/24` |  |  |  |  |  |  |  |  |  |  |  |  |
| F BOTTOM 3 | 82 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F DOOR | 80 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ◇  Thermal Conductivity  ◇ | (kcal/mh℃) |  | QF     TOTAL(kcal/h)  (inlet) | `=SUM(E16:E25)` |  |  |  |  |  |  |  |  |  |  |  |  |
| URETANE | 0.0165 |  | QR     TOTAL(kcal/h)  (inlet) | `=SUM(E7:E15)` |  |  |  |  |  |  |  |  |  |  |  |  |
| A=X-0.00011*T          X= | `=B33-0.00011*25` |  | QEVOUT TOTAL(kcal/h)  (inlet) | `=SUM(E26:E28)` |  |  |  |  |  |  |  |  |  |  |  |  |
| PS FORM     λ | 0.035 |  | QEV  (=QF+QR+QEVOUT) | `=SUM(E32:E34)` |  |  |  |  |  |  |  |  |  |  |  |  |
| Packing position  L mm | 15 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PAKKIN | 0.035 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ◇  Heat trancefer coefficent ◇ | (kcal/m2h℃) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE | 6 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| INSIDE | 10 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | VOLUME: |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Refrigeratorr Gross volume | `=(B9-B18-B19)*(B7-B17-B21/2)*(B10-B20)/1000000` | 59 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Freezer   Gross Volume | `=((B9-B24-B25)*(B8-B21/2-B27)*(B10-B26)-(B12+B13)*B11/2*(B9-B24-B25))/1000000` | 125 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | TOTAL | `=E44+E45` | `=F44+F45` |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | ISO VOLUME |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Freezer VOLUME | `=E44-(60+25)*(B9-B18-B19)*(B7-B17-B20/2)/1000000` | 48 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Refrigerator | `=E45-(B9-B18-B19)*60*300/1000000` | 120 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | TOTAL | `=E50+E51` | `=F50+F51` |  |  |  |  |  |  |  |  |  |  |  |
| DOOR |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Packing |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

## Summary

**Rows with data:** 48
**Columns:** 17
**Cells containing formulas:** 125

## Formula Legend

- **`=FORMULA()`** : Excel formula (shown in code blocks)
- **Plain text/number** : Static value (no formula)
- **Empty cell** : No data

## Tips

- To copy a formula back to Excel, remove the backticks (`) and paste into a cell starting with `=`
- Formulas are shown exactly as they appear in the Excel formula bar