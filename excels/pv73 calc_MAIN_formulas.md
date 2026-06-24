# Sheet: MAIN - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U | Column_V | Column_W | Column_X | Column_Y | Column_Z | Column_AA | Column_AB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-pv73k   > | Ver. 2014/01/07 |  |  |  |  | Refrigerant |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  | OK! |  | R-600a=1,R-134a=2 | 1 | `=IF(H3=1,"R-600a",IF(H3=2,"R-134a","??"))` |  |  |  | Refrigerant | R-600a |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ◇  ＴＥＭＰＡＲＡＴＵＲＥ  ◇ | (℃) |  | ◇HEAT LOAD ◇ |  |  | ◇  Compressor Data  ◇ |  |  |  |  |  | COMP NAME | EGX80CLC 100V 50Hz |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F ROOM   TF      (℃) | -18 |  | QF     TOTAL(kcal/h)  (inlet) | `=SIZE!E32` |  | COMPRESSOR NAME | `=N4` | R-600a |  |  |  | Capacity | `=[1]DATA!$K$5` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| R ROOM   TR      (℃) | 3 |  | QR     TOTAL(kcal/h)  (inlet) | `=SIZE!E33+E8` |  | 220/240V 50Hz |  |  |  |  |  | COP | `=[1]DATA!$I$7` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DP CON.  TC      (℃) | `=B8+E39` | Trial | QEV    TOTAL (kcal/h)  (inlet) | `=SIZE!E34` |  | 定格ｺｰﾅｰ |  |  |  |  |  | Rpm0= | `=[1]DATA!$D$5` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE  T0      (℃) | 25 |  | heater          (kcal/h) | 0 |  | N(rpm) | `=N7` |  | Volume Efficiency |  |  | Vc= | `=[1]DATA!$D$4` | Rotational Speed ​​Correction |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | heater          (W) | `=E8/0.86` |  | Vc(cc) | `=N8` |  | ηv=(A+B*PC/PE+C*PC)*Kηv |  |  | A= | `=[1]DATA!O4` | a= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| ◇  Ｏ Ｔ Ｈ Ｅ Ｒ Ｓ  ◇ |  |  | Qtotal  (=QF+QR+QEV) | `=SUM(E5:E7)` |  | ηv | `=(N9+N10*H14/H15+N11*H14)*K10` |  | Kηv= | `=P9+P10*H8+P11*H8^2` |  | B= | `=[1]DATA!O5` | b= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN TOTAL                (m3/h) | 146.4 |  |  |  |  | T IN | 32.2 |  |  |  |  | C= | `=[1]DATA!O6` | c= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN Diameter   φmm | 100 |  | ◇  CALCULATION ◇ |  |  | TC  Cond | 54.4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN SPEED               (rpm) | 2850 |  | Fan out air temp         T3      (℃) | `=E37+E7/B11/B21/B20/E38` |  | TE  Evap | -23.3 |  | R-600a | R-134a |  | AW= | `=[1]DATA!R4` | Rotational Speed ​​Correction |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN INPUT                (W) | 2.4 |  | R Air Volume             MR     (m3/h) | `=E6/B20/B21/(B6-E13)/E38` | `=E14/B11` | Pc (Tcond) | `=IF(H3=1,J14,IF(H3=2,K14,"??"))` |  | `=EXP(68.322-4401/(H12+273.16)-9.8436*LN(H12+273.16)+0.0127711*(H12+273.16))` | `=EXP(104.918-5301.3/(H12+273.16)-16.2481*LN(H12+273.16)+0.0246593*(H12+273.16))` |  | BW= | `=[1]DATA!R5` | Ka= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| DEF. HEATER INPUT        (W) | 112 |  | F Air Volume             MF     (m3/h) | `=B11-E14` |  | Pe (Teva) | `=IF(H3=1,J15,IF(H3=2,K15,"??"))` |  | `=EXP(68.322-4401/(H13+273.16)-9.8436*LN(H13+273.16)+0.0127711*(H13+273.16))` | `=EXP(104.918-5301.3/(H13+273.16)-16.2481*LN(H13+273.16)+0.0246593*(H13+273.16))` |  | CW= | `=[1]DATA!R6` | Kb= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp ON     (W) | 2 |  | QF'  (FAN)                    (kcal/h) | `=(B11-E14)*B21*B20*(B5-E13)*E38` |  | Hout (kcal/kg) | `=IF(H3=1,J16,IF(H3=2,K16,"??"))` |  | `=104.5+0.049951*(H11+273.16)+0.00058822*(H11+273.16)^2-249.18*J15/(H11+273.16)` | `= 119.36 + 0.023174 *(H11+273.16) + 0.00031297 * (H11+273.16) ^ 2 - 138.07 *K15/ (H11+273.16)` |  | DW= | `=[1]DATA!R7` | Kc= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp OFF    (W) | 1 |  | QR'  (FAN)                    (kcal/h) | `=E14*B20*B21*(B6-E13)*E38` |  | Hin  (kcal/kg) | `=IF(H3=1,J17,IF(H3=2,K17,"??"))` |  | `=75.545+0.55731*H11+0.0007088*H11^2+0.0000029408*H11^3` | `= 100.019 + 0.31763 * H11+ 0.00033057 * H11^ 2 + 0.0000035281 *H11^ 3` |  | EW= | `=[1]DATA!R8` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| TIMER   Period          (hr) | 10.5 |  | QEV'    =M*γ*CP*(TEVIN-TEVOUT)*PR | `=B11*B21*B20*(E13-E20)*E38` |  | V(specific volume） | `=IF(H3=1,J18,IF(H3=2,K18,"??"))` |  | `= 0.015883+0.001455*(H11+273.16)/J15-7.2936/(H11+273.16)-0.0004645*J15` | `=0.01248+0.0008207*(H11+273.16)/K15-4.663/(H11+273.16)-0.0002297*K15` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Def. HEATER   ON  time  (min) | 60 |  | Air Speed in Evaporator       (m/sec) | `=B11/(B24*B25)/3600*10^6` |  | G(mass flow rate) | `=H10*H8*60*H9*10^(-6)/H18` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DENSITY(Air)      γ     (kg/m3) | 1.365 |  | EV INLET  Air   Temp.     T1     (℃) | `=(E14*B6+E15*B5)/B11` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cp(Air 0℃)              (kcal/kg℃) | 0.24 |  | LOG. MEAN TEMP. DIFF. OF EVA.  (℃) | `=E10/E23/B33/E38` |  | Rated capacity | `=H19*(H16-H17)` | kcal/h |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | SUB CAL. X | `=EXP((E20-E37)/E21)` |  |  | `=H21/0.86` | W | 入力回転数補正 |  |  |  | TC= | `=B7` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ◇  EVAPORATOR  (NALCO)  ◇ |  |  | EVA  Heat transfer α ( kcal/hm2℃) | `=12.93*E19^0.415` |  | Rated input(Ｗ） | `=K23*(N13+N14*H13+N15*H12+N16*H12*H13+N17*H13^2)*H8/N7` | W | Kw= | `=P14+P15*H8+P16*H8^2` |  |  | Te= | `=E24` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV WIDTH  (=30mm*N)      (mm) | 440.5 |  | EV TEMPRATURE                  (℃) | `=(E20-E22*E37)/(1-E22)` |  | COP | `=H21/H23/0.86` | W=(AW+BW*TE+CW*TC*TE+DW*TE^2)*Kw*Rpm/Rpm0 |  |  |  |  | T0= | `=B8` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV DEPTH                 (mm) | 58 |  | QEV''(Ability of Evaporator)  (kcal/h) | `=E23*B33*E21` |  |  |  |  |  |  |  |  | Tsub= | `=K28` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV Tire (pitch) | 5 |  | COMP INPUT | `=K32` |  | ◇  Cooling capacity of Refrigerator Condition  ◇ |  |  |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Diameter  φ mm | 8 |  | ON Time INPUT | `=E26+B14+B16` |  | Pc (Tcond) | `=IF(H3=1,N27,IF(H3=2,O27,"??"))` |  | Capi Sub-cool | 10 |  | Pc= | `=EXP(68.322-4401/(O22+273.16)-9.8436*LN(O22+273.16)+0.0127711*(O22+273.16))` | `=EXP(104.918-5301.3/(O22+273.16)-16.2481*LN(O22+273.16)+0.0246593*(O22+273.16))` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface  27*77mm/pc | `=(27*77-3.146*(B27/2)^2*2)*2/10^6` |  | Energy consumption kWh/24h | `=(E27*E38+(1-E38)*B17)*24/1000+B15*E31*B19/60/1000` |  | Pe (Teva) | `=IF(H3=1,N28,IF(H3=2,O28,"??"))` |  | TC-Sub cool | `=B7-K27` |  | Pe= | `=EXP(68.322-4401/(O23+273.16)-9.8436*LN(O23+273.16)+0.0127711*(O23+273.16))` | `=EXP(104.918-5301.3/(O23+273.16)-16.2481*LN(O23+273.16)+0.0246593*(O23+273.16))` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Toatal fin quqntity | `=B45` |  | KWH/MONTH | `=E28*30` |  | V(m3/kg） | `=IF(H3=1,N29,IF(H3=2,O29,"??"))` |  | Hevin | `=IF(H3=1,N30,IF(H3=2,O30,"??"))` |  | v= | `=0.015883+0.001455*(O24+273.16)/N28-7.2936/(O24+273.16)-0.0004645*N28` | `=0.01248+0.0008207*(O24+273.16 )/O28-4.663/(O24+273.16)-0.0002297*O28` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface    m2 | `=B29*B28` |  | Qcomp(Ability of Compressor)   (kcal/h) | `=K31` |  | Volume Efficiency | `=(N9+N10*H27/H28+N11*H27)*K10` |  | Hevout | `=IF(H3=1,N31,IF(H3=2,O31,"??"))` |  | Hevin= | `=75.545+0.55731*O25+0.0007088*O25^2+0.0000029408*O25^3` | `=100.019+0.31763*O25+0.00033057*O25^2+0.0000035281*O25^ 3` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Surface  φ8mm | `=(3.146*B27*B24)*B26*2/10^6` |  | How many defrost in a day   （Times/24h) | `=24/E32` |  | G(kg/h) | `=H30*H8*60*H9*10^(-6)/H29` |  | QCOMP | `=H31*(K30-K29)` |  | Hevout= | `=104.5+0.049951*(O23+273.16)+0.00058822*(O23+273.16)^2-249.18*N28/(O23+273.16)` | `= 119.36 + 0.023174 *(O23+273.16) + 0.00031297 * (O23+273.16) ^ 2 - 138.07 *O28/ (O23+273.16)` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Side Plate surface | `=0.07*0.235` |  | Defrosting cycle   Hr | `=B18/E38` |  |  |  |  | COMP INPUT | `=K23*(N13+N14*E24+N15*B7+N16*B7*E24+N17*E24*E24)*H8/N7` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| SURFACE OF EVAPORATOR    (m2) | `=B30+B31+B32` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | ◇  Condenser Heat Exchange   ◇ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ◇ quantity of Evaporator fin  ◇ |  |  | ◇  ＶＡＲＩＡＢＬＥ  ◇ |  |  | Ｒ Front | `=(0.3405*(B7-B8)+0.03322*(B7-B6))*(SIZE!B7*2+SIZE!B9)/1000` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Evaporator Fin quantity | 枚数 |  | Calculate Cond Temp?  Yes=1, No=0 | 1 |  | ＦＲ Partition | `=(0.1984*(B7-B8)+0.1219*(B7-B5))*(SIZE!B9-SIZE!B25-SIZE!B24)/1000` |  | 熱通過率 | 面積 |  | サイドコン・バックコンの熱通過率 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 part | 67 |  | X1 =EV OUT  Temp.          T2     (℃) | -19.399384802155904 | Trial | Ｆ Front | `=(0.3395*(B7-B8)+0.0344*(B7-B5))*(SIZE!B8*2)/1000` |  | K | S |  |  | K | Pipe Pitch |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 part | 73 |  | X2 =RUNNING RATIO          PR     (％) | 0.5215429693380689 | Trial | Sid  Condenser | `=J38*K38*E39` | Side Cond | `=N38` | `=(SIZE!B6*(SIZE!B10-30)-(SIZE!B13+SIZE!B12)*SIZE!B11/2)*2/10^6` |  | Side Cond | `=(10.57-0.042*O38+0.00005*O38^2)` | 150 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 part | 73 |  | X3 = ⊿T ( TC-T0) | 7.936831843231409 |  | Back Condenser | `=J39*K39*E39` | Back Cond | `=N39` | `=SIZE!B9*(SIZE!B6-SIZE!B11)/10^6*K40` |  | Back Cond | `=(10.57-0.042*O39+0.00005*O39^2)` | 200 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 part | 47 |  |  |  |  | TOTAL  QC0ut | `=SUM(H35:H39)` | バックコン放熱効率 |  | 0.7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 part | 36 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 part | 0 |  | ◇  ＣＯＮＤＩＴＩＯＮ  ◇ |  |  | ◇ Radiate Heat ◇ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7 part |  |  | F1= QF-QF' | `=E5-E16` | T2 | Q COND  Qcin | `=H31*(H45-H46)` | kcal/kg | Discharge |  |  |  | TC= | `=B7` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 8 part |  |  | F2= Qtotal-Qcomp*PR | `=E10-E30*E38` | Pr | enthalpy |  |  | Temp | 60 |  |  | Td= | `=K44` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Total | `=SUM(B37:B44)` |  | F3= QCout-QCin | `=H40-H43` | Tc | COND. IN | `=IF(H3=1,N46,IF(H3=2,O46,"??"))` | kcal/kg |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | COND. OUT | `=IF(H3=1,N47,IF(H3=2,O47,"??"))` | kcal/kg |  |  |  | Hcod nin | `=104.5+0.049951*(O44+273.16)+0.00058822*(O44+273.16)^2-249.18*N27/(O44+273.16)` | `=119.36+0.023174*(O44+273.16)+0.00031297*(O44+273.16)^2-138.07*O27/(O44+273.16)` |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  | Hcond out | `=75.545+0.55731*O43+0.0007088*O43^2+0.0000029408*O43^3` | `= 100.019 + 0.31763 *O43+ 0.00033057 * O43^ 2 + 0.0000035281 *O43^ 3` |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Outer Cab. Temp Rise |  | Cab. Temp. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | F,R Cab | `=IF(K38=0,0,J38/10*E39)` | `=B8+H50*E38` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Back Cab | `=IF(K39=0,0,J39/10*E39)` | `=B8+H51*E38` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

## Summary

**Rows with data:** 49
**Columns:** 28
**Cells containing formulas:** 125

## Formula Legend

- **`=FORMULA()`** : Excel formula (shown in code blocks)
- **Plain text/number** : Static value (no formula)
- **Empty cell** : No data

## Tips

- To copy a formula back to Excel, remove the backticks (`) and paste into a cell starting with `=`
- Formulas are shown exactly as they appear in the Excel formula bar