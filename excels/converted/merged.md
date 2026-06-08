
---
## 54H calc_MACROS.md

# VBA Macros




Sub Macro2()

Dim AA(10, 10), X(10), FX0(10), FX1(10), FDX(10)

' Æ’nÆ’â€œÆ’`Æ’â€œÆ’O Macro
' Æ’}Æ’NÆ’Ââ€¹LËœ^â€œÃº : 2002/4/13  Æ’â€ Â[Æ’UÂ[â€“Â¼ : takatori
'
    Cells(3, 5) = ""
    DD1 = 0.0005
    DX = 0.001
    DY = 0.00001
    DZ = 0.001
    DH = 0.001
    NN = 0
    NNC = 0
    NM = 0
    KF = 2
    KTC = Cells(36, 5)

A0:
    For I = 1 To KF
    X(I) = Cells(36 + I, 5)
    Next I
   
A1:
    For I = 1 To KF
    FX0(I) = Cells(42 + I, 5)
    Next I
    
    For I = 1 To KF
    If Abs(FX0(I)) > DD1 Then GoTo A2
    Next I
    
    NN = 0
    If KTC = 1 Then GoTo BB
    GoTo ZZ

A2:
    NN = NN + 1
    If NN > 100 Then GoTo CC
    
    For I = 1 To KF
    Cells(36 + I, 5) = X(I) + DX
    
    For J = 1 To KF
    FX1(J) = Cells(42 + J, 5)
    AA(J, I) = (FX1(J) - FX0(J)) / DX

    Next J
    
    Cells(36 + I, 5) = X(I)
    Next I
    
    For I = 1 To KF
    AA(I, KF + 1) = -1 * FX0(I)
    Next I
    
    N = KF
    
    For K = 1 To N
    AK = AA(K, K)
    For J = 1 To N + 1
    AA(K, J) = AA(K, J) / AK
    Next J
    For I = 1 To N
    AIK = AA(I, K)
    For J = 1 To N + 1
    If I = K Then GoTo DD
    AA(I, J) = AA(I, J) - AIK * AA(K, J)
    Next J
DD:
    Next I
    Next K
        
    For I = 1 To KF
    X(I) = X(I) + AA(I, KF + 1)
    Cells(36 + I, 5) = X(I)
    Next I
    
    GoTo A1
BB:
    If KTC = 0 Then GoTo ZZ
    If NNC = 1 Then GoTo EE
    NM = NM + 1
    If NM > 100 Then GoTo CC
    X3 = Cells(39, 5)
    FH0 = Cells(45, 5)
    If Abs(FH0) < DD1 Then GoTo ZZ
    Cells(39, 5) = X3 + DH
    NNC = 1
    GoTo A0
EE:

    FH1 = Cells(45, 5)
    FDH = (FH1 - FH0) / DH
    X3 = X3 - FH0 / FDH
    Cells(39, 5) = X3
    NNC = 0
    GoTo A0
    
    
CC:
    Cells(3, 5) = "NG!"
    GoTo XX
    
ZZ:
    Cells(3, 5) = "OK!"
XX:

'
End Sub


---
## 54H calc_MAIN_formulas.md

# Sheet: MAIN - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U | Column_V | Column_W | Column_X | Column_Y | Column_Z | Column_AA | Column_AB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-540   > | Ver. 2014/01/07 |  |  |  |  | Refrigerant |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  | OK! |  | R-600a=1,R-134a=2 | 1 | `=IF(H3=1,"R-600a",IF(H3=2,"R-134a","??"))` |  |  |  | å†·åª’ | R-600a |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼´ï¼¥ï¼­ï¼°ï¼¡ï¼²ï¼¡ï¼´ï¼µï¼²ï¼¥  â—‡ | (â„ƒ) |  | â—‡HEAT LOAD â—‡ |  |  | â—‡  Compressor Data  â—‡ |  |  |  |  |  | COMP NAME | EGX80CLC 100V 50Hz |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F ROOM   TF      (â„ƒ) | -18 |  | QF     TOTAL(kcal/h)  (inlet) | `=SIZE!E32` |  | COMPRESSOR NAME | `=N4` | R-600a |  |  |  | Capacity | 181.6 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| R ROOM   TR      (â„ƒ) | 3 |  | QR     TOTAL(kcal/h)  (inlet) | `=SIZE!E33+E8` |  | 220/240V 50Hz |  |  |  |  |  | COP | 1.77 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DP CON.  TC      (â„ƒ) | `=B8+E39` |  | QEV    TOTAL (kcal/h)  (inlet) | `=SIZE!E34` |  | å®šæ ¼ï½ºï½°ï¾…ï½° |  |  |  |  |  | Rpm0= | 2900 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE  T0      (â„ƒ) | 30 |  | heater          (kcal/h) | 0 |  | N(rpm) | 2900 |  | Volume Efficiency |  |  | Vc= | 11.14 | å›žè»¢é€Ÿåº¦è£œæ­£ |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | heater          (W) | `=E8/0.86` |  | Vc(cc) | `=N8` |  | Î·v=(A+B*PC/PE+C*PC)*KÎ·v |  |  | A= | 0.9260142251566365 | a= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼¯ ï¼´ ï¼¨ ï¼¥ ï¼² ï¼³  â—‡ |  |  | Qtotal  (=QF+QR+QEV) | `=SUM(E5:E7)` |  | Î·v | `=(N9+N10*H14/H15+N11*H14)*K10` |  | KÎ·v= | `=P9+P10*H8+P11*H8^2` |  | B= | -0.01221312333322575 | b= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN TOTAL                (m3/h) | `=70*B13/3000*(B12/100)^2` |  |  |  |  | T IN | 32.2 |  |  |  |  | C= | -0.0023789273042382304 | c= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN Diameter   Ï†mm | 100 |  | â—‡  CALCULATION â—‡ |  |  | TC  Cond | 54.4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN SPEED               (rpm) | 2550 |  | Fan out air temp         T3      (â„ƒ) | `=E37+E7/B11/B21/B20/E38` |  | TE  Evap | -23.3 |  | R-600a | R-134a |  | AW= | 135.175 | å›žè»¢é€Ÿåº¦è£œæ­£ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN INPUT                (W) | 2.1 |  | R Air Volume             MR     (m3/h) | `=E6/B20/B21/(B6-E13)/E38` | `=E14/B11` | Pc (Tcond) | `=IF(H3=1,J14,IF(H3=2,K14,"??"))` |  | `=EXP(68.322-4401/(H12+273.16)-9.8436*LN(H12+273.16)+0.0127711*(H12+273.16))` | `=EXP(104.918-5301.3/(H12+273.16)-16.2481*LN(H12+273.16)+0.0246593*(H12+273.16))` |  | BW= | 2.6366666666666667 | Ka= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| DEF. HEATER INPUT        (W) | 140 |  | F Air Volume             MF     (m3/h) | `=B11-E14` |  | Pe (Teva) | `=IF(H3=1,J15,IF(H3=2,K15,"??"))` |  | `=EXP(68.322-4401/(H13+273.16)-9.8436*LN(H13+273.16)+0.0127711*(H13+273.16))` | `=EXP(104.918-5301.3/(H13+273.16)-16.2481*LN(H13+273.16)+0.0246593*(H13+273.16))` |  | CW= | 0.9750000000000001 | Kb= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp ON     (W) | 2 |  | QF'  (FAN)                    (kcal/h) | `=(B11-E14)*B21*B20*(B5-E13)*E38` |  | Hout (kcal/kg) | `=IF(H3=1,J16,IF(H3=2,K16,"??"))` |  | `=104.5+0.049951*(H11+273.16)+0.00058822*(H11+273.16)^2-249.18*J15/(H11+273.16)` | `= 119.36 + 0.023174 *(H11+273.16) + 0.00031297 * (H11+273.16) ^ 2 - 138.07 *K15/ (H11+273.16)` |  | DW= | 0.02 | Kc= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp OFF    (W) | 1 |  | QR'  (FAN)                    (kcal/h) | `=E14*B20*B21*(B6-E13)*E38` |  | Hin  (kcal/kg) | `=IF(H3=1,J17,IF(H3=2,K17,"??"))` |  | `=75.545+0.55731*H11+0.0007088*H11^2+0.0000029408*H11^3` | `= 100.019 + 0.31763 * H11+ 0.00033057 * H11^ 2 + 0.0000035281 *H11^ 3` |  | EW= | 0.016666666666666666 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| TIMER   Period          (hr) | 10.5 |  | QEV'    =M*Î³*CP*(TEVIN-TEVOUT)*PR | `=B11*B21*B20*(E13-E37)*E38` |  | V(æ¯”ä½“ç©ï¼‰ | `=IF(H3=1,J18,IF(H3=2,K18,"??"))` |  | `= 0.015883+0.001455*(H11+273.16)/J15-7.2936/(H11+273.16)-0.0004645*J15` | `=0.01248+0.0008207*(H11+273.16)/K15-4.663/(H11+273.16)-0.0002297*K15` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Def. HEATER   ON  time  (min) | 0 |  | Air Speed in Evaporator       (m/sec) | `=B11/(B24*B25)/3600*10^6` |  | G(å¾ªç’°æµé‡) | `=H10*H8*60*H9*10^(-6)/H18` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DENSITY(Air)      Î³     (kg/m3) | 1.365 |  | EV INLET  Air   Temp.     T1     (â„ƒ) | `=(E14*B6+E15*B5)/B11` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cp(Air 0â„ƒ)              (kcal/kgâ„ƒ) | 0.24 |  | LOG. MEAN TEMP. DIFF. OF EVA.  (â„ƒ) | `=E10/E23/B33/E38` |  | Rated capacity | `=H19*(H16-H17)` | kcal/h |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | SUB CAL. X | `=EXP((E20-E37)/E21)` |  |  | `=H21/0.86` | W | å…¥åŠ›å›žè»¢æ•°è£œæ­£ |  |  |  | TC= | `=B7` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  EVAPORATOR  (NALCO)  â—‡ |  |  | EVA  Heat transfer Î± ( kcal/hm2â„ƒ) | `=12.93*E19^0.415` |  | Rated input(ï¼·ï¼‰ | `=K23*(N13+N14*H13+N15*H12+N16*H12*H13+N17*H13^2)*H8/N7` | W | Kw= | `=P14+P15*H8+P16*H8^2` |  |  | Te= | `=E24` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV WIDTH  (=30mm*N)      (mm) | 460 |  | EV TEMPRATURE                  (â„ƒ) | `=(E20-E22*E37)/(1-E22)` |  | COP | `=H21/H23/0.86` | W=(AW+BW*TE+CW*TC*TE+DW*TE^2)*Kw*Rpm/Rpm0 |  |  |  |  | T0= | `=B8` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV DEPTH                 (mm) | 60 |  | QEV''(Ability of Evaporator)  (kcal/h) | `=E23*B33*E21` |  |  |  |  |  |  |  |  | Tsub= | `=K28` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV Tire (æ®µæ•°) | 7 |  | COMP INPUT | `=K32` |  | â—‡  Cooling capacity of Refrigerator Condition  â—‡ |  |  |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Diameter  Ï† mm | 8 |  | ON Time INPUT | `=E26+B14+B16` |  | Pc (Tcond) | `=IF(H3=1,N27,IF(H3=2,O27,"??"))` |  | Capi Sub-cool | 10 |  | Pc= | `=EXP(68.322-4401/(O22+273.16)-9.8436*LN(O22+273.16)+0.0127711*(O22+273.16))` | `=EXP(104.918-5301.3/(O22+273.16)-16.2481*LN(O22+273.16)+0.0246593*(O22+273.16))` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface  30*60mm/pc | `=(28*60-3.146*(B27/2)^2*2)*2/10^6` |  | Energy consumption kWh/24h | `=(E27*E38+(1-E38)*B17)*24/1000+B15*E31*B19/60/1000` |  | Pe (Teva) | `=IF(H3=1,N28,IF(H3=2,O28,"??"))` |  | TC-Sub cool | `=B7-K27` |  | Pe= | `=EXP(68.322-4401/(O23+273.16)-9.8436*LN(O23+273.16)+0.0127711*(O23+273.16))` | `=EXP(104.918-5301.3/(O23+273.16)-16.2481*LN(O23+273.16)+0.0246593*(O23+273.16))` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Toatal fin quqntity | `=B45` |  | KWH/MONTH | `=E28*30` |  | V(m3/kgï¼‰ | `=IF(H3=1,N29,IF(H3=2,O29,"??"))` |  | Hevin | `=IF(H3=1,N30,IF(H3=2,O30,"??"))` |  | v= | `=0.015883+0.001455*(O24+273.16)/N28-7.2936/(O24+273.16)-0.0004645*N28` | `=0.01248+0.0008207*(O24+273.16 )/O28-4.663/(O24+273.16)-0.0002297*O28` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface    m2 | `=B29*B28` |  | Qcomp(Ability of Compressor)   (kcal/h) | `=K31` |  | Volume Efficiency | `=(N9+N10*H27/H28+N11*H27)*K10` |  | Hevout | `=IF(H3=1,N31,IF(H3=2,O31,"??"))` |  | Hevin= | `=75.545+0.55731*O25+0.0007088*O25^2+0.0000029408*O25^3` | `=100.019+0.31763*O25+0.00033057*O25^2+0.0000035281*O25^ 3` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Surface  Ï†8mm | `=(3.146*B27*B24)*B26*2/10^6` |  | How many defrost in a day   ï¼ˆTimes/24h) | `=24/E32` |  | G(kg/h) | `=H30*H8*60*H9*10^(-6)/H29` |  | QCOMP | `=H31*(K30-K29)` |  | Hevout= | `=104.5+0.049951*(O23+273.16)+0.00058822*(O23+273.16)^2-249.18*N28/(O23+273.16)` | `= 119.36 + 0.023174 *(O23+273.16) + 0.00031297 * (O23+273.16) ^ 2 - 138.07 *O28/ (O23+273.16)` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Side Plate surface | 0 |  | Defrosting cycle   Hr | `=B18/E38` |  |  |  |  | COMP INPUT | `=K23*(N13+N14*E24+N15*B7+N16*B7*E24+N17*E24*E24)*H8/N7` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| SURFACE OF EVAPORATOR    (m2) | `=B30+B31+B32` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | â—‡  Condenser Heat Exchange   â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡ quantity of Evaporator fin  â—‡ |  |  | â—‡  ï¼¶ï¼¡ï¼²ï¼©ï¼¡ï¼¢ï¼¬ï¼¥  â—‡ |  |  | ï¼² Front | `=(0.3405*(B7-B8)+0.03322*(B7-B6))*(SIZE!B8*2+MAIN!B9)/1000` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Evaporator Fin quantity | æžšæ•° |  | Calculate Cond Temp?  Yes=1, No=0 | 1 |  | ï¼¦ï¼² Partition | `=(0.1984*(B7-B8)+0.1219*(B7-B5))*(SIZE!B9-SIZE!B23-SIZE!B24)/1000` |  | ç†±é€šéŽçŽ‡ | é¢ç© |  | ã‚µã‚¤ãƒ‰ã‚³ãƒ³ãƒ»ãƒãƒƒã‚¯ã‚³ãƒ³ã®ç†±é€šéŽçŽ‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 æ®µ | 93 |  | X1 =EV OUT  Temp.          T2     (â„ƒ) | -21.34296095493092 |  | ï¼¦ Front | `=(0.3395*(B7-B8)+0.0344*(B7-B6))*(SIZE!B7*2)/1000` |  | K | S |  |  | K | Pipe Pitch |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 æ®µ | 93 |  | X2 =RUNNING RATIO          PR     (ï¼…) | 0.5674402613435491 |  | Sid  Condenser | `=J38*K38*E39` | Side Cond | `=N38` | `=(SIZE!B6*(SIZE!B10-30)-(SIZE!B13+SIZE!B12)*SIZE!B11/2)*2/10^6` |  | Side Cond | `=(10.57-0.042*O38+0.00005*O38^2)` | 150 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 æ®µ | 93 |  | X3 = âŠ¿T ( TC-T0) | 10.865155823364885 |  | Back Condenser | `=J39*K39*E39` | Back Cond | `=N39` | `=SIZE!B9*(SIZE!B6-SIZE!B11)/10^6*K40` |  | Back Cond | `=(10.57-0.042*O39+0.00005*O39^2)` | 200 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 æ®µ | 92 |  |  |  |  | TOTAL  QC0ut | `=SUM(H35:H39)` | ãƒãƒƒã‚¯ã‚³ãƒ³æ”¾ç†±åŠ¹çŽ‡ |  | 0.7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 æ®µ | 62 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 æ®µ | 47 |  | â—‡  ï¼£ï¼¯ï¼®ï¼¤ï¼©ï¼´ï¼©ï¼¯ï¼®  â—‡ |  |  | â—‡ Radiate Heat â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7 æ®µ | 24 |  | F1= QF-QF' | `=E5-E16` |  | Q COND  Qcin | `=H31*(H45-H46)` | kcal/kg | Discharge |  |  |  | TC= | `=B7` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 8 æ®µ |  |  | F2= Qtotal-Qcomp*PR | `=E10-E30*E38` |  | enthalpy |  |  | Temp | 60 |  |  | Td= | `=K44` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Total | `=SUM(B37:B44)` |  | F3= QCout-QCin | `=H40-H43` |  | COND. IN | `=IF(H3=1,N46,IF(H3=2,O46,"??"))` | kcal/kg |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | COND. OUT | `=IF(H3=1,N47,IF(H3=2,O47,"??"))` | kcal/kg |  |  |  | Hcod nin | `=104.5+0.049951*(O44+273.16)+0.00058822*(O44+273.16)^2-249.18*N27/(O44+273.16)` | `=119.36+0.023174*(O44+273.16)+0.00031297*(O44+273.16)^2-138.07*O27/(O44+273.16)` |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  | Hcond out | `=75.545+0.55731*O43+0.0007088*O43^2+0.0000029408*O43^3` | `= 100.019 + 0.31763 *O43+ 0.00033057 * O43^ 2 + 0.0000035281 *O43^ 3` |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Outer Cab. Temp Rise |  | Cab. Temp. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | F,R Cab | `=IF(K38=0,0,J38/10*E39)` | `=B8+H50*E38` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Back Cab | `=IF(K39=0,0,J39/10*E39)` | `=B8+H51*E38` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

## Summary

**Rows with data:** 49
**Columns:** 28
**Cells containing formulas:** 112

## Formula Legend

- **`=FORMULA()`** : Excel formula (shown in code blocks)
- **Plain text/number** : Static value (no formula)
- **Empty cell** : No data

## Tips

- To copy a formula back to Excel, remove the backticks (`) and paste into a cell starting with `=`
- Formulas are shown exactly as they appear in the Excel formula bar

---
## 54H calc_MAIN_values.md

# Sheet: MAIN - VALUES (Calculated/Displayed)

*This shows the calculated values as they appear in Excel*

## Data Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U | Column_V | Column_W | Column_X | Column_Y | Column_Z | Column_AA | Column_AB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-540   > | Ver. 2014/01/07 |  |  |  |  | Refrigerant |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  | OK! |  | R-600a=1,R-134a=2 | 1 | R-600a |  |  |  | å†·åª’ | R-600a |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼´ï¼¥ï¼­ï¼°ï¼¡ï¼²ï¼¡ï¼´ï¼µï¼²ï¼¥  â—‡ | (â„ƒ) |  | â—‡HEAT LOAD â—‡ |  |  | â—‡  Compressor Data  â—‡ |  |  |  |  |  | COMP NAME | EGX80CLC 100V 50Hz |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F ROOM   TF      (â„ƒ) | -18 |  | QF     TOTAL(kcal/h)  (inlet) | 27.22038846917376 |  | COMPRESSOR NAME | EGX80CLC 100V 50Hz | R-600a |  |  |  | Capacity | 181.6 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| R ROOM   TR      (â„ƒ) | 3 |  | QR     TOTAL(kcal/h)  (inlet) | 36.4909934398205 |  | 220/240V 50Hz |  |  |  |  |  | COP | 1.77 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DP CON.  TC      (â„ƒ) | 40.86515582336489 |  | QEV    TOTAL (kcal/h)  (inlet) | 5.386370269218674 |  | å®šæ ¼ï½ºï½°ï¾…ï½° |  |  |  |  |  | Rpm0= | 2900 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE  T0      (â„ƒ) | 30 |  | heater          (kcal/h) | 0 |  | N(rpm) | 2900 |  | Volume Efficiency |  |  | Vc= | 11.14 | å›žè»¢é€Ÿåº¦è£œæ­£ |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | heater          (W) | 0 |  | Vc(cc) | 11.14 |  | Î·v=(A+B*PC/PE+C*PC)*KÎ·v |  |  | A= | 0.9260142251566365 | a= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼¯ ï¼´ ï¼¨ ï¼¥ ï¼² ï¼³  â—‡ |  |  | Qtotal  (=QF+QR+QEV) | 69.09775217821293 |  | Î·v | 0.7578241188782738 |  | KÎ·v= | 1 |  | B= | -0.01221312333322575 | b= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN TOTAL                (m3/h) | 59.5 |  |  |  |  | T IN | 32.2 |  |  |  |  | C= | -0.0023789273042382304 | c= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN Diameter   Ï†mm | 100 |  | â—‡  CALCULATION â—‡ |  |  | TC  Cond | 54.4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN SPEED               (rpm) | 2550 |  | Fan out air temp         T3      (â„ƒ) | -20.855976387470033 |  | TE  Evap | -23.3 |  | R-600a | R-134a |  | AW= | 135.175 | å›žè»¢é€Ÿåº¦è£œæ­£ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN INPUT                (W) | 2.1 |  | R Air Volume             MR     (m3/h) | 8.228571566131924 | 0.138295320439192 | Pc (Tcond) | 7.835776826532984 |  | 7.835776826532984 | 14.992292497076312 |  | BW= | 2.6366666666666667 | Ka= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| DEF. HEATER INPUT        (W) | 140 |  | F Air Volume             MF     (m3/h) | 51.271428433868074 |  | Pe (Teva) | 0.6399178637701737 |  | 0.6399178637701737 | 1.171334242712946 |  | CW= | 0.9750000000000001 | Kb= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp ON     (W) | 2 |  | QF'  (FAN)                    (kcal/h) | 27.220372846240565 |  | Hout (kcal/kg) | 174.0792661518202 |  | 174.0792661518202 | 155.0895912232625 |  | DW= | 0.02 | Kc= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp OFF    (W) | 1 |  | QR'  (FAN)                    (kcal/h) | 36.49099343982049 |  | Hin  (kcal/kg) | 94.32347647011841 |  | 94.32347647011841 | 110.7072242203688 |  | EW= | 0.016666666666666666 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| TIMER   Period          (hr) | 10.5 |  | QEV'    =M*Î³*CP*(TEVIN-TEVOUT)*PR | 5.38637026921868 |  | V(æ¯”ä½“ç©ï¼‰ | 0.6860064886989208 |  | 0.6860064886989208 | 0.21089214370746862 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Def. HEATER   ON  time  (min) | 0 |  | Air Speed in Evaporator       (m/sec) | 0.5988325281803543 |  | G(å¾ªç’°æµé‡) | 2.1412858089066673 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DENSITY(Air)      Î³     (kg/m3) | 1.365 |  | EV INLET  Air   Temp.     T1     (â„ƒ) | -15.095798270776967 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cp(Air 0â„ƒ)              (kcal/kgâ„ƒ) | 0.24 |  | LOG. MEAN TEMP. DIFF. OF EVA.  (â„ƒ) | 6.642367436234789 |  | Rated capacity | 170.77994062357286 | kcal/h |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | SUB CAL. X | 2.5612679411723747 |  |  | 198.58132630648007 | W | å…¥åŠ›å›žè»¢æ•°è£œæ­£ |  |  |  | TC= | 40.86515582336489 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  EVAPORATOR  (NALCO)  â—‡ |  |  | EVA  Heat transfer Î± ( kcal/hm2â„ƒ) | 10.451539320353254 |  | Rated input(ï¼·ï¼‰ | 110.47843333333333 | W | Kw= | 1 |  |  | Te= | -25.344300199406078 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV WIDTH  (=30mm*N)      (mm) | 460 |  | EV TEMPRATURE                  (â„ƒ) | -25.344300199406078 |  | COP | 1.7974668929937163 | W=(AW+BW*TE+CW*TC*TE+DW*TE^2)*Kw*Rpm/Rpm0 |  |  |  |  | T0= | 30 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV DEPTH                 (mm) | 60 |  | QEV''(Ability of Evaporator)  (kcal/h) | 121.77097200436155 |  |  |  |  |  |  |  |  | Tsub= | 30.865155823364887 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV Tire (æ®µæ•°) | 7 |  | COMP INPUT | 98.18563907431633 |  | â—‡  Cooling capacity of Refrigerator Condition  â—‡ |  |  |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Diameter  Ï† mm | 8 |  | ON Time INPUT | 102.28563907431632 |  | Pc (Tcond) | 5.596450223573579 |  | Capi Sub-cool | 10 |  | Pc= | 5.596450223573579 | 10.610649318363205 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface  30*60mm/pc | 0.003158656 |  | Energy consumption kWh/24h | 1.4033651881602824 |  | Pe (Teva) | 0.5845250949427135 |  | TC-Sub cool | 30.865155823364887 |  | Pe= | 0.5845250949427135 | 1.068431984708083 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Toatal fin quqntity | 504 |  | KWH/MONTH | 42.10095564480847 |  | V(m3/kgï¼‰ | 0.7461788464932085 |  | Hevin | 93.50817495732956 |  | v= | 0.7461788464932085 | 0.22972107024642002 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface    m2 | 1.591962624 |  | Qcomp(Ability of Compressor)   (kcal/h) | 121.77097166550514 |  | Volume Efficiency | 0.7957679097826498 |  | Hevout | 152.41503090320157 |  | Hevin= | 93.50817495732956 | 110.24135956298339 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Surface  Ï†8mm | 0.16208192 |  | How many defrost in a day   ï¼ˆTimes/24h) | 1.297006311642398 |  | G(kg/h) | 2.067178254724668 |  | QCOMP | 121.77097166550514 |  | Hevout= | 152.41503090320157 | 143.72791439205673 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Side Plate surface | 0 |  | Defrosting cycle   Hr | 18.50415050764774 |  |  |  |  | COMP INPUT | 98.18563907431633 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| SURFACE OF EVAPORATOR    (m2) | 1.754044544 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | â—‡  Condenser Heat Exchange   â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡ quantity of Evaporator fin  â—‡ |  |  | â—‡  ï¼¶ï¼¡ï¼²ï¼©ï¼¡ï¼¢ï¼¬ï¼¥  â—‡ |  |  | ï¼² Front | 11.203873237535912 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Evaporator Fin quantity | æžšæ•° |  | Calculate Cond Temp?  Yes=1, No=0 | 1 |  | ï¼¦ï¼² Partition | 6.438603493054403 |  | ç†±é€šéŽçŽ‡ | é¢ç© |  | ã‚µã‚¤ãƒ‰ã‚³ãƒ³ãƒ»ãƒãƒƒã‚¯ã‚³ãƒ³ã®ç†±é€šéŽçŽ‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 æ®µ | 93 |  | X1 =EV OUT  Temp.          T2     (â„ƒ) | -21.34296095493092 |  | ï¼¦ Front | 5.490409938591744 |  | K | S |  |  | K | Pipe Pitch |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 æ®µ | 93 |  | X2 =RUNNING RATIO          PR     (ï¼…) | 0.5674402613435491 |  | Sid  Condenser | 111.46706779246904 | Side Cond | 5.395 | 1.9016 |  | Side Cond | 5.395 | 150 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 æ®µ | 93 |  | X3 = âŠ¿T ( TC-T0) | 10.865155823364885 |  | Back Condenser | 36.02868286778478 | Back Cond | 4.17 | 0.7951999999999999 |  | Back Cond | 4.17 | 200 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 æ®µ | 92 |  |  |  |  | TOTAL  QC0ut | 170.6286373294359 | ãƒãƒƒã‚¯ã‚³ãƒ³æ”¾ç†±åŠ¹çŽ‡ |  | 0.7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 æ®µ | 62 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 æ®µ | 47 |  | â—‡  ï¼£ï¼¯ï¼®ï¼¤ï¼©ï¼´ï¼©ï¼¯ï¼®  â—‡ |  |  | â—‡ Radiate Heat â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7 æ®µ | 24 |  | F1= QF-QF' | 1.562293319423702e-05 |  | Q COND  Qcin | 170.6286834529105 | kcal/kg | Discharge |  |  |  | TC= | 40.86515582336489 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 8 æ®µ |  |  | F2= Qtotal-Qcomp*PR | 1.9228077974275948e-07 |  | enthalpy |  |  | Temp | 60 |  |  | Td= | 60 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Total | 504 |  | F3= QCout-QCin | -4.612347461829813e-05 |  | COND. IN | 182.2457515330678 | kcal/kg |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | COND. OUT | 99.70391796698429 | kcal/kg |  |  |  | Hcod nin | 182.2457515330678 | 157.42161460276833 |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  | Hcond out | 99.70391796698429 | 113.79180732525467 |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Outer Cab. Temp Rise |  | Cab. Temp. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | F,R Cab | 5.8617515667053555 | 33.326193840942246 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Back Cab | 4.530769978343157 | 32.57094130059855 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

**Rows with data:** 49
**Columns:** 28
**File type:** Values (calculated results)

---
## 54H calc_SIZE_formulas.md

# Sheet: SIZE - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| =MAIN!A1 | Column_B | Column_C | Column_D | PR= | =MAIN!E38 | TF= | =MAIN!B5 | T2= | =MAIN!E37 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `=MAIN!A2` |  |  |  |  |  | TR= | `=MAIN!B6` | Cab Side | `=MAIN!I50` |
|  |  |  |  | Comp temp | `=50*F1+H4` | TC= | `=MAIN!B7` | Back cab | `=MAIN!I51` |
| â—‡  ï¼³  ï¼©  ï¼º  ï¼¥  â—‡ | (mm) |  |  |  |  | T0= | `=MAIN!B8` | Cab Bottom | `=(F3-H4)*F1+H4` |
| â—‡  BASIC  SIZE  â—‡ |  |  | â—‡  Heat Load  â—‡ |  |  |  | B=K*S |  |  |
| TOTAL HIGHT         H | 1680 | 0 | POSITION | Q(kcal/h) | S(m2) or L(m) | K | B | INSIDE TEMP | OUTSIDE TEMP |
| F HIGHT             Hf | 550 |  | F TOP | `=H7*(J7-I7)` | `=(B$9-(B$18+B$19)/2)*(B10-B$22/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B17/1000/(B$34+0.00011*(I7+J7)/2))` | `=G7*F7` | `=H1` | `=H4` |
| R HIGHT             Hr | `=B6-B7` |  | F LEFT | `=H8*(J8-I8)` | `=(B10-B22/2)*(B7-(B17+B20)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B18/1000/(B$34+0.00011*(I8+J8)/2))` | `=G8*F8` | `=H1` | `=J2` |
| WIDTH               W | 800 |  | F RIGHT | `=H9*(J9-I9)` | `=F8` | `=1/(1/B$40+1/B$41+B19/1000/(B$34+0.00011*(I9+J9)/2))` | `=G9*F9` | `=H1` | `=J2` |
| DEPTH               D | 630 |  | F BOTTOM | `=H10*(J10-I10)` | `=(B10-B22/2)*(B9-(B18+B19)/2)*10^(-6)` | `=1/(1/B$41+1/B$41+B20/1000/(B$34+0.00011*(I10+J10)/2))` | `=G10*F10` | `=H1` | `=H2` |
| BOTOM HIGHT        Hb | 260 |  | F DOOR | `=H11*(J11-I11)` | `=(B7-B14/2-B36*2)*(B9-B36*2)*10^(-6)` | `=1/(1/B$40+1/B$41+B21/1000/(B$34+0.00011*(I11+J11)/2))` | `=G11*F11` | `=H1` | `=H4` |
| BOTTOM DEPTH       Db1 | 210 |  | F PACKIN | `=H12*(J12-I12)` | `=((B7-B36*2)+(B9-B36*2))*2*10^(-3)` | `=B37` | `=G12*F12` | `=H1` | `=H4` |
| BOTTOM DEPTH       Db2 | 230 |  | F DPCON1(FR-Partition) | `=(0.1219*(H3-H1)*F1+0.1219*((0.1984*H4+0.1219*H1)/(0.1984+0.1219)-H1)*(1-F1))*F13` | `=(B9-B18-B19)*10^(-3)` | * | * | * | * |
| Door gap of F&R door | 10 |  | F DPCON2(F-Front) | `=(0.0791*(MAIN!B7-MAIN!B5)-0.072*(MAIN!B8-MAIN!B5))*F14*MAIN!E38` | `=(B7*2+B9)*10^(-3)` | * | * | * | * |
|  |  |  | R TOP | `=H15*(J15-I15)` | `=(B$9-(B$18+B$19)/2)*(B10-B$22/2)*10^(-6)` | `=1/(1/B$41+1/B$41+B23/1000/(B$34+0.00011*(I15+J15)/2))` | `=G15*F15` | `=H2` | `=H1` |
| â—‡ THICKNESS OF WALL â—‡ |  |  | R LEFT | `=H16*(J16-I16)` | `=((B8-(B20+B27)/2)*(B10-B26/2)-((B13+B12)*B11/2))*10^(-6)` | `=1/(1/B$40+1/B$41+B24/1000/(B$34+0.00011*(I16+J16)/2))` | `=G16*F16` | `=H2` | `=J2` |
| F TOP | 59.4 |  | R RIGHT | `=H17*(J17-I17)` | `=F16` | `=1/(1/B$40+1/B$41+B25/1000/(B$34+0.00011*(I17+J17)/2))` | `=G17*F17` | `=H2` | `=J2` |
| F LEFT | 59.4 |  | R BACK | `=H18*(J18-I18)` | `=(B8-(B20+B27)/2-B11)*(B9-(B24+B25)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B26/1000/(B$34+0.00011*(I18+J18)/2))` | `=G18*F18` | `=H2` | `=J3` |
| F RIGHT | 59.4 |  | R BOTTOMã€€1 | `=H19*(J19-I19)` | `=(B9-(B24+B25)/2)*B12*10^(-6)` | `=1/(1/B$40+1/B$41+B27/1000/(B$34+0.00011*(I19+J19)/2))` | `=G19*F19` | `=H2` | `=J4` |
| F BOTTOM â€» | 70 |  | R BOTTOMã€€2 | `=H20*(J20-I20)` | `=(B9-(B24+B25)/2)*(SQRT(B11^2+(B13-B12)^2))*10^(-6)` | `=1/(1/B$40+1/B$41+B28/1000/(B$34+0.00011*(I20+J20)/2))` | `=G20*F20` | `=H2` | `=J4` |
| F DOOR | 59.4 |  | R BOTTOMã€€3 | `=H21*(J21-I21)` | `=(B9-(B24+B25)/2)*B13*10^(-6)` | `=1/(1/B$40+1/B$41+B29/1000/(B$34+0.00011*(I21+J21)/2))` | `=G21*F21` | `=H2` | `=H4` |
| EVA BACK | 60 |  | R DOOR | `=H22*(J22-I22)` | `=(B9-B43*2)*(B8-B14/2-B43*2)*10^(-6)` | `=1/(1/B$40+1/B$41+B30/1000/(B$34+0.00011*(I22+J22)/2))` | `=G22*F22` | `=H2` | `=H4` |
| R TOP â€» | 70 |  | R PACKIN | `=H23*(J23-I23)` | `=((B8-B36*2)+(B9-B36*2))*2*10^(-3)` | `=B37` | `=G23*F23` | `=H2` | `=H4` |
| R LEFT | 40 |  | R DPCON(R-Front) | `=(0.0546*(MAIN!B7-MAIN!B5)-0.0491*(MAIN!B8-MAIN!B5))*F24*MAIN!E38` | `=(B8*2+B9)*10^(-3)` | * | * | * | * |
| R RIGHT | 40 |  | PWB Heat LOAD | 0 |  |  |  |  |  |
| R BACK | 60 |  | EVA BACK | `=H26*(J26-I26)` | `=(B9-(B18+B19)/2)*(B7-(B17+B20)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B22/1000/(B$34+0.00011*(I26+J26)/2))` | `=G26*F26` | `=J1` | `=J3` |
| R BOTTOM 1 | 40 |  | FAN LOAD (FAN INPUT*0.86*Prï¼‰ | `=MAIN!B14*0.86*MAIN!E38` |  |  |  |  |  |
| R BOTTOM 2 | 40 |  | DEF. HEATER LOAD | `=MAIN!B15*0.86*MAIN!B19/60/24` |  |  |  |  |  |
| R BOTTOM 3 | 40 |  |  |  |  |  |  |  |  |
| R DOOR | 40 |  |  |  |  |  |  |  |  |
| â—‡  Thermal Conductivity  â—‡ | (kcal/mhâ„ƒ) |  | QF     TOTAL(kcal/h)  (inlet) | `=SUM(E7:E14)` |  |  |  |  |  |
| URETANE | 0.0165 |  | QR     TOTAL(kcal/h)  (inlet) | `=SUM(E15:E25)` |  |  |  |  |  |
| A=X-0.00011*T          X= | `=B33-0.00011*25` |  | QEVOUT TOTAL(kcal/h)  (inlet) | `=SUM(E26:E28)` |  |  |  |  |  |
| PS FORM     Î» | 0.035 |  | QEV  (=QF+QR+QEVOUT) | `=SUM(E32:E34)` |  |  |  |  |  |
| Packing position  L mm | 15 |  |  |  |  |  |  |  |  |
| PAKKIN | 0.035 |  |  |  |  |  |  |  |  |
| â—‡  Heat trancefer coefficent â—‡ | (kcal/m2hâ„ƒ) |  |  |  |  |  |  |  |  |
| OUTSIDE | 6 |  |  |  |  |  |  |  |  |
| INSIDE | 10 |  |  |  |  |  |  |  |  |
|  |  |  | VOLUME: |  |  |  |  |  |  |
|  |  |  | Freezer Gross volume | `=(B9-B18-B19)*(B7-B17-B20/2)*(B10-B22)/1000000` | 59 |  |  |  |  |
|  |  |  | Refrigeratorr Gross Volume | `=((B9-B24-B25)*(B8-B20/2-B27)*(B10-B26)-(B12+B13)*B11/2*(B9-B18-B19))/1000000` | 125 |  |  |  |  |
|  |  |  | TOTAL | `=E44+E45` | `=F44+F45` |  |  |  |  |
|  |  |  | ISO VOLUME |  |  |  |  |  |  |
|  |  |  | Freezer VOLUME | `=E44-(60+25)*(B9-B18-B19)*(B7-B17-B20/2)/1000000` | 48 |  |  |  |  |
|  |  |  | Refrigerator | `=E45-(B9-B18-B19)*60*300/1000000` | 120 |  |  |  |  |
|  |  |  | TOTAL | `=E50+E51` | `=F50+F51` |  |  |  |  |
| DOOR |  |  |  |  |  |  |  |  |  |
|  | Packing |  |  |  |  |  |  |  |  |

---

## Summary

**Rows with data:** 48
**Columns:** 10
**Cells containing formulas:** 126

## Formula Legend

- **`=FORMULA()`** : Excel formula (shown in code blocks)
- **Plain text/number** : Static value (no formula)
- **Empty cell** : No data

## Tips

- To copy a formula back to Excel, remove the backticks (`) and paste into a cell starting with `=`
- Formulas are shown exactly as they appear in the Excel formula bar

---
## 54H calc_SIZE_values.md

# Sheet: SIZE - VALUES (Calculated/Displayed)

*This shows the calculated values as they appear in Excel*

## Data Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | PR= | 0.5674402613435491 | TF= | -18 | T2= | -21.34296095493092 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-540   > |  |  |  |  |  | TR= | 3 | Cab Side | 33.326193840942246 |
|  |  |  |  | Comp temp | 58.372013067177456 | TC= | 40.86515582336489 | Back cab | 32.57094130059855 |
| â—‡  ï¼³  ï¼©  ï¼º  ï¼¥  â—‡ | (mm) |  |  |  |  | T0= | 30 | Cab Bottom | 46.099422509681766 |
| â—‡  BASIC  SIZE  â—‡ |  |  | â—‡  Heat Load  â—‡ |  |  |  | B=K*S |  |  |
| TOTAL HIGHT         H | 1680 | 0 | POSITION | Q(kcal/h) | S(m2) or L(m) | K | B | INSIDE TEMP | OUTSIDE TEMP |
| F HIGHT             Hf | 550 |  | F TOP | 4.85992987012987 | 0.44436 | 0.2278525046382189 | 0.10124853896103894 | -18 | 30 |
| R HIGHT             Hr | 1130 |  | F LEFT | 3.445865855975239 | 0.29118 | 0.23056732729118157 | 0.06713659436064624 | -18 | 33.326193840942246 |
| WIDTH               W | 800 |  | F RIGHT | 3.445865855975239 | 0.29118 | 0.23056732729118157 | 0.06713659436064624 | -18 | 33.326193840942246 |
| DEPTH               D | 630 |  | F BOTTOM | 1.6616437693738373 | 0.44436 | 0.17806709375215263 | 0.07912589377970654 | -18 | 3 |
| BOTOM HIGHT        Hb | 260 |  | F DOOR | 4.337035714285713 | 0.39654999999999996 | 0.2278525046382189 | 0.0903549107142857 | -18 | 30 |
| BOTTOM DEPTH       Db1 | 210 |  | F PACKIN | 4.3344000000000005 | 2.58 | 0.035 | 0.0903 | -18 | 30 |
| BOTTOM DEPTH       Db2 | 230 |  | F DPCON1(FR-Partition) | 3.841631511627019 | 0.6812 | * | * | * | * |
| Door gap of F&R door | 10 |  | F DPCON2(F-Front) | 1.2940158918068438 | 1.9000000000000001 | * | * | * | * |
|  |  |  | R TOP | -1.6616437693738373 | 0.44436 | 0.17806709375215263 | 0.07912589377970654 | 3 | -18 |
| â—‡ THICKNESS OF WALL â—‡ |  |  | R LEFT | 6.3511794618697035 | 0.5878 | 0.3562926769653677 | 0.20942883552024313 | 3 | 33.326193840942246 |
| F TOP | 59.4 |  | R RIGHT | 6.3511794618697035 | 0.5878 | 0.3562926769653677 | 0.20942883552024313 | 3 | 33.326193840942246 |
| F LEFT | 59.4 |  | R BACK | 4.481843419403305 | 0.6194 | 0.2446923148273912 | 0.1515624198040861 | 3 | 32.57094130059855 |
| F RIGHT | 59.4 |  | R BOTTOMã€€1 | 2.5493463888332273 | 0.1596 | 0.37061629531977724 | 0.05915036073303644 | 3 | 46.099422509681766 |
| F BOTTOM â€» | 70 |  | R BOTTOMã€€2 | 3.1656581161478594 | 0.1981837531181605 | 0.37061629531977724 | 0.073450128373222 | 3 | 46.099422509681766 |
| F DOOR | 59.4 |  | R BOTTOMã€€3 | 1.6638610364509407 | 0.17479999999999998 | 0.3525428079606197 | 0.06162448283151632 | 3 | 30 |
| EVA BACK | 60 |  | R DOOR | 8.566790233443058 | 0.8999999999999999 | 0.3525428079606197 | 0.3172885271645577 | 3 | 30 |
| R TOP â€» | 70 |  | R PACKIN | 3.5343000000000004 | 3.74 | 0.035 | 0.13090000000000002 | 3 | 30 |
| R LEFT | 40 |  | R DPCON(R-Front) | 1.4884790911765382 | 3.06 | * | * | * | * |
| R RIGHT | 40 |  | PWB Heat LOAD | 0 |  |  |  |  |  |
| R BACK | 60 |  | EVA BACK | 4.3615731572322245 | 0.35941318 | 0.225085954384664 | 0.08089885863872703 | -21.34296095493092 | 32.57094130059855 |
| R BOTTOM 1 | 40 |  | FAN LOAD (FAN INPUT*0.86*Prï¼‰ | 1.0247971119864496 |  |  |  |  |  |
| R BOTTOM 2 | 40 |  | DEF. HEATER LOAD | 0 |  |  |  |  |  |
| R BOTTOM 3 | 40 |  |  |  |  |  |  |  |  |
| R DOOR | 40 |  |  |  |  |  |  |  |  |
| â—‡  Thermal Conductivity  â—‡ | (kcal/mhâ„ƒ) |  | QF     TOTAL(kcal/h)  (inlet) | 27.22038846917376 |  |  |  |  |  |
| URETANE | 0.0165 |  | QR     TOTAL(kcal/h)  (inlet) | 36.4909934398205 |  |  |  |  |  |
| A=X-0.00011*T          X= | 0.01375 |  | QEVOUT TOTAL(kcal/h)  (inlet) | 5.386370269218674 |  |  |  |  |  |
| PS FORM     Î» | 0.035 |  | QEV  (=QF+QR+QEVOUT) | 69.09775217821293 |  |  |  |  |  |
| Packing position  L mm | 15 |  |  |  |  |  |  |  |  |
| PAKKIN | 0.035 |  |  |  |  |  |  |  |  |
| â—‡  Heat trancefer coefficent â—‡ | (kcal/m2hâ„ƒ) |  |  |  |  |  |  |  |  |
| OUTSIDE | 6 |  |  |  |  |  |  |  |  |
| INSIDE | 10 |  |  |  |  |  |  |  |  |
|  |  |  | VOLUME: |  |  |  |  |  |  |
|  |  |  | Freezer Gross volume | 176.9021904 | 59 |  |  |  |  |
|  |  |  | Refrigeratorr Gross Volume | 394.00736 | 125 |  |  |  |  |
|  |  |  | TOTAL | 570.9095504 | 184 |  |  |  |  |
|  |  |  | ISO VOLUME |  |  |  |  |  |  |
|  |  |  | Freezer VOLUME | 150.5220392 | 48 |  |  |  |  |
|  |  |  | Refrigerator | 381.74576 | 120 |  |  |  |  |
|  |  |  | TOTAL | 532.2677992 | 168 |  |  |  |  |
| DOOR |  |  |  |  |  |  |  |  |  |
|  | Packing |  |  |  |  |  |  |  |  |

---

**Rows with data:** 48
**Columns:** 10
**File type:** Values (calculated results)

---
## Compressor pv73_DATA_formulas.md

# Sheet: DATA - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| Column_A | Calculation of compressor performance formula data. | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |  | Volumetric efficiency |  |  | Input |  |  |  |  |
|  | Compressor name |  | SQ47LAEG 220V 50Hz |  | 2 | Refrigerantã€€R-134a=1, R-600a=2 |  |  |  | R-600a |  |  | Î·v=A+B*PC/PE+C*PC |  |  | W=AW+BW*TE+CW*TC+DW*TC*TE+EW*TE^2 |  |  |  |  |
|  | Cylinder volume |  | 10.17 | (CC) |  | Rated |  |  |  |  |  |  | A | `=B21` |  | AW | `=B22` |  |  |  |
|  | Speed |  | `=37*60` | (rpm) |  | Cooling Capacity |  | 120.2650528866975 | (kcal/h) | `=I5/0.86` | W |  | B | `=C21` |  | BW | `=C22` |  |  |  |
|  | Data quantity of Cond. |  | 3 | pcs |  | Input |  | 134.74999999999494 | (  W  ) |  |  |  | C | `=E21` |  | CW | `=E22` |  |  |  |
|  | Data quantity of  Evap.. |  | 3 | pcs |  | C.O P. |  | `=I5/I6/0.86` |  |  |  |  |  |  |  | DW | `=G22` |  |  |  |
|  | Total data quantity |  | 9 | pcs |  |  |  |  |  |  |  |  |  |  |  | EW | `=I22` |  |  |  |
|  |  |  | Y |  |  |  | After input the yellow marked data press Calculate |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cooling Capacity ï¼±(kcal/hr) |  |  |  |  | Input  ï¼ˆï¼·ï¼‰ |  |  |  |  | Volumetric efficiency ï¼¥ï¼´ï¼¶ |  |  |  |  |  | COP |  |  |  |  |
|  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |
|  |  | 37.8 | 46.1 | 54.4 |  |  | `=C13` | `=D13` | `=E13` |  |  | 37.8 | 46.1 | 54.4 |  |  |  | `=IF(C13="","",C13)` | `=IF(D13="","",D13)` | `=IF(E13="","",E13)` |
| Evap. Temp. | -34.4 | 70.554507 | 67.112824 | 61.950299 | Evap. Temp. | `=IF(B14="","",B14)` | 49.7 | 51.3 | 72 | Evap. Temp. | -34.4 | 0.750251124266466 | 0.7136535113015171 | 0.6587570865372743 |  | Evap. Temp. | `=IF(B14="","",B14)` | `=IF(C14="","",C14/H14)` | `=IF(D14="","",D14/I14)` | `=IF(E14="","",E14/J14)` |
|  | -23.3 | 129.063122 | 126.48186 | 121.319335 |  | `=IF(B15="","",B15)` | 67.6 | 72.4 | 141 |  | -23.3 | 0.8194887439596955 | 0.8030989718742899 | 0.7703194213539598 |  |  | `=IF(B15="","",B15)` | `=IF(C15="","",C15/H15)` | `=IF(D15="","",D15/I15)` | `=IF(E15="","",E15/J15)` |
|  | -12.2 | 215.105204 | 210.8031 | 203.919733 |  | `=IF(B16="","",B16)` | 86.2 | 93.5 | 237 |  | -12.2 | 0.8563733691862448 | 0.8392459021210147 | 0.8118419524279362 |  |  | `=IF(B16="","",B16)` | `=IF(C16="","",C16/H16)` | `=IF(D16="","",D16/I16)` | `=IF(E16="","",E16/J16)` |
|  |  |  |  |  |  | `=IF(B17="","",B17)` |  |  |  |  | -20 | 0.8452696120886641 | 0.7577118041797148 | 0.6667863875215928 |  |  | `=IF(B17="","",B17)` | `=IF(C17="","",C17/H17)` | `=IF(D17="","",D17/I17)` | `=IF(E17="","",E17/J17)` |
|  |  |  |  |  |  | `=IF(B18="","",B18)` |  |  |  |  | -15 | 0.8628511434767668 | 0.7782043547579203 | 0.6908270238532728 |  |  | `=IF(B18="","",B18)` | `=IF(C18="","",C18/H18)` | `=IF(D18="","",D18/I18)` | `=IF(E18="","",E18/J18)` |
|  |  |  |  |  |  | `=IF(B19="","",B19)` |  |  |  |  | -10 | 0.8754891851607379 | 0.7928537266420329 | 0.7079848768614745 |  |  | `=IF(B19="","",B19)` | `=IF(C19="","",C19/H19)` | `=IF(D19="","",D19/I19)` | `=IF(E19="","",E19/J19)` |
| Æ’Ã…v= | 0.9302583559597055 | -0.012294405565323853 | * PC/PE + | -0.0020532051517885733 | * PC |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W= | -403.45924099760987 | -10.669447614327456 | *TE+ | 13.074324324321825 | *TC+ | 0.34869206555942833 | *TC*TE+ | 0.037469902334827346 | *TE^2 |  |  |  |  |  |  |  |  |  |  |  |
| Calculation by the formula |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cooling Capacity ï¼±(kcal/hr) |  |  |  |  | Input  ï¼ˆï¼·ï¼‰ |  |  |  |  | Volumetric efficiency ï¼¥ï¼´ï¼¶ |  |  |  |  |  | COP |  |  |  |  |
|  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |
|  |  | 37.8 | 46.1 | 54.4 |  |  | 37.8 | 46.1 | 54.4 |  |  | 37.8 | 46.1 | 54.4 |  |  |  | `=IF(C26="","",C26)` | `=IF(D26="","",D26)` | `=IF(E26="","",E26)` |
| Evap. Temp. | -34.4 | 70.90169277740574 | 66.93180951230698 | 62.315043224978375 | Evap. Temp. | -34.4 | 48.70833333332502 | 57.66666666666823 | 66.62500000001125 | Evap. Temp. | -34.4 | 0.7539429723269733 | 0.7117286686702702 | 0.6626356447824581 |  |  |  |  |  | `=IF(E27="","",E27/J27)` |
|  | -23.3 | 129.21876574114629 | 125.07917734821743 | 120.2650528866975 |  | -23.3 | 52.583333333328426 | 93.66666666666168 | 134.74999999999494 |  | -23.3 | 0.8204770068496722 | 0.7941926117408092 | 0.763625237055447 |  |  |  |  |  | `=IF(E28="","",E28/J28)` |
|  | -12.2 | 215.32314711884123 | 210.93194884523064 | 205.8252152722784 |  | -12.2 | 65.69166666667978 | 138.90000000000327 | 212.10833333332664 |  | -12.2 | 0.8572410408162303 | 0.8397588730657153 | 0.8194280277208225 |  |  |  |  |  | `=IF(E29="","",E29/J29)` |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `=IF(E30="","",E30/J30)` |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `=IF(E31="","",E31/J31)` |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `=IF(E32="","",E32/J32)` |
|  |  |  | ã‚³ãƒ³ãƒ—æ¸¬å®šæ¡ä»¶ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  | å†·å‡èƒ½åŠ›  ï¼±(kcal/hr) è¨ˆç®—å€¤ |  |  |  |  |  | å…¥åŠ› W è¨ˆç®—å€¤ |  |  |  |  |  |  |  | COP |  |  |  |  |
|  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |
|  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |
|  | -32 | 82.74996348895222 | 80.53754702732623 | 78.10332623032329 | 75.43518732930734 | 72.52102824642456 |  | -32 | 43.398500576436064 | 52.97939170853665 | 62.5602828406373 | 72.14117397273795 | 81.72206510483848 |  | -32 | `=C43/J43/0.86` | `=D43/K43/0.86` | `=E43/L43/0.86` | `=F43/M43/0.86` | `=G43/N43/0.86` |
| è’¸ | -30 | 92.40268256327074 | 90.17475851170477 | 87.72347542168502 | 85.0366346149937 | 82.10204918613984 | è’¸ | -30 | 41.82178204742258 | 54.88959383511742 | 67.95740562281236 | 81.02521741050725 | 94.09302919820209 | è’¸ | -30 | `=C44/J44/0.86` | `=D44/K44/0.86` | `=E44/L44/0.86` | `=F44/M44/0.86` | `=G44/N44/0.86` |
| ç™º | -28 | 102.8091852940007 | 100.56453300625279 | 98.09484460190035 | 95.38782980967038 | 92.43121021941172 | ç™º | -28 | 40.54482273708766 | 57.0995551803768 | 73.65428762366605 | 90.20902006695525 | 106.76375251024433 | ç™º | -28 | `=C45/J45/0.86` | `=D45/K45/0.86` | `=E45/L45/0.86` | `=F45/M45/0.86` | `=G45/N45/0.86` |
| æ¸© | -26 | 114.01135320433427 | 111.74868247001977 | 109.25916919176912 | 106.53042444089253 | 103.55007124503463 | æ¸© | -26 | 39.567622645431356 | 59.6092757443148 | 79.6509288431983 | 99.6925819420818 | 119.73423504096519 | æ¸© | -26 | `=C46/J46/0.86` | `=D46/K46/0.86` | `=E46/L46/0.86` | `=F46/M46/0.86` | `=G46/N46/0.86` |
| åº¦ | -24 | 126.05240486262706 | 123.77035341143949 | 121.25951641548403 | 118.50739882973866 | 115.5015176679268 | åº¦ | -24 | 38.89018177245373 | 62.41875552693142 | 85.94732928140922 | 109.47590303588703 | 133.00447679036466 | åº¦ | -24 | `=C47/J47/0.86` | `=D47/K47/0.86` | `=E47/L47/0.86` | `=F47/M47/0.86` | `=G47/N47/0.86` |
|  | -22 | 138.97692252807428 | 136.67405345173714 | 134.1403117735203 | 131.3630884644847 | 128.32978666444038 |  | -22 | 38.51250011815466 | 65.52799452822671 | 92.54348893829876 | 119.55898334837082 | 146.57447775844275 |  | -22 | `=C48/J48/0.86` | `=D48/K48/0.86` | `=E48/L48/0.86` | `=F48/M48/0.86` | `=G48/N48/0.86` |
|  | -20 | 152.83088523828675 | 150.5056843164508 | 147.94737192847313 | 145.14321677060147 | 142.08049982583788 |  | -20 | 38.43457768253421 | 68.93699274820051 | 99.43940781386681 | 129.94182287953316 | 160.44423794519935 | â„ƒ | -20 | `=C49/J49/0.86` | `=D49/K49/0.86` | `=E49/L49/0.86` | `=F49/M49/0.86` | `=G49/N49/0.86` |
|  | -18 | 167.66170950318332 | 165.3125824173538 | 162.72794516378423 | 159.89493543444718 | 156.80070333449942 |  | -18 | 38.65641446559241 | 72.645750186853 | 106.6350859081136 | 140.62442162937424 | 174.61375735063473 |  | -18 | `=C50/J50/0.86` | `=D50/K50/0.86` | `=E50/L50/0.86` | `=F50/M50/0.86` | `=G50/N50/0.86` |
|  |  | æœ‰åŠ¹å†·å‡èƒ½åŠ›  ï¼±(kcal/hr) è¨ˆç®—å€¤ |  |  |  |  |  |  | å…¥åŠ›  ï¼· |  |  |  |  |  |  | æœ‰åŠ¹å†·å‡èƒ½åŠ›ã«å¯¾ã™ã‚‹ã€€COP |  |  |  |  |
|  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |
|  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |
|  | -32 | 62.476263413475145 | 57.76794087479624 | 53.02823489738986 | 48.27726321195574 | 43.53819896660536 |  | -32 | `=J43` | `=K43` | `=L43` | `=M43` | `=N43` |  | -32 | `=C60/J60/0.86` | `=D60/K60/0.86` | `=E60/L60/0.86` | `=F60/M60/0.86` | `=G60/N60/0.86` |
| è’¸ | -30 | 70.52273054137947 | 65.41940573656082 | 60.27717575287826 | 55.115961510221574 | 49.958762191997046 | è’¸ | -30 | `=J44` | `=K44` | `=L44` | `=M44` | `=N44` | è’¸ | -30 | `=C61/J61/0.86` | `=D61/K61/0.86` | `=E61/L61/0.86` | `=F61/M61/0.86` | `=G61/N61/0.86` |
| ç™º | -28 | 79.31518254647267 | 73.78667156977701 | 68.21124448162202 | 62.608615677281094 | 57.001602474535694 | ç™º | -28 | `=J45` | `=K45` | `=L45` | `=M45` | `=N45` | ç™º | -28 | `=C62/J62/0.86` | `=D62/K62/0.86` | `=E62/L62/0.86` | `=F62/M62/0.86` | `=G62/N62/0.86` |
| æ¸© | -26 | 88.90690247756554 | 82.92126472480913 | 76.88018131689317 | 70.80314980160996 | 64.71279722812152 | æ¸© | -26 | `=J46` | `=K46` | `=L46` | `=M46` | `=N46` | æ¸© | -26 | `=C63/J63/0.86` | `=D63/K63/0.86` | `=E63/L63/0.86` | `=F63/M63/0.86` | `=G63/N63/0.86` |
| åº¦ | -24 | 99.35395247280533 | 92.87742231946164 | 86.3363676775562 | 79.75005828685931 | 73.14092199862804 | åº¦ | -24 | `=J47` | `=K47` | `=L47` | `=M47` | `=N47` | åº¦ | -24 | `=C64/J64/0.86` | `=D64/K64/0.86` | `=E64/L64/0.86` | `=F64/M64/0.86` | `=G64/N64/0.86` |
|  | -22 | 110.71529101056518 | 103.7122067917462 | 96.6349379708345 | 89.50251485170008 | 82.33715660706065 |  | -22 | `=J48` | `=K48` | `=L48` | `=M48` | `=N48` |  | -22 | `=C65/J65/0.86` | `=D65/K65/0.86` | `=E65/L65/0.86` | `=F65/M65/0.86` | `=G65/N65/0.86` |
|  | -20 | 123.05290047470842 | 115.4856303758213 | 107.83390092056119 | 100.11649065086745 | 92.3554000029571 |  | -20 | `=J49` | `=K49` | `=L49` | `=M49` | `=N49` | â„ƒ | -20 | `=C66/J66/0.86` | `=D66/K66/0.86` | `=E66/L66/0.86` | `=F66/M66/0.86` | `=G66/N66/0.86` |
|  | -18 | 136.4319267039476 | 128.26079111406074 | 119.99427197614187 | 111.65088301392503 | 103.25239526484405 |  | -18 | `=J50` | `=K50` | `=L50` | `=M50` | `=N50` |  | -18 | `=C67/J67/0.86` | `=D67/K67/0.86` | `=E67/L67/0.86` | `=F67/M67/0.86` | `=G67/N67/0.86` |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | æœ‰åŠ¹å†·å‡èƒ½åŠ›ã®ã€€COPæ¯” |  |  |  |  |
|  |  |  | ä½“ç©åŠ¹çŽ‡ã€€æ¸¬å®šå€¤ |  |  | ä½“ç©åŠ¹çŽ‡ã€€è¨ˆç®—å€¤ |  |  |  |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |
| PC | PE |  | `=M26` | `=N26` | `=D72` | `=E72` | `=N26` |  |  |  |  |  |  |  |  | 35 | 40 | 45 | 50 | 55 |
| 5.162372024232351 | 0.382994430215269 | 13.47897414939101 | 0.750251124266466 |  |  | 0.7539429723269733 |  |  |  |  |  |  |  |  | -32 | `=Q60/$U$60` | `=R60/$U$60` | `=S60/$U$60` | `=T60/$U$60` | `=U60/$U$60` |
| 6.3983727391430625 | 0.382994430215269 | 16.70617699465431 |  | 0.7136535113015171 |  |  | 0.7117286686702702 |  |  |  |  |  |  | è’¸ | -30 | `=Q61/$U$60` | `=R61/$U$60` | `=S61/$U$60` | `=T61/$U$60` | `=U61/$U$60` |
| 7.835776826532984 | 0.382994430215269 | 20.459244856716957 |  |  | 0.6587570865372743 |  |  | 0.6626356447824581 |  |  |  |  |  | ç™º | -28 | `=Q62/$U$60` | `=R62/$U$60` | `=S62/$U$60` | `=T62/$U$60` | `=U62/$U$60` |
| 5.162372024232351 | 0.6399178637701737 | 8.067241620381479 | 0.8194887439596955 |  |  | 0.8204770068496722 |  |  |  |  |  |  |  | æ¸© | -26 | `=Q63/$U$60` | `=R63/$U$60` | `=S63/$U$60` | `=T63/$U$60` | `=U63/$U$60` |
| 6.3983727391430625 | 0.6399178637701737 | 9.998740621876179 |  | 0.8030989718742899 |  |  | 0.7941926117408092 |  |  |  |  |  |  | åº¦ | -24 | `=Q64/$U$60` | `=R64/$U$60` | `=S64/$U$60` | `=T64/$U$60` | `=U64/$U$60` |
| 7.835776826532984 | 0.6399178637701737 | 12.244972785049804 |  |  | 0.7703194213539598 |  |  | 0.763625237055447 |  |  |  |  |  |  | -22 | `=Q65/$U$60` | `=R65/$U$60` | `=S65/$U$60` | `=T65/$U$60` | `=U65/$U$60` |
| 5.162372024232351 | 1.0168283285879745 | 5.076935682349757 | 0.8563733691862448 |  |  | 0.8572410408162303 |  |  |  |  |  |  |  | â„ƒ | -20 | `=Q66/$U$60` | `=R66/$U$60` | `=S66/$U$60` | `=T66/$U$60` | `=U66/$U$60` |
| 6.3983727391430625 | 1.0168283285879745 | 6.292480804530895 |  | 0.8392459021210147 |  |  | 0.8397588730657153 |  |  |  |  |  |  |  | -18 | `=Q67/$U$60` | `=R67/$U$60` | `=S67/$U$60` | `=T67/$U$60` | `=U67/$U$60` |
| 7.835776826532984 | 1.0168283285879745 | 7.706096109078893 |  |  | 0.8118419524279362 |  |  | 0.8194280277208225 |  |  |  |  |  |  |  |  |  |  |  |  |
| 4.787831838082025 | 1.1086403483853422 | 4.318651982182653 | 0.8754891851607379 |  |  | 0.8684551596279145 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6.223359441868405 | 1.1086403483853422 | 5.6135061753185305 |  | 0.7928537266420329 |  |  | 0.7969223658821604 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7.947949161792489 | 1.1086403483853422 | 7.169096067419995 |  |  | 0.7079848768614745 |  |  | 0.7109855156216794 |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | å†·å‡èƒ½åŠ›ã€€è¿‘ä¼¼å¼ã¨ãƒ‡ãƒ¼ã‚¿ãƒ¼ã®æ¯”è¼ƒ |  |  |  |  |  |  |  | å…¥åŠ›ã€€è¿‘ä¼¼å¼ã¨ãƒ‡ãƒ¼ã‚¿ãƒ¼ã®æ¯”è¼ƒ |  |  |  |  |  |  |  |  |  |
|  |  | è¨ˆç®—çµæžœ |  |  | ãƒ‡ãƒ¼ã‚¿ãƒ¼ |  |  |  |  |  | è¨ˆç®—çµæžœ |  |  | ãƒ‡ãƒ¼ã‚¿ãƒ¼ |  |  |  |  |  |  |
|  |  | 37.8 | 46.1 | 54.4 | 37.8 | 46.1 | 54.4 |  |  |  | 40.5 | 54.4 | 65 | 40.5 | 54.4 | 65 |  |  |  |  |
|  | -34.4 | `=IF(C27="","",C27)` | `=IF(D27="","",D27)` | `=IF(E27="","",E27)` | `=IF(C14="","",C14)` | `=IF(D14="","",D14)` | `=IF(E14="","",E14)` |  |  | -30 | `=IF(H27="","",H27)` | `=IF(I27="","",I27)` | `=IF(J27="","",J27)` | `=IF(H14="","",H14)` | `=IF(I14="","",I14)` | `=IF(J14="","",J14)` |  |  |  |  |
|  | -23.3 | `=IF(C28="","",C28)` | `=IF(D28="","",D28)` | `=IF(E28="","",E28)` | `=IF(C15="","",C15)` | `=IF(D15="","",D15)` | `=IF(E15="","",E15)` |  |  | -20 | `=IF(H28="","",H28)` | `=IF(I28="","",I28)` | `=IF(J28="","",J28)` | `=IF(H15="","",H15)` | `=IF(I15="","",I15)` | `=IF(J15="","",J15)` |  |  |  |  |
|  | -12.2 | `=IF(C29="","",C29)` | `=IF(D29="","",D29)` | `=IF(E29="","",E29)` | `=IF(C16="","",C16)` | `=IF(D16="","",D16)` | `=IF(E16="","",E16)` |  |  | -15 | `=IF(H29="","",H29)` | `=IF(I29="","",I29)` | `=IF(J29="","",J29)` | `=IF(H16="","",H16)` | `=IF(I16="","",I16)` | `=IF(J16="","",J16)` |  |  |  |  |
|  | -20 | `=IF(C30="","",C30)` | `=IF(D30="","",D30)` | `=IF(E30="","",E30)` | `=IF(C17="","",C17)` | `=IF(D17="","",D17)` | `=IF(E17="","",E17)` |  |  | -10 | `=IF(H30="","",H30)` | `=IF(I30="","",I30)` | `=IF(J30="","",J30)` | `=IF(H17="","",H17)` | `=IF(I17="","",I17)` | `=IF(J17="","",J17)` |  |  |  |  |
|  | -15 | `=IF(C31="","",C31)` | `=IF(D31="","",D31)` | `=IF(E31="","",E31)` | `=IF(C18="","",C18)` | `=IF(D18="","",D18)` | `=IF(E18="","",E18)` |  |  |  | `=IF(H31="","",H31)` | `=IF(I31="","",I31)` | `=IF(J31="","",J31)` | `=IF(H18="","",H18)` | `=IF(I18="","",I18)` | `=IF(J18="","",J18)` |  |  |  |  |
|  | -10 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

## Summary

**Rows with data:** 76
**Columns:** 21
**Cells containing formulas:** 281

## Formula Legend

- **`=FORMULA()`** : Excel formula (shown in code blocks)
- **Plain text/number** : Static value (no formula)
- **Empty cell** : No data

## Tips

- To copy a formula back to Excel, remove the backticks (`) and paste into a cell starting with `=`
- Formulas are shown exactly as they appear in the Excel formula bar

---
## Compressor pv73_DATA_values.md

# Sheet: DATA - VALUES (Calculated/Displayed)

*This shows the calculated values as they appear in Excel*

## Data Table

| Column_A | Calculation of compressor performance formula data. | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |  | Volumetric efficiency |  |  | Input |  |  |  |  |
|  | Compressor name |  | SQ47LAEG 220V 50Hz |  | 2 | Refrigerantã€€R-134a=1, R-600a=2 |  |  |  | R-600a |  |  | Î·v=A+B*PC/PE+C*PC |  |  | W=AW+BW*TE+CW*TC+DW*TC*TE+EW*TE^2 |  |  |  |  |
|  | Cylinder volume |  | 10.17 | (CC) |  | Rated |  |  |  |  |  |  | A | 0.9302583559597055 |  | AW | -403.45924099760987 |  |  |  |
|  | Speed |  | 2220 | (rpm) |  | Cooling Capacity |  | 120.2650528866975 | (kcal/h) | 139.84308475197383 | W |  | B | -0.012294405565323853 |  | BW | -10.669447614327456 |  |  |  |
|  | Data quantity of Cond. |  | 3 | pcs |  | Input |  | 134.74999999999494 | (  W  ) |  |  |  | C | -0.0020532051517885733 |  | CW | 13.074324324321825 |  |  |  |
|  | Data quantity of  Evap.. |  | 3 | pcs |  | C.O P. |  | 1.0377965473245203 |  |  |  |  |  |  |  | DW | 0.34869206555942833 |  |  |  |
|  | Total data quantity |  | 9 | pcs |  |  |  |  |  |  |  |  |  |  |  | EW | 0.037469902334827346 |  |  |  |
|  |  |  | Y |  |  |  | After input the yellow marked data press Calculate |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cooling Capacity ï¼±(kcal/hr) |  |  |  |  | Input  ï¼ˆï¼·ï¼‰ |  |  |  |  | Volumetric efficiency ï¼¥ï¼´ï¼¶ |  |  |  |  |  | COP |  |  |  |  |
|  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |
|  |  | 37.8 | 46.1 | 54.4 |  |  | 37.8 | 46.1 | 54.4 |  |  | 37.8 | 46.1 | 54.4 |  |  |  | 37.8 | 46.1 | 54.4 |
| Evap. Temp. | -34.4 | 70.554507 | 67.112824 | 61.950299 | Evap. Temp. | -34.4 | 49.7 | 51.3 | 72 | Evap. Temp. | -34.4 | 0.750251124266466 | 0.7136535113015171 | 0.6587570865372743 |  | Evap. Temp. | -34.4 | 1.4196077867203218 | 1.3082421832358675 | 0.8604208194444445 |
|  | -23.3 | 129.063122 | 126.48186 | 121.319335 |  | -23.3 | 67.6 | 72.4 | 141 |  | -23.3 | 0.8194887439596955 | 0.8030989718742899 | 0.7703194213539598 |  |  | -23.3 | 1.9092177810650888 | 1.7469870165745855 | 0.8604208156028369 |
|  | -12.2 | 215.105204 | 210.8031 | 203.919733 |  | -12.2 | 86.2 | 93.5 | 237 |  | -12.2 | 0.8563733691862448 | 0.8392459021210147 | 0.8118419524279362 |  |  | -12.2 | 2.4954199999999997 | 2.2545786096256686 | 0.8604208143459916 |
|  |  |  |  |  |  |  |  |  |  |  | -20 | 0.8452696120886641 | 0.7577118041797148 | 0.6667863875215928 |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  | -15 | 0.8628511434767668 | 0.7782043547579203 | 0.6908270238532728 |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  | -10 | 0.8754891851607379 | 0.7928537266420329 | 0.7079848768614745 |  |  |  |  |  |  |
| Æ’Ã…v= | 0.9302583559597055 | -0.012294405565323853 | * PC/PE + | -0.0020532051517885733 | * PC |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W= | -403.45924099760987 | -10.669447614327456 | *TE+ | 13.074324324321825 | *TC+ | 0.34869206555942833 | *TC*TE+ | 0.037469902334827346 | *TE^2 |  |  |  |  |  |  |  |  |  |  |  |
| Calculation by the formula |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cooling Capacity ï¼±(kcal/hr) |  |  |  |  | Input  ï¼ˆï¼·ï¼‰ |  |  |  |  | Volumetric efficiency ï¼¥ï¼´ï¼¶ |  |  |  |  |  | COP |  |  |  |  |
|  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |  |  |  | Cond. Temp.ï¼ˆâ„ƒï¼‰ |  |  |
|  |  | 37.8 | 46.1 | 54.4 |  |  | 37.8 | 46.1 | 54.4 |  |  | 37.8 | 46.1 | 54.4 |  |  |  | 37.8 | 46.1 | 54.4 |
| Evap. Temp. | -34.4 | 70.90169277740574 | 66.93180951230698 | 62.315043224978375 | Evap. Temp. | -34.4 | 48.70833333332502 | 57.66666666666823 | 66.62500000001125 | Evap. Temp. | -34.4 | 0.7539429723269733 | 0.7117286686702702 | 0.6626356447824581 |  |  |  |  |  | 0.9353102172603054 |
|  | -23.3 | 129.21876574114629 | 125.07917734821743 | 120.2650528866975 |  | -23.3 | 52.583333333328426 | 93.66666666666168 | 134.74999999999494 |  | -23.3 | 0.8204770068496722 | 0.7941926117408092 | 0.763625237055447 |  |  |  |  |  | 0.8925050306990874 |
|  | -12.2 | 215.32314711884123 | 210.93194884523064 | 205.8252152722784 |  | -12.2 | 65.69166666667978 | 138.90000000000327 | 212.10833333332664 |  | -12.2 | 0.8572410408162303 | 0.8397588730657153 | 0.8194280277208225 |  |  |  |  |  | 0.9703777877921733 |
|  |  |  | ã‚³ãƒ³ãƒ—æ¸¬å®šæ¡ä»¶ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  | å†·å‡èƒ½åŠ›  ï¼±(kcal/hr) è¨ˆç®—å€¤ |  |  |  |  |  | å…¥åŠ› W è¨ˆç®—å€¤ |  |  |  |  |  |  |  | COP |  |  |  |  |
|  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |
|  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |
|  | -32 | 82.74996348895222 | 80.53754702732623 | 78.10332623032329 | 75.43518732930734 | 72.52102824642456 |  | -32 | 43.398500576436064 | 52.97939170853665 | 62.5602828406373 | 72.14117397273795 | 81.72206510483848 |  | -32 | 2.2171477470375125 | 1.767636574842011 | 1.45168495208685 | 1.2158844841781096 | 1.0318728108809567 |
| è’¸ | -30 | 92.40268256327074 | 90.17475851170477 | 87.72347542168502 | 85.0366346149937 | 82.10204918613984 | è’¸ | -30 | 41.82178204742258 | 54.88959383511742 | 67.95740562281236 | 81.02521741050725 | 94.09302919820209 | è’¸ | -30 | 2.5691152902786243 | 1.9102777600690386 | 1.5009996372457823 | 1.2203584371873653 | 1.0146075630379976 |
| ç™º | -28 | 102.8091852940007 | 100.56453300625279 | 98.09484460190035 | 95.38782980967038 | 92.43121021941172 | ç™º | -28 | 40.54482273708766 | 57.0995551803768 | 73.65428762366605 | 90.20902006695525 | 106.76375251024433 | ç™º | -28 | 2.9484791454273016 | 2.047923195307651 | 1.5486372412657379 | 1.229545350251126 | 1.006691399383023 |
| æ¸© | -26 | 114.01135320433427 | 111.74868247001977 | 109.25916919176912 | 106.53042444089253 | 103.55007124503463 | æ¸© | -26 | 39.567622645431356 | 59.6092757443148 | 79.6509288431983 | 99.6925819420818 | 119.73423504096519 | æ¸© | -26 | 3.350500537352341 | 2.1798675932730878 | 1.5950290526043684 | 1.2425456753757602 | 1.005619316363897 |
| åº¦ | -24 | 126.05240486262706 | 123.77035341143949 | 121.25951641548403 | 118.50739882973866 | 115.5015176679268 | åº¦ | -24 | 38.89018177245373 | 62.41875552693142 | 85.94732928140922 | 109.47590303588703 | 133.00447679036466 | åº¦ | -24 | 3.7688834845603902 | 2.3057014575146613 | 1.6405330901064086 | 1.2587181027375562 | 1.0097712013350235 |
|  | -22 | 138.97692252807428 | 136.67405345173714 | 134.1403117735203 | 131.3630884644847 | 128.32978666444038 |  | -22 | 38.51250011815466 | 65.52799452822671 | 92.54348893829876 | 119.55898334837082 | 146.57447775844275 |  | -22 | 4.196068087277588 | 2.4252736423770562 | 1.6854465776343255 | 1.2775934773484 | 1.0180536506080695 |
|  | -20 | 152.83088523828675 | 150.5056843164508 | 147.94737192847313 | 145.14321677060147 | 142.08049982583788 |  | -20 | 38.43457768253421 | 68.93699274820051 | 99.43940781386681 | 129.94182287953316 | 160.44423794519935 | â„ƒ | -20 | 4.623709752720483 | 2.5386458372143004 | 1.7300166162073238 | 1.2988211074109828 | 1.0297028153472518 |
|  | -18 | 167.66170950318332 | 165.3125824173538 | 162.72794516378423 | 159.89493543444718 | 156.80070333449942 |  | -18 | 38.65641446559241 | 72.645750186853 | 106.6350859081136 | 140.62442162937424 | 174.61375735063473 |  | -18 | 5.043289163303535 | 2.6460451237548406 | 1.7744491813057566 | 1.3221341028405713 | 1.0441697263294092 |
|  |  | æœ‰åŠ¹å†·å‡èƒ½åŠ›  ï¼±(kcal/hr) è¨ˆç®—å€¤ |  |  |  |  |  |  | å…¥åŠ›  ï¼· |  |  |  |  |  |  | æœ‰åŠ¹å†·å‡èƒ½åŠ›ã«å¯¾ã™ã‚‹ã€€COP |  |  |  |  |
|  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |
|  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |  |  | 35 | 40 | 45 | 50 | 55 |
|  | -32 | 62.476263413475145 | 57.76794087479624 | 53.02823489738986 | 48.27726321195574 | 43.53819896660536 |  | -32 | 43.398500576436064 | 52.97939170853665 | 62.5602828406373 | 72.14117397273795 | 81.72206510483848 |  | -32 | 1.6739476469859955 | 1.2678896851546022 | 0.9856211553558694 | 0.7781458143896497 | 0.6194876828787984 |
| è’¸ | -30 | 70.52273054137947 | 65.41940573656082 | 60.27717575287826 | 55.115961510221574 | 49.958762191997046 | è’¸ | -30 | 41.82178204742258 | 54.88959383511742 | 67.95740562281236 | 81.02521741050725 | 94.09302919820209 | è’¸ | -30 | 1.960776682235362 | 1.3858560634710642 | 1.0313775019098832 | 0.7909676689020034 | 0.6173845654582519 |
| ç™º | -28 | 79.31518254647267 | 73.78667156977701 | 68.21124448162202 | 62.608615677281094 | 57.001602474535694 | ç™º | -28 | 40.54482273708766 | 57.0995551803768 | 73.65428762366605 | 90.20902006695525 | 106.76375251024433 | ç™º | -28 | 2.2746913224268175 | 1.5026116235521965 | 1.0768606026750922 | 0.807022577673284 | 0.6208186912834986 |
| æ¸© | -26 | 88.90690247756554 | 82.92126472480913 | 76.88018131689317 | 70.80314980160996 | 64.71279722812152 | æ¸© | -26 | 39.567622645431356 | 59.6092757443148 | 79.6509288431983 | 99.6925819420818 | 119.73423504096519 | æ¸© | -26 | 2.6127452762668475 | 1.617534755412659 | 1.122341709872475 | 0.8258311937711783 | 0.6284538303652741 |
| åº¦ | -24 | 99.35395247280533 | 92.87742231946164 | 86.3363676775562 | 79.75005828685931 | 73.14092199862804 | åº¦ | -24 | 38.89018177245373 | 62.41875552693142 | 85.94732928140922 | 109.47590303588703 | 133.00447679036466 | åº¦ | -24 | 2.970617427002971 | 1.7302011516466658 | 1.168054040140788 | 0.8470597030339565 | 0.6394339932886839 |
|  | -22 | 110.71529101056518 | 103.7122067917462 | 96.6349379708345 | 89.50251485170008 | 82.33715660706065 |  | -22 | 38.51250011815466 | 65.52799452822671 | 92.54348893829876 | 119.55898334837082 | 146.57447775844275 |  | -22 | 3.3427772822443793 | 1.8403674667745342 | 1.2141989483209172 | 0.8704715344122363 | 0.6531892948882583 |
|  | -20 | 123.05290047470842 | 115.4856303758213 | 107.83390092056119 | 100.11649065086745 | 92.3554000029571 |  | -20 | 38.43457768253421 | 68.93699274820051 | 99.43940781386681 | 129.94182287953316 | 160.44423794519935 | â„ƒ | -20 | 3.7228135866540013 | 1.947947123347306 | 1.260951363659349 | 0.8958972671990486 | 0.6693291163258737 |
|  | -18 | 136.4319267039476 | 128.26079111406074 | 119.99427197614187 | 111.65088301392503 | 103.25239526484405 |  | -18 | 38.65641446559241 | 72.645750186853 | 106.6350859081136 | 140.62442162937424 | 174.61375735063473 |  | -18 | 4.103892650942922 | 2.0529825130883173 | 1.3084644893361088 | 0.9232152328270129 | 0.6875799853815265 |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | æœ‰åŠ¹å†·å‡èƒ½åŠ›ã®ã€€COPæ¯” |  |  |  |  |
|  |  |  | ä½“ç©åŠ¹çŽ‡ã€€æ¸¬å®šå€¤ |  |  | ä½“ç©åŠ¹çŽ‡ã€€è¨ˆç®—å€¤ |  |  |  |  |  |  |  |  |  | å‡ç¸®æ¸©åº¦  â„ƒ |  |  |  |  |
| PC | PE |  | 37.8 | 46.1 | 37.8 | 46.1 | 46.1 |  |  |  |  |  |  |  |  | 35 | 40 | 45 | 50 | 55 |
| 5.162372024232351 | 0.382994430215269 | 13.47897414939101 | 0.750251124266466 |  |  | 0.7539429723269733 |  |  |  |  |  |  |  |  | -32 | 2.7021483933418255 | 2.046674567059411 | 1.5910262344129678 | 1.2561118419232435 | 1 |
| 6.3983727391430625 | 0.382994430215269 | 16.70617699465431 |  | 0.7136535113015171 |  |  | 0.7117286686702702 |  |  |  |  |  |  | è’¸ | -30 | 3.16515846307631 | 2.2371002713579444 | 1.664887826529507 | 1.276809355153482 | 0.9966050698364605 |
| 7.835776826532984 | 0.382994430215269 | 20.459244856716957 |  |  | 0.6587570865372743 |  |  | 0.6626356447824581 |  |  |  |  |  | ç™º | -28 | 3.671891121153827 | 2.425571427941013 | 1.7383083351566457 | 1.302725784511161 | 1.0021485631457836 |
| 5.162372024232351 | 0.6399178637701737 | 8.067241620381479 | 0.8194887439596955 |  |  | 0.8204770068496722 |  |  |  |  |  |  |  | æ¸© | -26 | 4.217590354864289 | 2.611084610909248 | 1.8117256256926404 | 1.3330873503949079 | 1.0144734879066675 |
| 6.3983727391430625 | 0.6399178637701737 | 9.998740621876179 |  | 0.8030989718742899 |  |  | 0.7941926117408092 |  |  |  |  |  |  | åº¦ | -24 | 4.795280857237264 | 2.792954887506902 | 1.8855161650878465 | 1.3673551976007279 | 1.0321980742493437 |
| 7.835776826532984 | 0.6399178637701737 | 12.244972785049804 |  |  | 0.7703194213539598 |  |  | 0.763625237055447 |  |  |  |  |  |  | -22 | 5.396035102280456 | 2.970789440432827 | 1.9600049877964612 | 1.4051474443641883 | 1.054402392397612 |
| 5.162372024232351 | 1.0168283285879745 | 5.076935682349757 | 0.8563733691862448 |  |  | 0.8572410408162303 |  |  |  |  |  |  |  | â„ƒ | -20 | 6.009503803778392 | 3.144448513156989 | 2.0354744710978405 | 1.4461906054947815 | 1.0804558909314532 |
| 6.3983727391430625 | 1.0168283285879745 | 6.292480804530895 |  | 0.8392459021210147 |  |  | 0.8397588730657153 |  |  |  |  |  |  |  | -18 | 6.624655766958712 | 3.314000535971882 | 2.1121719212488483 | 1.4902882790772747 | 1.1099171208478253 |
| 7.835776826532984 | 1.0168283285879745 | 7.706096109078893 |  |  | 0.8118419524279362 |  |  | 0.8194280277208225 |  |  |  |  |  |  |  |  |  |  |  |  |
| 4.787831838082025 | 1.1086403483853422 | 4.318651982182653 | 0.8754891851607379 |  |  | 0.8684551596279145 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6.223359441868405 | 1.1086403483853422 | 5.6135061753185305 |  | 0.7928537266420329 |  |  | 0.7969223658821604 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7.947949161792489 | 1.1086403483853422 | 7.169096067419995 |  |  | 0.7079848768614745 |  |  | 0.7109855156216794 |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | å†·å‡èƒ½åŠ›ã€€è¿‘ä¼¼å¼ã¨ãƒ‡ãƒ¼ã‚¿ãƒ¼ã®æ¯”è¼ƒ |  |  |  |  |  |  |  | å…¥åŠ›ã€€è¿‘ä¼¼å¼ã¨ãƒ‡ãƒ¼ã‚¿ãƒ¼ã®æ¯”è¼ƒ |  |  |  |  |  |  |  |  |  |
|  |  | è¨ˆç®—çµæžœ |  |  | ãƒ‡ãƒ¼ã‚¿ãƒ¼ |  |  |  |  |  | è¨ˆç®—çµæžœ |  |  | ãƒ‡ãƒ¼ã‚¿ãƒ¼ |  |  |  |  |  |  |
|  |  | 37.8 | 46.1 | 54.4 | 37.8 | 46.1 | 54.4 |  |  |  | 40.5 | 54.4 | 65 | 40.5 | 54.4 | 65 |  |  |  |  |
|  | -34.4 | 70.90169277740574 | 66.93180951230698 | 62.315043224978375 | 70.554507 | 67.112824 | 61.950299 |  |  | -30 | 48.70833333332502 | 57.66666666666823 | 66.62500000001125 | 49.7 | 51.3 | 72 |  |  |  |  |
|  | -23.3 | 129.21876574114629 | 125.07917734821743 | 120.2650528866975 | 129.063122 | 126.48186 | 121.319335 |  |  | -20 | 52.583333333328426 | 93.66666666666168 | 134.74999999999494 | 67.6 | 72.4 | 141 |  |  |  |  |
|  | -12.2 | 215.32314711884123 | 210.93194884523064 | 205.8252152722784 | 215.105204 | 210.8031 | 203.919733 |  |  | -15 | 65.69166666667978 | 138.90000000000327 | 212.10833333332664 | 86.2 | 93.5 | 237 |  |  |  |  |
|  | -20 |  |  |  |  |  |  |  |  | -10 |  |  |  |  |  |  |  |  |  |  |
|  | -15 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | -10 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

**Rows with data:** 73
**Columns:** 21
**File type:** Values (calculated results)

---
## Compressor pv73_MACROS.md

# VBA Macros






'
' Record2 Æ’}Æ’NÆ’Â
' ÃÂ¸Ã›â€¹LËœ^â€œÃº : 1996/8/3  Ã•Â°Â»ÃžÂ°â€“Â¼ : Æ’VÆ’Æ’Â[Æ’v(Å â€)
'
'

Dim N, AA(20, 20), F(10), TC(40), TE(40), PC(40), PE(40), Q(40), W(40), ETV(40), G(40), TEV, TD, IL, IGL, IG, VG, PL, PH, T, EAA(40), REI, ITC
    
Sub Record2()
Dim QU(40)
  

'  Æ’fÂ[Æ’^Â[â€šÃŒâ€œÃ‡â€šÃÂÅ¾â€šÃ
'  VC:Æ’VÆ’Å Æ’â€œÆ’_Â[â€”eÂÃ
'  RPM:â€°Ã±â€œ]Ââ€
'  NE:ÂÃ¶â€Â­â€°Â·â€œxâ€šÃŒÆ’fÂ[Æ’^Â[Ââ€
'  NC:â€¹ÃƒÂkâ€°Â·â€œxÆ’fÂ[Æ’^Â[Ââ€
'  NN:â€˜SÆ’fÂ[Æ’^Â[Ââ€
    VC = Cells(4, 4)
    RPM = Cells(5, 4)
    NC = Cells(6, 4)
    NE = Cells(7, 4)
    NN = NC * NE
    Cells(8, 4) = NN
    YN = Cells(9, 4)
    
    REI = Cells(3, 6)
    Cells(3, 10) = ""
   
    II = 0
    For I = 1 To NE
    For J = 1 To NC
    II = II + 1
    Q(II) = Cells(I + 13, J + 2)
    TE(II) = Cells(I + 13, 2)
    TC(II) = Cells(13, J + 2)
    Next J
    Next I
    
    
    For I = 1 To 3
    Cells(13, I + 12) = ""
    Next I
    
    For I = 1 To 6
    For J = 1 To 4
    Cells(I + 25, J + 11) = ""
    Cells(I + 26, J + 1) = ""
    Cells(I + 26, J + 6) = ""
    Cells(I + 26, J + 11) = ""
    Cells(I + 26, J + 16) = ""
    Next J
    Next I

    
    If YN = "N" Then GoTo BB
    II = 0
    For I = 1 To NE
    For J = 1 To NC
    II = II + 1
    W(II) = Cells(I + 13, J + 7)
    Next J
    Next I
         
BB:
    For I = 1 To 5
    For J = 1 To 5
    AA(I, J) = 0
    Next J
    Next I
    
'  â€˜ÃŒÂÃÅ’Ã¸â€”Â¦â€šÃŒâ€¹ÃŸÅ½â€”Å½Â®ÂÃ¬ÂÂ¬
    
    T = 32.2
    JOTA
    IIN = IL
    PDE = 0
    TIN = 32.2
    
    For I = 1 To NN
    TEV = TE(I)
    TD = TC(I)
    
    JOTA
    PE(I) = PL
    PC(I) = PH
    
       
    G(I) = Q(I) / (IG - IIN)
    GK = 60 * RPM * VC / VG / 10 ^ 6
    
'Â@ÂÃ…ÂÂ¬â€šQÂÃ¦â€“@Å’vÅ½ZÆ’}Æ’gÆ’Å Æ’NÆ’XÂÃ¬ÂÂ¬
    ETV(I) = G(I) / GK
    F(1) = 1
    F(2) = PC(I) / PE(I)
    F(3) = PC(I)
    F(4) = ETV(I)
    
    For J = 1 To 3
    For K = 1 To 4
    AA(J, K) = F(J) * F(K) + AA(J, K)
    Next K
    Next J
    Next I
    
'  â€˜ÃŒÂÃÅ’Ã¸â€”Â¦â€šÃŒÅ’vÅ½ZÅ’â€¹â€°ÃŠâ€šÃŒË†Ã³ÂÃ¼
    
    For I = 1 To NC
    Cells(13, 12 + I) = TC(I)
    Next I
    
    For J = 1 To NE
    Cells(J + 13, 12) = TE(J * NC)
    Next J
    
    II = 0
    For I = 1 To NE
    For J = 1 To NC
    II = II + 1
    Cells(13 + I, J + 12) = ETV(II)
    Next J
    Next I
    
 
       
    N = 3
' Æ’}Æ’gÆ’Å Æ’NÆ’Xâ€šÃŒÅ’vÅ½Z
    MATX
' â€˜ÃŒÂÃÅ’Ã¸â€”Â¦â€šÃŒÅ’WÂâ€Ë†Ã³Å½Å¡
    E1 = AA(1, 4)
    E2 = AA(2, 4)
    E3 = AA(3, 4)
    Cells(21, 1) = "Æ’Ã…v="
    Cells(21, 2) = E1
    
    Cells(21, 3) = E2
    Cells(21, 4) = "* PC/PE +"
    Cells(21, 5) = E3
    Cells(21, 6) = "* PC"
    
    If YN = "N" Then GoTo BX
'  â€œÃ¼â€”Ãâ€¹ÃŸÅ½â€”Å½Â®â€šÃŒÂÃ¬ÂÂ¬
    For I = 1 To 5
    For J = 1 To 6
    AA(I, J) = 0
    Next J
    Next I
    
    For I = 1 To NN
    F(1) = 1
    F(2) = TE(I)
    F(3) = TC(I)
    F(4) = TC(I) * TE(I)
    F(5) = TE(I) * TE(I)
    F(6) = W(I)
    For J = 1 To 5
    For K = 1 To 6
    AA(J, K) = AA(J, K) + F(J) * F(K)
    Next K
    Next J
    Next I
    
'    For I = 1 To 5
'    For J = 1 To 6
'    Cells(38 + I, 10 + J) = AA(I, J)
'    Next J
'    Next I
    
    N = 5
' Æ’}Æ’gÆ’Å Æ’NÆ’Xâ€šÃŒÅ’vÅ½Z
    MATX
    
    W1 = AA(1, 6)
    W2 = AA(2, 6)
    W3 = AA(3, 6)
    W4 = AA(4, 6)
    W5 = AA(5, 6)
    
    
    Cells(22, 1) = "W="
    Cells(22, 2) = W1
    Cells(22, 3) = W2
    Cells(22, 4) = "*TE+"
    Cells(22, 5) = W3
    Cells(22, 6) = "*TC+"
    Cells(22, 7) = W4
    Cells(22, 8) = "*TC*TE+"
    Cells(22, 9) = W5
    Cells(22, 10) = "*TE^2"
    
    
BX:
    
    For I = 1 To NC
    Cells(26, I + 2) = TC(I)
    Cells(26, I + 7) = TC(I)
    Cells(26, I + 12) = TC(I)
    Cells(104, I + 2) = TC(I)
    Cells(104, I + 5) = TC(I)
    Next I
    
    For J = 1 To NE
    Cells(J + 26, 2) = TE(J * NC)
    Cells(J + 26, 7) = TE(J * NC)
    Cells(J + 26, 12) = TE(J * NC)
    Cells(J + 104, 2) = TE(J * NC)
    Next J

    II = 0
    T = 32.2
    For I = 1 To NE
    For J = 1 To NC
    II = II + 1
    TD = TC(II)
    TEV = TE(II)
    JOTA
    ET = E1 + E2 * PH / PL + E3 * PH
    GG = ET * RPM * VC * 60 / VG / 10 ^ 6
    QS = GG * (IG - IL)
    Cells(I + 26, J + 2) = QS
    
    If YN = "N" Then GoTo ZB
    Cells(I + 26, J + 7) = W1 + W2 * TEV + W3 * TD + W4 * TEV * TD + W5 * TEV ^ 2
    Cells(I + 26, J + 12) = ET

ZB:
    Next J
    Next I
    
'  â€˜ÃŒÂÃÅ’Ã¸â€”Â¦â€šÃŒÆ’OÆ’â€°Æ’t

    For I = 1 To 15
    For J = 1 To 9
    Cells(I + 72, J) = ""
    Next J
    Next I
    
    
    NN = 0
    For I = 1 To NE
    For J = 1 To NC
    NN = NN + 1
    Cells(NN + 72, 1) = PC(NN)
    Cells(NN + 72, 2) = PE(NN)
    Cells(NN + 72, 3) = PC(NN) / PE(NN)
    ET = E1 + E2 * PC(NN) / PE(NN) + E3 * PC(NN)
    Cells(NN + 72, J + 6) = ET
    Cells(NN + 72, J + 3) = ETV(NN)
    
    Next J
    Next I
    

    
'â€™Ã¨Å iâ€”Ã¢â€œâ‚¬â€\â€”ÃÂAâ€œÃ¼â€”Ãâ€šÃŒÅ’vÅ½Z
    T = 32.2
    TD = 54.4
    TEV = -23.3
    JOTA
    IIN = IL
    EA = E1 + E2 * PH / PL + E3 * PH
    GT = EA * VC * 60 * RPM / VG / 10 ^ 6
    QT = GT * (IG - IL)
    If YN = "N" Then GoTo BY
    WT = W1 + W2 * TEV + W3 * TD + W4 * TEV * TD + W5 * TEV ^ 2
BY:
    Cells(5, 9) = QT
    Cells(6, 9) = WT
    
    
    
'Â@â€”Ã¢â€œâ‚¬â€\â€”ÃÂAâ€œÃ¼â€”Ãâ€šÃŒÅ’vÅ½Z
    II = 0
    For I = 1 To 8
    TE(I) = -34 + I * 2
    TEV = TE(I)
    JOTA
    PE(I) = PL
    
    For J = 1 To 5
    II = II + 1
    TC(J) = J * 5 + 30
    TD = TC(I)
    T = 32.2
    JOTA
    I1 = ITC
    I2 = IGL
    TD = TC(J)
    JOTA
    
    PC(J) = PH
    T = TIN
    TEV = TE(I)
    JOTA
    
    EAA(II) = E1 + E2 * PC(J) / PE(I) + E3 * PC(J)
    G(II) = EAA(II) * VC * 60 * RPM / VG / 10 ^ 6
    Q(II) = G(II) * (IG - IIN)
    QU(II) = G(II) * (I2 - ITC)
    If YN = "N" Then GoTo BZ
    W(II) = W1 + W2 * TE(I) + W3 * TC(J) + W4 * TC(J) * TE(I) + W5 * TE(I) ^ 2
BZ:
    Next J
    Next I
    
    
    For I = 1 To 5
    Cells(42, I + 2) = TC(I)
    Cells(42, I + 9) = TC(I)
    Cells(59, I + 2) = TC(I)
    Next I
    For J = 1 To 8
    Cells(42 + J, 2) = TE(J)
    Cells(42 + J, 9) = TE(J)
    Cells(59 + J, 2) = TE(J)
    Next J
    
    II = 0
    For I = 1 To 8
    For J = 1 To 5
    II = II + 1
    Cells(42 + I, J + 2) = Q(II)
    If YN = "N" Then GoTo ZZ
    Cells(42 + I, J + 9) = W(II)
ZZ:
    Cells(59 + I, J + 2) = QU(II)
    Next J
    Next I
    
End Sub

Sub MATX()
    
    For K = 1 To N
    AK = AA(K, K)
    For J = 1 To N + 1
    AA(K, J) = AA(K, J) / AK
    Next J
    For I = 1 To N
    AIK = AA(I, K)
    For J = 1 To N + 1
    If I = K Then GoTo DD
    AA(I, J) = AA(I, J) - AIK * AA(K, J)
    Next J
DD:
    Next I
    Next K
                                        
'    For I = 1 To N
'    For J = 1 To N + 1
'    Cells(37 + I, 3 + J) = AA(I, J)
'    Next J
'    Next I
End Sub
                      
Sub JOTA()

    TA0 = T + 273.16
    TAC = TD + 273.16
    TAE = TEV + 273.16
    
    If REI = 1 Then GoTo RX
    If REI = 2 Then GoTo RY
    
    Stop
    
RX:
' R-134a â€”Ã¢â€}â€œÃÂÂ«Å½Â®
    Cells(3, 11) = "R-134a"
    
    PH = Exp(104.918 - 5301.3 / TAC - 16.2481 * Log(TAC) + 0.0246593 * TAC)
    PL = Exp(104.918 - 5301.3 / TAE - 16.2481 * Log(TAE) + 0.0246593 * TAE)
    IL = 100.019 + 0.31763 * T + 0.00033057 * T ^ 2 + 0.0000035281 * T ^ 3
    ITC = 100.019 + 0.31763 * (TD - 10) + 0.00033057 * (TD - 10) ^ 2 + 0.0000035281 * (TD - 10) ^ 3
    IG = 119.36 + 0.023174 * TA0 + 0.00031297 * TA0 ^ 2 - 138.07 * PL / TA0
    IGL = 119.36 + 0.023174 * TAE + 0.00031297 * TAE ^ 2 - 138.07 * PL / TAE
    VG = 0.01077 + 0.0008278 * TA0 / PL - 4.511 / TA0 - 0.000118 * PL
    GoTo JX

RY:
' R-600a â€”Ã¢â€}â€œÃÂÂ«
    Cells(3, 11) = "R-600a"
    
    PH = Exp(68.322 - 4401 / TAC - 9.8436 * Log(TAC) + 0.0127711 * TAC)
    PL = Exp(68.322 - 4401 / TAE - 9.8436 * Log(TAE) + 0.0127711 * TAE)
    IL = 75.545 + 0.55731 * T + 0.0007088 * T ^ 2 + 0.0000029408 * T ^ 3
    ITC = 75.545 + 0.55731 * (TD - 10) + 0.0007088 * (TD - 10) ^ 2 + 0.0000029408 * (TD - 10) ^ 3
    IG = 104.5 + 0.049951 * TA0 + 0.00058822 * TA0 ^ 2 - 249.18 * PL / TA0
    IGL = 104.5 + 0.049951 * TAE + 0.00058822 * TAE ^ 2 - 249.18 * PL / TAE
    VG = 0.015883 + 0.001455 * TA0 / PL - 7.2936 / TA0 - 0.0004645 * PL
    
JX:

End Sub
    





---
## css_style.md

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

*Converted from `style.css` on 2026-05-27 14:13:10*


---
## FOLDER_STRUCTURE.md

# Source Folder Structure

**Source path:** `D:\refrigerator-volume-calculator\src`

**Generated:** 2026-05-27 14:13:10

**Total files found:** 24


## File Type Breakdown

- **JavaScript (.js):** 22 files
- **CSS (.css):** 1 files
- **HTML (.html):** 1 files
- **Total:** 24 files


## Directory Structure

```

â”œâ”€â”€ css/
â””â”€â”€ js/
    â”œâ”€â”€ engine/
    â”‚   â””â”€â”€ thermo/
    â”œâ”€â”€ io/
    â””â”€â”€ ui/

### Files by Location


#### Root Directory

- ðŸŒ [index.html](index.md)

#### `css/`

- ðŸŽ¨ [style.css](css_style.md)

#### `js/`

- ðŸ“œ [main.js](js_main.md)
- ðŸ“œ [settings.js](js_settings.md)

#### `js\engine/`

- ðŸ“œ [calc.js](js_engine_calc.md)
- ðŸ“œ [geometry.js](js_engine_geometry.md)
- ðŸ“œ [index.js](js_engine_index.md)
- ðŸ“œ [traversal.js](js_engine_traversal.md)
- ðŸ“œ [types.js](js_engine_types.md)
- ðŸ“œ [validationPass1.js](js_engine_validationPass1.md)

#### `js\engine\thermo/`

- ðŸ“œ [compressor.js](js_engine_thermo_compressor.md)
- ðŸ“œ [compressorMap.js](js_engine_thermo_compressorMap.md)
- ðŸ“œ [condenser.js](js_engine_thermo_condenser.md)
- ðŸ“œ [constants.js](js_engine_thermo_constants.md)
- ðŸ“œ [defaultComponents.js](js_engine_thermo_defaultComponents.md)
- ðŸ“œ [evaporator.js](js_engine_thermo_evaporator.md)
- ðŸ“œ [heatLoad.js](js_engine_thermo_heatLoad.md)
- ðŸ“œ [index.js](js_engine_thermo_index.md)
- ðŸ“œ [refrigerant.js](js_engine_thermo_refrigerant.md)
- ðŸ“œ [solver.js](js_engine_thermo_solver.md)

#### `js\io/`

- ðŸ“œ [io.js](js_io_io.md)

#### `js\ui/`

- ðŸ“œ [schematic.js](js_ui_schematic.md)
- ðŸ“œ [settingsModal.js](js_ui_settingsModal.md)
- ðŸ“œ [thermoUI.js](js_ui_thermoUI.md)

```


## File Mapping

| Original File | Converted to | Type | Size |

|--------------|--------------|------|------|

| ðŸŽ¨ `css\style.css` | [css_style.md](css_style.md) | CSS | 3,937 bytes |

| ðŸŒ `index.html` | [index.md](index.md) | HTML | 6,977 bytes |

| ðŸ“œ `js\engine\calc.js` | [js_engine_calc.md](js_engine_calc.md) | JS | 7,391 bytes |

| ðŸ“œ `js\engine\geometry.js` | [js_engine_geometry.md](js_engine_geometry.md) | JS | 4,196 bytes |

| ðŸ“œ `js\engine\index.js` | [js_engine_index.md](js_engine_index.md) | JS | 6,473 bytes |

| ðŸ“œ `js\engine\thermo\compressor.js` | [js_engine_thermo_compressor.md](js_engine_thermo_compressor.md) | JS | 2,638 bytes |

| ðŸ“œ `js\engine\thermo\compressorMap.js` | [js_engine_thermo_compressorMap.md](js_engine_thermo_compressorMap.md) | JS | 4,500 bytes |

| ðŸ“œ `js\engine\thermo\condenser.js` | [js_engine_thermo_condenser.md](js_engine_thermo_condenser.md) | JS | 1,885 bytes |

| ðŸ“œ `js\engine\thermo\constants.js` | [js_engine_thermo_constants.md](js_engine_thermo_constants.md) | JS | 1,720 bytes |

| ðŸ“œ `js\engine\thermo\defaultComponents.js` | [js_engine_thermo_defaultComponents.md](js_engine_thermo_defaultComponents.md) | JS | 2,538 bytes |

| ðŸ“œ `js\engine\thermo\evaporator.js` | [js_engine_thermo_evaporator.md](js_engine_thermo_evaporator.md) | JS | 1,890 bytes |

| ðŸ“œ `js\engine\thermo\heatLoad.js` | [js_engine_thermo_heatLoad.md](js_engine_thermo_heatLoad.md) | JS | 10,377 bytes |

| ðŸ“œ `js\engine\thermo\index.js` | [js_engine_thermo_index.md](js_engine_thermo_index.md) | JS | 7,152 bytes |

| ðŸ“œ `js\engine\thermo\refrigerant.js` | [js_engine_thermo_refrigerant.md](js_engine_thermo_refrigerant.md) | JS | 5,080 bytes |

| ðŸ“œ `js\engine\thermo\solver.js` | [js_engine_thermo_solver.md](js_engine_thermo_solver.md) | JS | 8,643 bytes |

| ðŸ“œ `js\engine\traversal.js` | [js_engine_traversal.md](js_engine_traversal.md) | JS | 10,908 bytes |

| ðŸ“œ `js\engine\types.js` | [js_engine_types.md](js_engine_types.md) | JS | 4,486 bytes |

| ðŸ“œ `js\engine\validationPass1.js` | [js_engine_validationPass1.md](js_engine_validationPass1.md) | JS | 8,937 bytes |

| ðŸ“œ `js\io\io.js` | [js_io_io.md](js_io_io.md) | JS | 5,747 bytes |

| ðŸ“œ `js\main.js` | [js_main.md](js_main.md) | JS | 31,891 bytes |

| ðŸ“œ `js\settings.js` | [js_settings.md](js_settings.md) | JS | 1,371 bytes |

| ðŸ“œ `js\ui\schematic.js` | [js_ui_schematic.md](js_ui_schematic.md) | JS | 17,532 bytes |

| ðŸ“œ `js\ui\settingsModal.js` | [js_ui_settingsModal.md](js_ui_settingsModal.md) | JS | 5,434 bytes |

| ðŸ“œ `js\ui\thermoUI.js` | [js_ui_thermoUI.md](js_ui_thermoUI.md) | JS | 5,506 bytes |


---
## index.md

# index.html

**Original file:** `index.html`

**File type:** .HTML

**Size:** 6,977 bytes

**Last modified:** 2026-05-16 00:26:10


---

## Content

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refrigerator Net Storage Volume Calculator</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="page">
    <!-- LEFT PANEL: Calculator -->
    <div class="left-panel">
      <h1>Refrigerator Volume &amp; Thermal Design</h1>
      <p>Gross &amp; Usable Volume â€“ Concept Design Tool</p>
      <div class="sticky-buttons">
        <button id="settingsBtn">âš™ï¸ Settings</button>
        <button id="calculateBtn">Calculate</button>
        <button id="saveBtn">Save Configuration (JSON)</button>
        <button id="loadBtn">Load Configuration (JSON)</button>
        <button id="exportBtn">Export Results (CSV)</button>
        <button id="resetAllBtn">ðŸ”„ Reset All</button>
        <button id="storeSlotABtn" style="display:none;">Store in Slot A</button>
        <button id="storeSlotBBtn" style="display:none;">Store in Slot B</button>
        <button id="compareSlotsBtn" style="display:none;">Compare Slots</button>
      </div>

      <!-- CABINET GEOMETRY -->
      <fieldset>
        <legend>Cabinet Geometry</legend>
        <label>Height H (mm): <input type="number" id="geom-H" step="any"></label>
        <label>Width W (mm): <input type="number" id="geom-W" step="any"></label>
        <label>Depth D (mm): <input type="number" id="geom-D" step="any"></label><br>

        <label>Bottom step Hb (mm): <input type="number" id="geom-Hb" step="any"></label>
        <label>Db1 (mm): <input type="number" id="geom-Db1" step="any"></label>
        <label>Db2 (mm): <input type="number" id="geom-Db2" step="any"></label><br>

        <label>Packing pos (mm): <input type="number" id="geom-packingPos" step="any"></label>
        <label>Door gap (mm): <input type="number" id="geom-doorGap" step="any"></label><br>

        <fieldset>
          <legend>Bottom Insulation (stepped floor)</legend>
          <label>t.Bottom1 (mm): <input type="number" id="geom-bottom1" step="any"></label>
          <label>t.Bottom2 (mm): <input type="number" id="geom-bottom2" step="any"></label>
          <label>t.Bottom3 (mm): <input type="number" id="geom-bottom3" step="any"></label>
        </fieldset>
      </fieldset>

      <!-- COMPARTMENTS -->
      <fieldset>
        <legend>Compartments</legend>
        <label>Number of compartments (1â€“2):
          <input type="number" id="numCompartments" min="1" max="2" value="2" required>
        </label>
        <label id="dividerLabel">Partition Divider Thickness (mm):
          <input type="number" id="divHoriz" value="20" step="any">
        </label>
        <div id="compartmentBuilder"></div>
      </fieldset>

      <!-- USABLE FACTOR -->
      <fieldset>
        <legend>Usable Volume Factor</legend>
        <label>Usable volume factor (%): <input type="number" id="usableFactor" value="97" step="any" min="0" max="100"></label>
      </fieldset>

      <!-- RESULTS -->
      <fieldset>
        <legend>Calculated Volumes</legend>
        <div id="results">
          <p>Gross Volume: <span id="grossVol">--</span> L (<span id="grossVolCuft">--</span> cu. ft.)</p>
          <p>Usable Volume: <span id="usableVol">--</span> L (<span id="usableVolCuft">--</span> cu. ft.)</p>
        </div>
      </fieldset>

      <fieldset id="messagesFieldset" style="display:none;">
        <legend>Messages</legend>
        <div id="messages"></div>
      </fieldset>

      <!-- THERMODYNAMIC ANALYSIS -->
      <details id="thermoSection" style="margin-top:15px;">
        <summary style="cursor:pointer; font-weight:bold; padding:5px;">Thermodynamic Analysis</summary>
        <button id="thermoRunBtn" style="margin:10px 0;">Run Thermal Analysis</button>
        <div id="thermoResults"></div>
        <div id="thermoErrors"></div>
        <fieldset>
          <legend>Temperature Setting</legend>
          <label>Outside T0 (Â°C): <input type="number" id="thermoT0" value="30" step="any"></label>
          <label>Freezer TF (Â°C): <input type="number" id="thermoTF" value="-18" step="any"></label>
          <label>Refrigerator TR (Â°C): <input type="number" id="thermoTR" value="3" step="any"></label>
        </fieldset>
        <fieldset>
          <legend>Refrigerant</legend>
          <select id="thermoRefrigerant">
            <option value="R-600a">R-600a</option>
            <option value="R-134a">R-134a</option>
          </select>
        </fieldset>
        <fieldset>
          <legend>Fan</legend>
          <label>Total airflow (mÂ³/h): <input type="number" id="thermoFanFlow" step="any"></label>
        </fieldset>
        <details id="thermoAdvanced">
          <summary>Advanced Parameters</summary>
          <fieldset>
            <legend>Compressor</legend>
            <p>EGX80CLC 100V 50Hz (fixed)</p>
          </fieldset>
          <fieldset>
            <legend>Subcool &amp; Discharge</legend>
            <label>Subcool (K): <input type="number" id="thermoSubcool" step="any"></label>
            <label>Discharge temp (Â°C): <input type="number" id="thermoDiscTemp" step="any"></label>
          </fieldset>
          <fieldset>
            <legend>Defrost</legend>
            <label>Heater (W): <input type="number" id="thermoDefHeater" step="any"></label>
            <label>On time (min/24h): <input type="number" id="thermoDefOn" step="any"></label>
          </fieldset>
        </details>
      </details>
    </div>

    <!-- SPLITTER -->
    <div class="splitter" id="splitter"></div>

    <!-- RIGHT PANEL: Schematics -->
    <div class="right-panel">
      <canvas id="schematicFront"></canvas>
      <canvas id="schematicSide"></canvas>
      <div id="schematicOverlay" class="schematic-overlay hidden">Schematic not updated â€“ click Calculate</div>
      <div id="schematicTooltip" class="schematic-tooltip hidden"></div>
    </div>
  </div>

  <!-- Settings Modal -->
  <div id="settingsModal" class="modal hidden">
    <div class="modal-content">
      <span class="close-btn" id="closeSettings">&times;</span>
      <h2>Settings</h2>
      <div id="settingsForm"></div>
      <div class="settings-actions">
        <button id="settingsSave">Save &amp; Close</button>
        <button id="settingsExport">Export Settings</button>
        <button id="settingsImport">Import Settings</button>
        <button id="settingsReset">Reset Defaults</button>
      </div>
    </div>
  </div>

  <!-- Comparison Modal -->
  <div id="comparisonModal" class="modal hidden">
    <div class="modal-content">
      <span class="close-btn" id="closeComparison">&times;</span>
      <h2>Sideâ€‘byâ€‘Side Comparison</h2>
      <div id="comparisonContent"></div>
    </div>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```


---

*Converted from `index.html` on 2026-05-27 14:13:10*


---
## js_engine_calc.md

# calc.js

**Original file:** `calc.js`

**File type:** .JS

**Size:** 7,391 bytes

**Last modified:** 2026-05-15 20:55:44


---

## Content

```javascript
import { settings } from '../settings.js';

/**
 * Derives internal root space using perâ€‘type wall thicknesses and the layout tree.
 * @param {object} cabinet - { external, wallThicknessesByType, airGap }
 * @param {object} layout - the root node tree
 * @returns {import('./types').Space}
 */
export function deriveRootSpace(cabinet, layout) {
  const { external, wallThicknessesByType, airGap } = cabinet;
  
  // Helper: find all leaf types touching a given side
  const boundaryTypes = {
    top: new Set(),
    bottom: new Set(),
    left: new Set(),
    right: new Set(),
  };
  
  // Walk the tree to collect which types appear at the extremes
  walkBoundaries(layout, boundaryTypes, true, true, true, true);
  
  const allTypes = ['fresh','freezer','flex']; // all possible types
  // Effective thickness for a face = max thickness among types touching that face
  const effective = {};
  for (const face of ['top','bottom','left','right']) {
    const typesForFace = boundaryTypes[face];
    let maxVal = 0;
    for (const type of typesForFace) {
      const val = wallThicknessesByType[type]?.[face] ?? 0;
      if (val > maxVal) maxVal = val;
    }
    // If no type touches the face (shouldn't happen), fallback to max over all types
    if (typesForFace.size === 0) {
      for (const type of allTypes) {
        const val = wallThicknessesByType[type]?.[face] ?? 0;
        if (val > maxVal) maxVal = val;
      }
    }
    effective[face] = maxVal;
  }
  
  // Rear and door: max over all types
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));
  
  return {
    width:  external.width  - effective.left - effective.right,
    height: external.height - effective.top  - effective.bottom,
    depth:  external.depth  - effective.rear - effective.door,
  };
}

// Recursive function to collect types that touch the boundaries
export function walkBoundaries(node, boundary, topMost, bottomMost, leftMost, rightMost) {
  if (node.nodeType === 'leaf') {
    if (topMost) boundary.top.add(node.type);
    if (bottomMost) boundary.bottom.add(node.type);
    if (leftMost) boundary.left.add(node.type);
    if (rightMost) boundary.right.add(node.type);
  } else if (node.nodeType === 'horizontal') {
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const isFirst = (i === 0);
      const isLast = (i === children.length - 1);
      walkBoundaries(
        children[i].node,
        boundary,
        topMost && isFirst,
        bottomMost && isLast,
        leftMost,
        rightMost
      );
    }
  } else if (node.nodeType === 'vertical') {
    // left child touches left, right child touches right
    walkBoundaries(node.left,  boundary, topMost, bottomMost, true, false);
    walkBoundaries(node.right, boundary, topMost, bottomMost, false, true);
  }
}

// Volume of a shelf slab in L
export function shelfVol(shelf, availableWidth) {
  const w = shelf.width ?? availableWidth;
  return w * shelf.depth * shelf.thickness * settings.mm3ToL;
}

// Structure volume of a drawer (plastic) in L
export function drawerStructVol(drawer) {
  const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;
  const outerVol = oW * oD * oH;
  const innerW = oW - 2 * t;
  const innerD = oD - 2 * t;
  const innerH = oH - t;
  const innerVol = innerW * innerD * innerH;
  return (outerVol - innerVol) * settings.mm3ToL;
}

// Structure volume of a door bin (plastic) in L
export function binStructVol(bin) {
  const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;
  const outerVol = oW * oH * oD;
  const innerW = oW - 2 * t;
  const innerH = oH - 2 * t;
  const innerD = oD - t;
  const innerVol = innerW * innerH * innerD;
  return (outerVol - innerVol) * settings.mm3ToL;
}

/**
 * Calculates gross, EG_Net, and IEC_Net for a single leaf node.
 * EG_Net = Gross âˆ’ Î£(userâ€‘removable accessories)
 * IEC_Net = Gross Ã— iecFactor âˆ’ Î£(all fitting volumes)
 */
export function calcLeaf(leaf, space, excludedFittingIds = new Set()) {
  const { width, height, depth } = space;
  const fittings = leaf.fittings;
  const gross = width * depth * height * settings.mm3ToL;

  let userRemoveDeductions = 0;
  let allFittingDeductions = 0;

  for (const shelf of fittings.shelves) {
    if (excludedFittingIds.has(shelf.id)) continue;
    const vol = shelfVol(shelf, width);
    userRemoveDeductions += vol;
    allFittingDeductions += vol;
  }

  for (const drawer of fittings.drawers) {
    if (excludedFittingIds.has(drawer.id)) continue;
    const vol = drawerStructVol(drawer);
    userRemoveDeductions += vol;
    allFittingDeductions += vol;
  }

  for (const bin of fittings.doorBins) {
    if (excludedFittingIds.has(bin.id)) continue;
    const vol = binStructVol(bin);
    userRemoveDeductions += vol;
    allFittingDeductions += vol;
  }

  // Ice maker / light housing
  if (fittings.iceMakerHousing?.volume != null) {
    allFittingDeductions += fittings.iceMakerHousing.volume;
    if (settings.iceMakerRemovable) userRemoveDeductions += fittings.iceMakerHousing.volume;
  }
  if (fittings.lightHousing?.volume != null) {
    allFittingDeductions += fittings.lightHousing.volume;
    if (settings.lightRemovable) userRemoveDeductions += fittings.lightHousing.volume;
  }

  const egNet = gross - userRemoveDeductions;
  const iecNet = gross * settings.iecFactor - allFittingDeductions;

  return {
    leafId:           leaf.id,
    leafType:         leaf.type,
    space,
    gross,
    egNet,
    iecNet,
    fittings:         leaf.fittings,
    fittingErrors:    [...excludedFittingIds],
  };
}

// Aggregation and conversion
export function aggregateTotals(leaves) {
  let gross = 0, egNet = 0, iecNet = 0;
  for (const leaf of leaves) {
    gross  += leaf.gross;
    egNet  += leaf.egNet;
    iecNet += leaf.iecNet;
  }
  return { gross, egNet, iecNet };
}

export function toCuft(litres) {
  return litres * settings.lToCuft;
}

export function roundForDisplay(val, unit) {
  return unit === 'cuft'
    ? Math.round(val * Math.pow(10, settings.displayPrecisionCuft)) / Math.pow(10, settings.displayPrecisionCuft)
    : Math.round(val * Math.pow(10, settings.displayPrecisionL)) / Math.pow(10, settings.displayPrecisionL);
}

export function formatLeafDisplay(leaf) {
  return {
    gross:      roundForDisplay(leaf.gross,  'L'),
    egNet:      roundForDisplay(leaf.egNet,  'L'),
    iecNet:     roundForDisplay(leaf.iecNet, 'L'),
    grossCuft:  roundForDisplay(toCuft(leaf.gross),  'cuft'),
    egNetCuft:  roundForDisplay(toCuft(leaf.egNet),  'cuft'),
    iecNetCuft: roundForDisplay(toCuft(leaf.iecNet), 'cuft'),
  };
}

export function formatTotalsDisplay(totals) {
  return {
    gross:      roundForDisplay(totals.gross,  'L'),
    egNet:      roundForDisplay(totals.egNet,  'L'),
    iecNet:     roundForDisplay(totals.iecNet, 'L'),
    grossCuft:  roundForDisplay(toCuft(totals.gross),  'cuft'),
    egNetCuft:  roundForDisplay(toCuft(totals.egNet),  'cuft'),
    iecNetCuft: roundForDisplay(toCuft(totals.iecNet), 'cuft'),
  };
}
```


---

*Converted from `calc.js` on 2026-05-27 14:13:09*


---
## js_engine_geometry.md

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

  // Air gap (mm) â€“ no longer used in calculations
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

*Converted from `geometry.js` on 2026-05-27 14:13:09*


---
## js_engine_index.md

# index.js

**Original file:** `index.js`

**File type:** .JS

**Size:** 6,473 bytes

**Last modified:** 2026-05-15 20:55:40


---

## Content

```javascript
/**
 * @file index.js
 * Main engine entry point.
 * Orchestrates Pass 1 â†’ cabinet-level pre-checks â†’ Pass 2 â†’ post-calc hierarchy check.
 *
 * Public API:
 *   runCalculation(config) â†’ CalcResult
 */

import { deriveRootSpace, aggregateTotals, walkBoundaries } from './calc.js';
import { validateStructure }                                from './validationPass1.js';
import { traverseAndCompute }                               from './traversal.js';
import { upgradeConfig, toVolumeFormat } from './geometry.js';

// ---------------------------------------------------------------------------
// Cabinet-level pre-checks (run before Pass 2 tree traversal)
// ---------------------------------------------------------------------------

/**
 * Validates cabinet external dims, wall thicknesses, and derived internal space.
 * These are not tree-node checks â€” they guard the root space derivation.
 *
 * @param {import('./types').CabinetConfig['cabinet']} cabinet
 * @returns {import('./types').ValidationError[]}
 */
function validateCabinet(cabinet) {
  const errors = [];
  const { external, wallThicknessesByType, layout, airGap } = cabinet;

  // Positive external dimensions
  for (const [key, val] of Object.entries(external)) {
    if (val <= 0) {
      errors.push({ rule: 'positiveValues', message: `external.${key} must be > 0, got ${val}` });
    }
  }

  // Compute effective wall thicknesses (same logic as deriveRootSpace)
  const boundaryTypes = { top: new Set(), bottom: new Set(), left: new Set(), right: new Set() };
  walkBoundaries(layout, boundaryTypes, true, true, true, true);
  const effective = {};
  const allTypes = ['fresh','freezer','flex'];
  for (const face of ['top','bottom','left','right']) {
    let max = 0;
    for (const t of boundaryTypes[face]) {
      const val = wallThicknessesByType[t]?.[face] ?? 0;
      if (val > max) max = val;
    }
    if (boundaryTypes[face].size === 0) {
      for (const t of allTypes) max = Math.max(max, wallThicknessesByType[t]?.[face] ?? 0);
    }
    effective[face] = max;
  }
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));

  // Wall ratio checks using effective thicknesses
  const pairs = [
    ['top',    external.height, 'height'],
    ['bottom', external.height, 'height'],
    ['left',   external.width,  'width'],
    ['right',  external.width,  'width'],
    ['rear',   external.depth,  'depth'],
    ['door',   external.depth,  'depth'],
  ];
  for (const [face, extDim, dimName] of pairs) {
    const thickness = effective[face];
    if (thickness >= extDim * 0.5) {
      errors.push({
        rule:    'wallRatio',
        message: `${face} wall (${thickness} mm) exceeds 50% of external ${dimName} (${extDim * 0.5} mm)`,
      });
    }
  }


  // Internal dimensions positive
  if (errors.length === 0) {
    const rootSpace = deriveRootSpace({ external, wallThicknessesByType, airGap }, layout);
    for (const [dim, val] of Object.entries(rootSpace)) {
      if (val <= 0) {
        errors.push({
          rule:    'internalPositive',
          message: `Derived internal ${dim} (${val} mm) is â‰¤ 0 after wall subtraction`,
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Post-calc hierarchy check
// ---------------------------------------------------------------------------

/**
 * Asserts Gross â‰¥ EG_Net â‰¥ IEC_Net per leaf and on totals.
 * Returns CalcError[]. Non-empty means a formula regression â€” should never
 * fire under correct formulas.
 *
 * @param {import('./types').LeafResult[]} leaves
 * @param {import('./types').Totals}       totals
 * @returns {import('./types').CalcError[]}
 */
function checkHierarchy(leaves, totals) {
  const errors = [];

  for (const leaf of leaves) {
    if (leaf.gross < leaf.egNet - 1e-9) {
      errors.push({ rule: 'hierarchyCheck_leaf',
        message: `Gross (${leaf.gross}) < EG_Net (${leaf.egNet}) on leaf ${leaf.leafId}` });
    }
    if (leaf.egNet < leaf.iecNet - 1e-9) {
      errors.push({ rule: 'hierarchyCheck_leaf',
        message: `EG_Net (${leaf.egNet}) < IEC_Net (${leaf.iecNet}) on leaf ${leaf.leafId}` });
    }
  }

  if (totals.gross < totals.egNet - 1e-9) {
    errors.push({ rule: 'hierarchyCheck_total',
      message: `Total Gross (${totals.gross}) < Total EG_Net (${totals.egNet})` });
  }
  if (totals.egNet < totals.iecNet - 1e-9) {
    errors.push({ rule: 'hierarchyCheck_total',
      message: `Total EG_Net (${totals.egNet}) < Total IEC_Net (${totals.iecNet})` });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs the full calculation pipeline on a cabinet configuration.
 *
 * @param {import('./types').CabinetConfig} config
 * @returns {import('./types').CalcResult}
 */
export function runCalculation(config) {
  const result = { leaves:null, totals:null, validationErrors:[], calcErrors:[], warnings:[] };

  // Pass 1 â€” structural
  const structErrors = validateStructure(config.cabinet.layout);
  if (structErrors.length) { result.validationErrors = structErrors; return result; }

  // Backward compatibility
  if (config.schemaVersion === '1.0' || (!config.cabinet.geometry && config.cabinet.external)) {
    config = upgradeConfig(config);
  }

  const { geometry, layout } = config.cabinet;

  // Derive volume format and validate cabinet dimensions
  const volumeGeom = toVolumeFormat(geometry);
  const cabinetErrors = validateCabinet({ ...volumeGeom, layout });
  if (cabinetErrors.length) { result.validationErrors = cabinetErrors; return result; }

  const rootSpace = deriveRootSpace(volumeGeom, layout);

  // Pass 2
  const { leaves, errors: dimErrors, warnings } = traverseAndCompute(layout, rootSpace);
  result.validationErrors = dimErrors;
  result.warnings = warnings;
  result.leaves = leaves;

  if (leaves.length > 0) {
    const totals = aggregateTotals(leaves);
    result.totals = totals;
    result.calcErrors = checkHierarchy(leaves, totals);
  }

  return result;
}

export { deriveRootSpace, aggregateTotals } from './calc.js';
export { validateStructure }               from './validationPass1.js';
export { traverseAndCompute }              from './traversal.js';
```


---

*Converted from `index.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_compressor.md

# compressor.js

**Original file:** `compressor.js`

**File type:** .JS

**Size:** 2,638 bytes

**Last modified:** 2026-05-26 12:30:05


---

## Content

```javascript
// compressor.js â€“ cooling capacity based on evaporator outlet enthalpy (Excel replica)
import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorStateMap, SQ47LAEG_MAP } from './compressorMap.js';

export function calcVolumetricEfficiency(TC, TE, compParams, satPressure) {
  const Pc = satPressure(TC);
  const Pe = satPressure(TE);
  const { A, B, C } = compParams.volEffCoeffs;
  const etaBase = A + B * (Pc / Pe) + C * Pc;
  const kEtaV = compParams.kEtaV;
  const Kw = kEtaV.a + kEtaV.b * compParams.rpm + kEtaV.c * compParams.rpm * compParams.rpm;
  return etaBase * Kw;
}

export function calcMassFlow(etaV, rpm, Vc, v) {
  return etaV * rpm * Vc * 1e-6 * 60 / v;
}

/**
 * Compressor state â€“ uses EVAPORATOR OUTLET enthalpy (saturated vapour at TE)
 * to calculate cooling capacity, matching Excel MAIN H21.
 */
export function compressorState(TC, TE, refrigerantName, compParams, subcool, T0) {
  const rf = getRefrigerantFunctions(refrigerantName);
  const Pe = rf.satPressure(TE);
  const Pc = rf.satPressure(TC);

  // Excel uses T0 (ambient) for specific volume in the refrigerator condition
  const T_vol = T0 ?? compParams.T_suction;   // fall back to 32.2 if T0 not passed
  const v = rf.specificVolume(T_vol, Pe);
  const etaV = calcVolumetricEfficiency(TC, TE, compParams, rf.satPressure);
  const mdot = calcMassFlow(etaV, compParams.rpm, compParams.Vc, v);

  // Use evaporator outlet (saturated vapour) enthalpy, not suction line
  const h_evap_out = rf.vaporEnthalpy(TE, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);
  const cooling = mdot * (h_evap_out - h_liquid);

  // Input power (existing polynomial)
  const { AW, BW, CW, DW, EW } = compParams.powerCoeffs;
  const base = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;
  const { a, b, c } = compParams.powerKw;
  const Kw = a + b * compParams.rpm + c * compParams.rpm * compParams.rpm;
  const rpmRatio = compParams.rpm / compParams.rpm0;
  const power = base * Kw * rpmRatio;

  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: cooling,
    inputPower: power,
    h_evap_out,
    h_liquid,
  };
}
// compressor.js or solver.js dispatch
export function resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0) {
  if (compParams.useMap) {
    const rf = getRefrigerantFunctions(refrigerant);
    const map = compParams.map ?? SQ47LAEG_MAP;  // allow custom map per model
    return compressorStateMap(TC, TE, map, rf, subcool);
  }
  return compressorState(TC, TE, refrigerant, compParams, subcool, T0);
}

```


---

*Converted from `compressor.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_compressorMap.md

# compressorMap.js

**Original file:** `compressorMap.js`

**File type:** .JS

**Size:** 4,500 bytes

**Last modified:** 2026-05-24 17:03:39


---

## Content

```javascript
// compressorMap.js â€“ bilinear interpolation on compressor performance maps
// Supports both cooling capacity (kcal/h) and input power (W).

/**
 * Bilinear interpolation on a regular grid.
 * @param {number} x  - variable 1 (e.g., TC)
 * @param {number} y  - variable 2 (e.g., TE)
 * @param {number[]} xGrid - ascending array of x values
 * @param {number[]} yGrid - ascending array of y values
 * @param {number[][]} zTable - 2D array, rows = yGrid, cols = xGrid
 * @returns {number} interpolated z value
 */
function bilinear(x, y, xGrid, yGrid, zTable) {
  // Clamp to the grid bounds
  const xc = Math.max(xGrid[0], Math.min(xGrid[xGrid.length - 1], x));
  const yc = Math.max(yGrid[0], Math.min(yGrid[yGrid.length - 1], y));

  // Find bracketing indices
  let i = 0;
  while (i < xGrid.length - 1 && xGrid[i + 1] < xc) i++;
  let j = 0;
  while (j < yGrid.length - 1 && yGrid[j + 1] < yc) j++;

  // Normalised coordinates (0..1)
  const tx = (xc - xGrid[i]) / (xGrid[i + 1] - xGrid[i]);
  const ty = (yc - yGrid[j]) / (yGrid[j + 1] - yGrid[j]);

  const z11 = zTable[j][i];
  const z12 = zTable[j][i + 1];
  const z21 = zTable[j + 1][i];
  const z22 = zTable[j + 1][i + 1];

  return (1 - ty) * ((1 - tx) * z11 + tx * z12) +
         ty * ((1 - tx) * z21 + tx * z22);
}

// --------------------------------------------------------------------------
// SQ47LAEG 220V 50Hz  (Râ€‘600a)  â€“  from Excel DATA sheet
// TC grid: 35, 40, 45, 50, 55 Â°C
// TE grid: â€“32, â€“30, â€“28, â€“26, â€“24, â€“22, â€“20, â€“18 Â°C
// --------------------------------------------------------------------------
const SQ47LAEG_TC = [35, 40, 45, 50, 55];
const SQ47LAEG_TE = [-32, -30, -28, -26, -24, -22, -20, -18];

const SQ47LAEG_Q = [
  // TE = -32, -30, -28, -26, -24, -22, -20, -18  (kcal/h)
  [82.75, 92.40, 102.81, 114.01, 126.05, 138.98, 152.83, 167.66],  // TC=35
  [80.54, 90.17, 100.56, 111.75, 123.77, 136.67, 150.51, 165.31],  // TC=40
  [78.10, 87.72,  98.09, 109.26, 121.26, 134.14, 147.95, 162.73],  // TC=45
  [75.44, 85.04,  95.39, 106.53, 118.51, 131.36, 145.14, 159.89],  // TC=50
  [72.52, 82.10,  92.43, 103.55, 115.50, 128.33, 142.08, 156.80],  // TC=55
];

const SQ47LAEG_W = [
  // TE = -32, -30, -28, -26, -24, -22, -20, -18  (W)
  [43.40, 41.82, 40.54, 39.57, 38.89, 38.51, 38.43, 38.66],  // TC=35
  [52.98, 54.89, 57.10, 59.61, 62.42, 65.53, 68.94, 72.65],  // TC=40
  [62.56, 67.96, 73.65, 79.65, 85.95, 92.54, 99.44, 106.64], // TC=45
  [72.14, 81.03, 90.21, 99.69, 109.48, 119.56, 129.94, 140.62], // TC=50
  [81.72, 94.09, 106.76, 119.73, 133.00, 146.57, 160.44, 174.61], // TC=55
];

// --------------------------------------------------------------------------
// EGX80CLC (SJâ€‘540)  â€“  from Excel DATA sheet (volumetric + power polynomials)
// These are already handled by the existing compressor.js; we keep the
// polynomial approach for that model.
// --------------------------------------------------------------------------

/**
 * Returns compressor state using map interpolation.
 * @param {number} TC â€“ condensing temperature (Â°C)
 * @param {number} TE â€“ evaporating temperature (Â°C)
 * @param {object} mapConfig â€“ { TC_grid, TE_grid, Q_table, W_table, Vc, rpm, T_suction, refrigerantName }
 * @param {object} rf â€“ refrigerant functions
 * @param {number} subcool â€“ subcooling (K)
 */
export function compressorStateMap(TC, TE, mapConfig, rf, subcool) {
  const { TC_grid, TE_grid, Q_table, W_table, Vc, rpm, T_suction } = mapConfig;

  const cooling = bilinear(TE, TC, TE_grid, TC_grid, Q_table);
  const inputPower = bilinear(TE, TC, TE_grid, TC_grid, W_table); // W

  // Mass flow from cooling capacity (for completeness)
  const Pe = rf.satPressure(TE);
  const h_evap_out = rf.vaporEnthalpy(TE, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);
  const mdot = cooling / Math.max(0.01, h_evap_out - h_liquid);

  // Volumetric efficiency (from mass flow)
  const v_suc = rf.specificVolume(T_suction, Pe);
  const etaV = mdot / (rpm * Vc * 1e-6 * 60 / v_suc);

  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: cooling,
    inputPower,
    h_evap_out,
    h_liquid,
  };
}

// Preâ€‘built map configuration for SQ47LAEG
export const SQ47LAEG_MAP = {
  TC_grid: SQ47LAEG_TC,
  TE_grid: SQ47LAEG_TE,
  Q_table: SQ47LAEG_Q,
  W_table: SQ47LAEG_W,
  Vc: 10.17,
  rpm: 2220,
  T_suction: 32.2,
};
```


---

*Converted from `compressorMap.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_condenser.md

# condenser.js

**Original file:** `condenser.js`

**File type:** .JS

**Size:** 1,885 bytes

**Last modified:** 2026-05-27 12:18:20


---

## Content

```javascript
import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorState } from './compressor.js';

export function calcQCout(TC, T0, TF, TR, areas) {
  const dT_TC_T0 = TC - T0;
  const dT_TC_TF = TC - TF;
  const dT_TC_TR = TC - TR;   // â† add
  return (areas.k_RFront1 * dT_TC_T0 + areas.k_RFront2 * dT_TC_TR) * areas.RFrontLength
       + (areas.k_FRPartition1 * dT_TC_T0 + areas.k_FRPartition2 * dT_TC_TF) * areas.FRPartitionLength
       + (areas.k_FFront1      * dT_TC_T0 + areas.k_FFront2      * dT_TC_TR) * areas.FFrontLength  // â† fix
       + areas.sideKA * dT_TC_T0
       + areas.backKA * dT_TC_T0;
}

// FIX in condenser.js:
export function computeCondenserAreas(geom, condenserConfig, freezerPosition = 'top') {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, tRtop, tRleft, tFtop, tFleft } = geom;
  const {
    K_side_kcalhm2C: K_side,
    K_back_kcalhm2C: K_back,
    backCondenserEfficiency,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2,
  } = condenserConfig;

  const sideArea    = ((H * (D - 30)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6;
  const backAreaRaw = (W * (H - Hb)) / 1e6;
  const backArea    = backAreaRaw * backCondenserEfficiency;

  const isTop    = freezerPosition === 'top';
  const H_lower  = isTop ? Hr : Hf;
  const H_upper  = isTop ? Hf : Hr;
  const t_lower_top  = isTop ? tRtop  : tFtop;
  const t_lower_left = isTop ? tRleft : tFleft;

  const RFrontLength      = H_lower * 2 / 1000;
  const FFrontLength      = H_upper * 2 / 1000;
  const FRPartitionLength = (W - t_lower_left - t_lower_top) / 1000;

  return {
    RFrontLength, FRPartitionLength, FFrontLength,
    sideKA: K_side * sideArea,
    backKA:  K_back * backArea,
    sideArea, backArea,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2,
  };
}
```


---

*Converted from `condenser.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_constants.md

# constants.js

**Original file:** `constants.js`

**File type:** .JS

**Size:** 1,720 bytes

**Last modified:** 2026-05-08 15:10:41


---

## Content

```javascript
/**
 * @file constants.js
 * @description Truly universal constants â€“ physical properties, conversion
 *     factors, and standard heatâ€‘transfer coefficients.
 *     These do NOT depend on the refrigerator model or its components.
 */

export const PHYSICAL_CONSTANTS = Object.freeze({
  // -------------------------------------------------------------------
  // Dry air properties (at approx. -20â€¯Â°C to +60â€¯Â°C â€“ constant for modelling)
  // -------------------------------------------------------------------
  air: {
    density: 1.365,  // kg/mÂ³     (Excel: MAIN B20)
    cp: 0.24,        // kcal/kgÂ·Â°C (Excel: MAIN B21)
  },

  // -------------------------------------------------------------------
  // Insulation materials â€“ thermal conductivity (kcalâ€¯/â€¯(mÂ·hÂ·Â°C))
  // -------------------------------------------------------------------
  insulation: {
    urethane: 0.0165,   // rigid polyurethane foam (SIZE B33)
    polystyrene: 0.035, // (SIZE B34)
    packing: 0.035,     // door gasket material (SIZE B36)
  },

  // -------------------------------------------------------------------
  // Surface heatâ€‘transfer coefficients (kcalâ€¯/â€¯(mÂ²Â·hÂ·Â°C))
  // -------------------------------------------------------------------
  surfaceCoefficients: {
    outside: 6,  // ambient air to cabinet (SIZE B40)
    inside: 10,  // cabinet interior air to wall (SIZE B41)
  },

  // -------------------------------------------------------------------
  // Unit conversions
  // -------------------------------------------------------------------
  conversion: {
    wattToKcalPerH: 0.86,
    // kcal/h â†’ W : multiply by 1/0.86 â‰ˆ 1.16279
  },
});
```


---

*Converted from `constants.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_defaultComponents.md

# defaultComponents.js

**Original file:** `defaultComponents.js`

**File type:** .JS

**Size:** 2,538 bytes

**Last modified:** 2026-05-24 16:40:46


---

## Content

```javascript
export const SJ54H_COMPONENTS = Object.freeze({
  compressor: {
    name: 'EGX80CLC 100V 50Hz',
    rpm: 2900,
    rpm0: 2900,
    Vc: 11.14,          // cc
    T_suction: 32.2,    // Â°C â€“ fixed suction temperature from Excel H11
    volEffCoeffs: {
      A: 0.9260142251566365,
      B: -0.01221312333322575,
      C: -0.0023789273042382304,
    },
    kEtaV: { a: 1, b: 0, c: 0 },
    powerCoeffs: {
      AW: 135.175,
      BW: 2.6366666666666667,
      CW: 0.975,
      DW: 0.02,
      EW: 0.016666666666666666,
    },
    powerKw: { a: 1, b: 0, c: 0 },
  },

  fan: {
    diameter_mm: 100,
    speed_rpm: 2550,
    inputPower_W: 2.1,
    totalAirflow_m3h: 59.5,
  },

  electrical: {
    pwbOn_W: 2,
    pwbOff_W: 1,
    defrostHeater_W: 140,
    timerPeriod_h: 10.5,
    defrostOn_min: 0,
  },

  condenser: {
    sidePipePitch_mm: 150,
    backPipePitch_mm: 200,
    K_side_kcalhm2C: 5.395,
    K_back_kcalhm2C: 4.17,
    backCondenserEfficiency: 0.7,
    k_RFront1: 0.3405,
    k_RFront2: 0.03322,
    k_FRPartition1: 0.1984,
    k_FRPartition2: 0.1219,
    k_FFront1: 0.3395,
    k_FFront2: 0.0344,
  },

  subcool_K: 10,
  dischargeTemp_C: 60,
  // Evaporator geometry (used by dynamic TE calculation)
  evapGeom: {
    evapWidth_mm: 460,    // E26 (EV WIDTH)
    evapDepth_mm: 60,     // E27 (EV DEPTH)
    evapArea_m2: 1.754,   // E33 (SURFACE OF EVAPORATOR)
  },
  initialTE: -25.7,
});
// needs to be created in defaultComponents.js
export const SJ_PV73K_COMPONENTS = Object.freeze({
  compressor: {
    name: 'SQ47LAEG 220V 50Hz',
    rpm: 2220,
    rpm0: 2220,
    Vc: 10.17,
    T_suction: 32.2,
    // use compressorMap instead of polynomial coefficients
    useMap: true,
  },
  fan: {
    diameter_mm: 100,
    speed_rpm: 2850,
    inputPower_W: 2.4,
    totalAirflow_m3h: 146.4,
  },
  electrical: {
    pwbOn_W: 2,
    pwbOff_W: 1,
    defrostHeater_W: 112,
    timerPeriod_h: 10.5,
    defrostOn_min: 0,
  },
  condenser: {
    sidePipePitch_mm: 150,
    backPipePitch_mm: 200,
    K_side_kcalhm2C: 5.395,
    K_back_kcalhm2C: 4.17,
    backCondenserEfficiency: 0.7,
    k_RFront1: 0.3405,
    k_RFront2: 0.03322,
    k_FRPartition1: 0.1984,
    k_FRPartition2: 0.1219,
    k_FFront1: 0.3395,
    k_FFront2: 0.0344,
  },
  subcool_K: 10,
  dischargeTemp_C: 60,
  evapGeom: {
    evapWidth_mm: 440.5,
    evapDepth_mm: 58,
    evapArea_m2: 1.2985,
  },
  freezerPosition: 'bottom',
  initialTE: -22.7,
});
```


---

*Converted from `defaultComponents.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_evaporator.md

# evaporator.js

**Original file:** `evaporator.js`

**File type:** .JS

**Size:** 1,890 bytes

**Last modified:** 2026-05-17 23:25:51


---

## Content

```javascript
// evaporator.js â€“ exact Excel evaporator model
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

/**
 * Compute evaporator total surface area (mÂ²)
 * Excel SIZE B29-B33: Fin area + Tube area + Side plate area
 */
export function computeEvaporatorArea(evap) {
  const { width_mm, depth_mm, rows, tubeOD_mm, finPitch_mm, finHeight_mm, finLength_mm, numFins } = evap;
  // Fin area (both sides) â€“ Excel: (28*60 - Ï€*(4^2))*2 / 1e6 per fin
  const tubeCrossArea = Math.PI * (tubeOD_mm/2)**2;
  const finAreaPerFin = (finLength_mm * finHeight_mm - tubeCrossArea) * 2 / 1e6; // mÂ²
  const totalFinArea = finAreaPerFin * numFins;
  // Tube outer area â€“ Excel: (Ï€ * tubeOD * width) * rows * 2 / 1e6
  const tubeArea = (Math.PI * tubeOD_mm * width_mm) * rows * 2 / 1e6;
  // Side plate area (Excel B32) â€“ usually zero
  const sidePlateArea = 0;
  return totalFinArea + tubeArea + sidePlateArea;
}

/**
 * Air speed over evaporator (m/s) â€“ Excel MAIN E19
 * v = fanAirflow_m3h / (width_m * depth_m) / 3600
 */
export function airSpeed(fanAirflow_m3h, evap) {
  const frontArea_m2 = (evap.width_mm * evap.depth_mm) / 1e6;
  return fanAirflow_m3h / frontArea_m2 / 3600;
}

/**
 * Evaporator heat transfer coefficient (kcal/hÂ·mÂ²Â·Â°C) â€“ Excel MAIN E21
 * Î± = 12.93 * v^0.415
 */
export function evaporatorAlpha(v_ms) {
  return 12.93 * Math.pow(v_ms, 0.415);
}

/**
 * Log mean temperature difference â€“ Excel MAIN E20
 * LMTD = (T1 - T2) / ln((T1 - TE) / (T2 - TE))
 */
export function lmtd(T1, T2, TE) {
  const dT1 = T1 - TE;
  const dT2 = T2 - TE;
  if (Math.abs(dT1 - dT2) < 1e-6) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

/**
 * Evaporator capacity (kcal/h) â€“ Excel MAIN E23
 * Qevap = Î± * area * LMTD
 */
export function evaporatorCapacity(alpha, area, LMTD) {
  return alpha * area * LMTD;
}
```


---

*Converted from `evaporator.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_heatLoad.md

# heatLoad.js

**Original file:** `heatLoad.js`

**File type:** .JS

**Size:** 10,377 bytes

**Last modified:** 2026-05-26 04:41:26


---

## Content

```javascript
// heatLoad.js â€“ universal top- / bottom-freezer heat load model (physically correct)
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

function lambdaUrethane(T_in, T_out) {
  const T_avg = (T_in + T_out) / 2;
  return 0.0165 + 0.00011 * (T_avg-25);   // Excel formula, shifted to be 0.0165 at 25Â°C
}
function kExterior(thk, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + (thk/1000)/lam);
}
function kInterior(thk, T1, T2) {
  const lam = lambdaUrethane(T1, T2);
  return 1 / (1/PC.surfaceCoefficients.inside + 1/PC.surfaceCoefficients.inside + (thk/1000)/lam);
}

export const DEFAULT_GEOMETRY = {
  H: 1680, W: 800, D: 630, Hf: 550, Hr: 1130, Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40,
  tRfloor: 70,
};

export function calcHeatLoads(
  geom, temps, electrical, PIPEPITCH, BackcondenserEfficiency=0.7,
  fanAirflow_m3h, evapParams, fanInputPower_W,
  freezerPosition = 'top'
) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tFback, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRdoor,
    tRbottom1, tRbottom2, tRbottom3,
    tFfloor1, tFfloor2, tFfloor3, tRfloor
  } = geom;
  const { T0, TF, TR, T2, TC, PR, TE } = temps;
  const K_side = 10.57-0.042*PIPEPITCH.side+0.00005*PIPEPITCH.side**2;
  const K_back = 10.57-0.042*PIPEPITCH.back+0.00005*PIPEPITCH.back**2;
  const S_side = (H*(D-30)-(Db2+Db1)*Hb/2)*2/1e6;
  const S_back =W*(H-Hb)/1e6*BackcondenserEfficiency;
  const T_comp = 50 * PR + T0;            // already exists, unused
  const T_compZone = T0 + (T_comp - T0) * PR;  // ADD THIS = 50Ã—PRÂ²+T0
  //const T_CompWall = T0 + (TC - T0) * PR;  // Excel formula for condenser wall temp rise
  const TRise_side = (TC - T0) / 10 * K_side;
  const TRise_back = (TC - T0) / 10 * K_back;
  const T_wallSide = T0 + TRise_side * PR;
  const T_wallBack = T0 + TRise_back * PR;

  const isTopFreezer = (freezerPosition === 'top');

  // â”€â”€ Freezer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AFtop    = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  const AFdoor   = (Hf - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  const AFpackin = ((Hf - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  // Freezer left/right area depends on orientation
  let AFleft, AFright;
  if (isTopFreezer) {
    // topâ€‘freezer: freezer has no machineâ€‘compartment cutâ€‘out
    AFleft  = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
    AFright = AFleft;
  } else {
    // bottomâ€‘freezer: freezer has the machineâ€‘compartment cutâ€‘out
    const fSideHeight = Hf - (tFtop + tFfloor1)/2;
    AFleft  = (fSideHeight * (D - tEvaBack/2) - (Db1 + Db2) * Hb / 2) / 1e6;
    AFright = AFleft;
  }

  let QF = 0;

  // Freezer top
  QF += (isTopFreezer
    ? kExterior(tFtop, TF, T0) * AFtop * (T0 - TF)
    : kInterior(tFtop, TF, TR) * AFtop * (TR - TF));

  // Freezer sides
  QF += kExterior(tFleft, TF, T_wallSide) * AFleft * (T_wallSide - TF)
      + kExterior(tFright, TF, T_wallSide) * AFright * (T_wallSide - TF);

  // Freezer bottom
  if (isTopFreezer) {
    const AFbottom = (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6;
    QF += kInterior(tFbottom, TF, TR) * AFbottom * (TR - TF);
  } else {
    const AFbottom1 = (W - (tFleft + tFright)/2) * Db1 / 1e6;
    const AFbottom2 = (W - (tFleft + tFright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
    const AFbottom3 = (W - (tFleft + tFright)/2) * (D-Db2) / 1e6;
    QF += kExterior(tFfloor1, TF, T_compZone) * AFbottom1 * (T_compZone - TF)
        + kExterior(tFfloor2, TF, T_compZone) * AFbottom2 * (T_compZone - TF)
        + kExterior(tFfloor3, TF, T0)       * AFbottom3 * (T0 - TF);
  }

  // Freezer door + packing
  QF += kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF)
      + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses
  QF += (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR))
        * (W - tFleft - tFright) / 1000;
  QF += (0.0791*(TC-TF) - 0.072*(T0-TF)) * PR * (Hf*2 + W) / 1000;

  // â”€â”€ Refrigerator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let ARtop, ARleft, ARback;
  const ARdoor   = (Hr - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  const ARpackin = ((Hr - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  if (isTopFreezer) {
    ARtop  = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
    const rH = Hr - (tRtop + tRbottom1)/2;
    ARleft = (rH * (D - tRback/2) - (Db1+Db2)*Hb/2) / 1e6;
    ARback = (Hr - (tRtop+tRbottom1)/2 - Hb) * (W - (tRleft+tRright)/2) / 1e6;
  } else {
    // bottomâ€‘freezer: refrigerator has NO machineâ€‘compartment cutâ€‘out
    ARtop  = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
    const rH = Hr - (tRtop + tRfloor)/2;
    ARleft = (rH * (D - tRback/2)) / 1e6;
    ARback = (Hr - (tRtop + tRfloor)/2) * (W - (tRleft+tRright)/2) / 1e6;
  }

  let QR = 0;

  // Refrigerator top
  QR += (isTopFreezer
    ? kInterior(tRtop, TF, TR) * ARtop * (TF - TR)
    : kExterior(tRtop, TR, T0) * ARtop * (T0 - TR));

  // Refrigerator sides
  QR += kExterior(tRleft, TR, T_wallSide) * ARleft * (T_wallSide - TR)
      + kExterior(tRright, TR, T_wallSide) * ARleft * (T_wallSide - TR);

  // Refrigerator back
  QR += kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR);

  // Refrigerator bottom
  if (isTopFreezer) {
    const ARb1 = (W - (tRleft+tRright)/2) * Db1 / 1e6;
    const ARb2 = (W - (tRleft+tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
    const ARb3 = (W - (tRleft+tRright)/2) * (D-Db2) / 1e6;
    QR += kExterior(tRbottom1, TR, T_compZone) * ARb1 * (T_compZone - TR)
        + kExterior(tRbottom2, TR, T_compZone) * ARb2 * (T_compZone - TR)
        + kExterior(tRbottom3, TR, T0)       * ARb3 * (T0 - TR);
  } else {
    const ARbottom = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
    QR += kInterior(tRfloor, TF, TR) * ARbottom * (TF - TR);
  }

  // Refrigerator door + packing
  QR += kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR)
      + PC.insulation.packing * ARpackin * (T0 - TR);
    QR += (0.0546*(TC-TF) - 0.0491*(T0-TF)) * PR * (Hr*2 + W) / 1000;
// â”€â”€ Evaporator back (always on freezer back) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let A_evaBack;
  if (isTopFreezer) {
    A_evaBack = (W - (tFleft+tFright)/2) * (Hf - (tFtop+tFbottom)/2) / 1e6;
  } else {
    // bottomâ€‘freezer: freezer back above the machine compartment
    A_evaBack = (W - (tFleft+tFright)/2) * (Hf - Hb - (tFtop+tFfloor1)/2) / 1e6;
  }
  const QEV_cond = kExterior(tEvaBack, T2, T_wallBack) * A_evaBack * (T_wallBack - T2);
  const fanLoad = (fanInputPower_W ?? 2.1) * PC.conversion.wattToKcalPerH * PR;
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min/60/24) * PC.conversion.wattToKcalPerH;

  return { QF, QR, QEV: QEV_cond + fanLoad + defrostLoad, fanLoad, defrostLoad };
}
/**
 * Compute effective UÂ·A and effective compartment temperature for the side and back walls.
 * Uses the same area and Kâ€‘value formulas as calcHeatLoads.
 * The Kâ€‘values are evaluated at a nominal wall temperature (T0 + 10â€¯Â°C) â€“ the error from
 * the true wall temperature is negligible (<â€¯0.1â€¯K).
 */
export function computeWallConductances(geom, T0, TF, TR, freezerPosition = 'top') {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tFback, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRdoor,
    tRbottom1, tRbottom2, tRbottom3,
    tFfloor1, tFfloor2, tFfloor3, tRfloor
  } = geom;

  const isTopFreezer = (freezerPosition === 'top');

  // Nominal outside temperature for Kâ€‘value evaluation (exact value unimportant)
  const T_wall_nom = T0 + 10;

  // ---- Side walls (left + right) ----
  // Freezer side wall area
  let AF_side;
  if (isTopFreezer) {
    AF_side = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  } else {
    const fSideHeight = Hf - (tFtop + tFfloor1)/2;
    AF_side = (fSideHeight * (D - tEvaBack/2) - (Db1 + Db2) * Hb / 2) / 1e6;
  }
  const K_F_side = kExterior(tFleft, TF, T_wall_nom);
  const UA_F_side = 2 * K_F_side * AF_side;   // both sides

  // Refrigerator side wall area
  let AR_side;
  if (isTopFreezer) {
    const rSideHeight = Hr - (tRtop + tRbottom1)/2;
    AR_side = (rSideHeight * (D - tRback/2) - (Db1 + Db2) * Hb / 2) / 1e6;
  } else {
    const rSideHeight = Hr - (tRtop + tRfloor)/2;
    AR_side = (rSideHeight * (D - tRback/2)) / 1e6;
  }
  const K_R_side = kExterior(tRleft, TR, T_wall_nom);
  const UA_R_side = 2 * K_R_side * AR_side;

  const UA_side_total = UA_F_side + UA_R_side;
  const T_comp_side = (UA_F_side * TF + UA_R_side * TR) / UA_side_total;

  // ---- Back wall ----
  // Refrigerator back wall area
  let AR_back;
  if (isTopFreezer) {
    AR_back = (Hr - (tRtop + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6;
  } else {
    AR_back = (Hr - (tRtop + tRfloor)/2) * (W - (tRleft + tRright)/2) / 1e6;
  }
  const K_R_back = kExterior(tRback, TR, T_wall_nom);
  const UA_R_back = K_R_back * AR_back;

  // Evaporator back wall (freezer back)
  let A_evaBack;
  if (isTopFreezer) {
    A_evaBack = (W - (tFleft + tFright)/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  } else {
    A_evaBack = (W - (tFleft + tFright)/2) * (Hf - Hb - (tFtop + tFfloor1)/2) / 1e6;
  }
  const K_evaBack = kExterior(tEvaBack, TF, T_wall_nom);
  const UA_F_back = K_evaBack * A_evaBack;

  const UA_back_total = UA_R_back + UA_F_back;
  const T_comp_back = (UA_R_back * TR + UA_F_back * TF) / UA_back_total;

  return { UA_side_total, T_comp_side, UA_back_total, T_comp_back };
}
```


---

*Converted from `heatLoad.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_index.md

# index.js

**Original file:** `index.js`

**File type:** .JS

**Size:** 7,152 bytes

**Last modified:** 2026-05-18 17:25:38


---

## Content

```javascript
/**
 * @file index.js
 * Thermo analysis entry point â€“ orchestrates the nested Newtonâ€‘Raphson solver
 * and returns a humanâ€‘readable result object.
 */

import { solveThermalSystem } from './solver.js';
import { DEFAULT_GEOMETRY } from './heatLoad.js';
import { SJ54H_COMPONENTS } from './defaultComponents.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { DEFAULT_CABINET, toThermalFormat } from '../geometry.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a full thermodynamic analysis of a refrigerator.
 *
 * @param {object} config
 * @param {object} config.geom               - cabinet dimensions (see DEFAULT_GEOMETRY)
 * @param {object} config.compParams         - compressor parameters
 * @param {object} config.condenserConfig    - condenser design
 * @param {string} config.refrigerant        - 'R-600a' | 'R-134a'
 * @param {number} config.subcool            - subâ€‘cooling (K)
 * @param {number} config.dischargeTemp      - discharge temperature (Â°C)
 * @param {object} config.fixedTemps         - { T0, TF, TR }
 * @param {object} config.fan                - { totalAirflow, density?, cp? }
 * @param {object} config.electrical         - { defrostHeater_W, defrostOn_min, ... }
 * @param {object} [config.solverOptions]    - optional solver tuning
 * @returns {{ success: boolean, errors: string[], warnings: string[], results: object|null }}
 */
export function runThermoAnalysis(config) {
  const errors = [];
  const warnings = [];

  // Basic input validation
  if (!config) {
    errors.push('No configuration provided.');
    return { success: false, errors, warnings, results: null };
  }

  const required = [
    'geom', 'compParams', 'condenserConfig', 'refrigerant',
    'subcool', 'dischargeTemp', 'fixedTemps', 'fan', 'electrical'
  ];
  for (const key of required) {
    if (config[key] === undefined) {
      errors.push(`Missing required config field: ${key}`);
    }
  }

  if (config.fixedTemps) {
    const { T0, TF, TR, TE } = config.fixedTemps;
    if ([T0, TF, TR, TE].some(v => typeof v !== 'number')) {
      errors.push('fixedTemps must contain numeric T0, TF, TR, TE.');
    }
  }

  if (config.fan) {
    if (!config.fan.totalAirflow) {
      errors.push('fan.totalAirflow is required.');
    }
    // Apply defaults for density and cp if not supplied
    config.fan.density = config.fan.density ?? PHYSICAL_CONSTANTS.air.density;
    config.fan.cp = config.fan.cp ?? PHYSICAL_CONSTANTS.air.cp;
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, results: null };
  }

  // Merge solver options with defaults
  const solverOptions = {
    TC0: 54.4,
    DH: 0.001,
    tolOuter: 0.0005,
    maxIterOuter: 100,
    innerOptions: {},
    ...(config.solverOptions || {}),
  };

  try {
    const result = solveThermalSystem({
      geom: config.geom,
      compParams: config.compParams,
      condenserConfig: config.condenserConfig,
      refrigerant: config.refrigerant,
      subcool: config.subcool,
      dischargeTemp: config.dischargeTemp,
      fixedTemps: config.fixedTemps,
      fan: config.fan,
      electrical: config.electrical,
      ...solverOptions,
    });

    if (!result.converged) {
      errors.push(result.error || 'Thermal solver did not converge.');
      return { success: false, errors, warnings, results: null };
    }

    // Build output
    const output = {
      TC: result.TC,
      T2: result.T2,
      PR: result.PR,
      heatLoads: {
        QF: result.heatLoads.QF,
        QR: result.heatLoads.QR,
        QEV: result.heatLoads.QEV,
        fanLoad: result.heatLoads.fanLoad,
        defrostLoad: result.heatLoads.defrostLoad,
      },
      compressor: {
        massFlow: result.compressor.massFlow,
        coolingCapacity: result.compressor.coolingCapacity,
        inputPower: result.compressor.inputPower,
        etaV: result.compressor.etaV,
      },
      iterations: {
        outer: result.outerIterations,
        innerTotal: result.innerTotalIterations,
      },
    };

    // Warnings (e.g. if PR hit a limit â€“ not implemented yet, but placeholder)
    if (result.PR >= 1) {
      warnings.push('Compressor running ratio reached 100% â€” system may be undersized.');
    } else if (result.PR <= 0.1) {
      warnings.push('Compressor running ratio very low â€” check heat load inputs.');
    }

    return { success: true, errors: [], warnings, results: output };
  } catch (err) {
    errors.push(`Unexpected error in thermal analysis: ${err.message}`);
    return { success: false, errors, warnings, results: null };
  }
}

// ---------------------------------------------------------------------------
// Helper: build a default configuration using the SJâ€‘54H baseline
// ---------------------------------------------------------------------------

/**
 * Returns a complete configuration object preâ€‘filled with SJâ€‘54H defaults.
 * The caller can override any field after.
 *
 * @param {object} [overrides] - optional partial config to merge
 * @returns {object} config ready for runThermoAnalysis
 */
export function buildDefaultConfig(overrides = {}) {
  const base = {
    geom: toThermalFormat(DEFAULT_CABINET),
    compParams: { ...SJ54H_COMPONENTS.compressor },
    condenserConfig: {
      K_side: SJ54H_COMPONENTS.condenser.K_side_kcalhm2C,
      K_back: SJ54H_COMPONENTS.condenser.K_back_kcalhm2C,
      backCondenserEfficiency: SJ54H_COMPONENTS.condenser.backCondenserEfficiency,
      k_RFront1: SJ54H_COMPONENTS.condenser.k_RFront1,
      k_RFront2: SJ54H_COMPONENTS.condenser.k_RFront2,
      k_FRPartition1: SJ54H_COMPONENTS.condenser.k_FRPartition1,
      k_FRPartition2: SJ54H_COMPONENTS.condenser.k_FRPartition2,
      k_FFront1: SJ54H_COMPONENTS.condenser.k_FFront1,
      k_FFront2: SJ54H_COMPONENTS.condenser.k_FFront2,
    },
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps: {
      T0: 30,
      TF: -18,
      TR: 3,
      TE: -23.3,
    },
    fan: {
      totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h,
      inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W,   // add this
    },
    electrical: { ...SJ54H_COMPONENTS.electrical },
    solverOptions: {
      TC0: 54.4,
      DH: 0.001,
      tolOuter: 0.0005,
      maxIterOuter: 100,
      innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
    },
  };

  return deepMerge(base, overrides);
}

// Simple deep merge (only one level needed for our configs)
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}
```


---

*Converted from `index.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_refrigerant.md

# refrigerant.js

**Original file:** `refrigerant.js`

**File type:** .JS

**Size:** 5,080 bytes

**Last modified:** 2026-05-08 15:11:59


---

## Content

```javascript
/**
 * @file refrigerant.js
 * @description Thermodynamic property functions for Râ€‘600a and Râ€‘134a.
 *   All equations are taken directly from the SJ-54H Excel model (MAIN sheet).
 *   Temperatures in Â°C, pressures in bar absolute.
 *   Enthalpies in kcal/kg, specific volume in mÂ³/kg.
 */

// ---------------------------------------------------------------------------
//  Saturation pressure (bar)
// ---------------------------------------------------------------------------

/**
 * Saturation pressure for Râ€‘600a (isobutane).
 * Source: MAIN J14/J15.
 * @param {number} t - temperature (Â°C)
 * @returns {number} pressure (bar)
 */
export function satPressureR600a(t) {
  const Tk = t + 273.16;
  return Math.exp(
    68.322
    - 4401 / Tk
    - 9.8436 * Math.log(Tk)
    + 0.0127711 * Tk
  );
}

/**
 * Saturation pressure for Râ€‘134a.
 * Source: MAIN K14/K15.
 * @param {number} t - temperature (Â°C)
 * @returns {number} pressure (bar)
 */
export function satPressureR134a(t) {
  const Tk = t + 273.16;
  return Math.exp(
    104.918
    - 5301.3 / Tk
    - 16.2481 * Math.log(Tk)
    + 0.0246593 * Tk
  );
}

// ---------------------------------------------------------------------------
//  Specific volume of saturated vapour (mÂ³/kg)
// ---------------------------------------------------------------------------

/**
 * Specific volume for Râ€‘600a.
 * Source: MAIN J18.
 * @param {number} t   - temperature (Â°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    v (mÂ³/kg)
 */
export function specificVolumeR600a(t, p) {
  const Tk = t + 273.16;
  return (
    0.015883
    + (0.001455 * Tk) / p
    - 7.2936 / Tk
    - 0.0004645 * p
  );
}

/**
 * Specific volume for Râ€‘134a.
 * Source: MAIN K18.
 * @param {number} t   - temperature (Â°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    v (mÂ³/kg)
 */
export function specificVolumeR134a(t, p) {
  const Tk = t + 273.16;
  return (
    0.01248
    + (0.0008207 * Tk) / p
    - 4.663 / Tk
    - 0.0002297 * p
  );
}

// ---------------------------------------------------------------------------
//  Superheated vapour enthalpy (kcal/kg)
//  Used for both evaporator outlet (suction) and condenser inlet (discharge).
// ---------------------------------------------------------------------------

/**
 * Râ€‘600a vapour enthalpy.
 * Source: MAIN J16/J17 (identical coefficients).
 * @param {number} t   - temperature (Â°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    h (kcal/kg)
 */
export function vaporEnthalpyR600a(t, p) {
  const Tk = t + 273.16;
  return (
    104.5
    + 0.049951 * Tk
    + 0.00058822 * Tk * Tk
    - (249.18 * p) / Tk
  );
}

/**
 * Râ€‘134a vapour enthalpy.
 * Source: MAIN K16/K17.
 * @param {number} t   - temperature (Â°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    h (kcal/kg)
 */
export function vaporEnthalpyR134a(t, p) {
  const Tk = t + 273.16;
  return (
    119.36
    + 0.023174 * Tk
    + 0.00031297 * Tk * Tk
    - (138.07 * p) / Tk
  );
}

// ---------------------------------------------------------------------------
//  Subâ€‘cooled liquid enthalpy (kcal/kg)
// ---------------------------------------------------------------------------

/**
 * Râ€‘600a liquid enthalpy (function of subâ€‘cool temperature in Â°C).
 * Source: MAIN N47 (Hcond out).
 * @param {number} t_sub - subâ€‘cool temperature (Â°C)
 * @returns {number}      h (kcal/kg)
 */
export function liquidEnthalpyR600a(t_sub) {
  return (
    75.545
    + 0.55731 * t_sub
    + 0.0007088 * t_sub * t_sub
    + 0.0000029408 * t_sub * t_sub * t_sub
  );
}

/**
 * Râ€‘134a liquid enthalpy.
 * Source: MAIN O47.
 * @param {number} t_sub - subâ€‘cool temperature (Â°C)
 * @returns {number}      h (kcal/kg)
 */
export function liquidEnthalpyR134a(t_sub) {
  return (
    100.019
    + 0.31763 * t_sub
    + 0.00033057 * t_sub * t_sub
    + 0.0000035281 * t_sub * t_sub * t_sub
  );
}

// ---------------------------------------------------------------------------
//  Easy dispatch by refrigerant name
// ---------------------------------------------------------------------------

/**
 * Returns an object with all property functions for a given refrigerant.
 * @param {'R-600a'|'R-134a'} name
 * @returns {{ satPressure, specificVolume, vaporEnthalpy, liquidEnthalpy }}
 */
export function getRefrigerantFunctions(name) {
  switch (name) {
    case 'R-600a':
      return {
        satPressure: satPressureR600a,
        specificVolume: specificVolumeR600a,
        vaporEnthalpy: vaporEnthalpyR600a,
        liquidEnthalpy: liquidEnthalpyR600a,
      };
    case 'R-134a':
      return {
        satPressure: satPressureR134a,
        specificVolume: specificVolumeR134a,
        vaporEnthalpy: vaporEnthalpyR134a,
        liquidEnthalpy: liquidEnthalpyR134a,
      };
    default:
      throw new Error(`Unknown refrigerant: ${name}`);
  }
}
```


---

*Converted from `refrigerant.js` on 2026-05-27 14:13:10*


---
## js_engine_thermo_solver.md

# solver.js

**Original file:** `solver.js`

**File type:** .JS

**Size:** 8,643 bytes

**Last modified:** 2026-05-26 05:11:17


---

## Content

```javascript
// solver.js â€“ universal thermal solver (dynamic wall temperatures + dynamic TE wrapper)
import { calcHeatLoads } from './heatLoad.js';
import { computeCondenserAreas, calcQCout } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { compressorState, resolveCompressorState } from './compressor.js';
import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorStateMap, SQ47LAEG_MAP } from './compressorMap.js';

const RHO_AIR = 1.365;
const CP_AIR  = 0.24;

// 2Ã—2 Newton with damping
function newton2(F, x0, dx, tol, maxIter, debug = false) {
  let x = [x0[0], x0[1]];
  let prevF = [Infinity, Infinity];
  let prevX = [...x];
  for (let i = 0; i < maxIter; i++) {
    const f = F(x);
    const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));
    if (debug) console.log(`  Newton ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)} F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)}`);
    if (maxAbsF <= tol) return { x, converged: true, iterations: i + 1 };
    if (maxAbsF > Math.max(Math.abs(prevF[0]), Math.abs(prevF[1])) && i > 0) {
      if (debug) console.log('  Damping');
      x[0] = (x[0] + prevX[0]) / 2;
      x[1] = (x[1] + prevX[1]) / 2;
      continue;
    }
    prevF = f; prevX = [...x];
    const J = [[0,0],[0,0]];
    for (let j = 0; j < 2; j++) {
      const xp = [x[0], x[1]]; xp[j] += dx;
      const fp = F(xp);
      J[0][j] = (fp[0] - f[0]) / dx;
      J[1][j] = (fp[1] - f[1]) / dx;
    }
    const det = J[0][0]*J[1][1] - J[0][1]*J[1][0];
    if (Math.abs(det) < 1e-12) return { x, converged: false, iterations: i+1, error: 'Singular' };
    x[0] = Math.max(-80, Math.min(20, x[0] + (-f[0]*J[1][1] + f[1]*J[0][1])/det));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + (J[0][0]*(-f[1]) + J[1][0]*f[0])/det));
  }
  return { x, converged: false, iterations: maxIter, error: 'Max iter' };
}

// Inner solver â€“ uses dynamic wall temperatures from cabinet heat balance
function solveInner(TC, geom, compParams, refrigerant, subcool,
                    fixedTemps, fan, electrical, condenserConfig,
                    evapGeom, TE, freezerPos, innerOpts = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100, initialT2, initialPR, debug = false } = innerOpts;
  const { T0, TF, TR } = fixedTemps;
  const rho = RHO_AIR, cp = CP_AIR;
    const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };

  let currentMR = fan.totalAirflow * 0.1, currentMF = fan.totalAirflow * 0.9;

  const F = (x) => {
    const T2 = x[0], PR = x[1];

    const loads = calcHeatLoads(
      geom, { T0, TF, TR, T2, TC, PR, TE }, electrical,
      PIPEPITCH, 0.7, fan.totalAirflow, evapGeom, fan.inputPower_W, freezerPos
    );
    const comp = resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0);
    const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;
    const denom = fan.totalAirflow * rho * cp * PR;
    let F1;
    if (Math.abs(denom) < 1e-12) { F1 = loads.QF; }
    else {
      const T3 = T2 + loads.QEV / denom;
      const MR_raw = loads.QR / (rho * cp * Math.max(0.01, TR - T3) * PR);
      const MR = Math.min(fan.totalAirflow, Math.max(0, MR_raw));
      const MF = fan.totalAirflow - MR;
      currentMR = MR; currentMF = MF;
      F1 = loads.QF - MF * rho * cp * (TF - T3) * PR;
    }
    return [F1, F2];
  };

  let T2_guess = initialT2 ?? -21.25, PR_guess = initialPR ?? 0.59;
  let res = newton2(F, [T2_guess, PR_guess], dx, tol, maxIter, debug);
  if (!res.converged) {
    for (const [t2, pr] of [[T2_guess, 0.4], [T2_guess-2, 0.5], [-21, 0.3]]) {
      res = newton2(F, [t2, pr], dx, tol, maxIter, debug);
      if (res.converged) break;
    }
  }
  if (!res.converged) return { T2: res.x[0], PR: res.x[1], converged: false };

  const fT2 = res.x[0], fPR = res.x[1];
  const loads = calcHeatLoads(
    geom, { T0, TF, TR, T2: fT2, TC, PR: fPR, TE }, electrical,
    PIPEPITCH, 0.7, fan.totalAirflow, evapGeom, fan.inputPower_W, freezerPos
  );
  const comp = resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0);
  return { T2: fT2, PR: fPR, TE, converged: true, heatLoads: loads, compressor: comp, MR: currentMR, MF: currentMF };
}
// Outer solver â€“ adjusts TC until QCout = QCin, uses dynamic wall temperatures
export function solveThermalSystem(config, TE_override = null) {
  const {
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp,
    fixedTemps, fan, electrical,
    freezerPosition = 'top',
    TC0 = 45, DH = 0.001, tolOuter = 0.001, maxIterOuter = 50,
    innerOptions = {},
  } = config;

  const areas = computeCondenserAreas(geom, condenserConfig, freezerPosition);
  const T0 = fixedTemps.T0;
  let TC = TC0, totalInner = 0;
  const evapGeom = geom;
  const debug = innerOptions.debug ?? false;
  const TE = TE_override ?? config.initialTE ?? -25.27;


  for (let iter = 0; iter < maxIterOuter; iter++) {
    if (debug) console.log(`\nOuter ${iter}, TC=${TC.toFixed(2)}`);
    const inner = solveInner(TC, geom, compParams, refrigerant, subcool,
                         fixedTemps, fan, electrical, condenserConfig,
                         evapGeom, TE, freezerPosition, innerOptions);
    if (!inner.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Inner loop failed' };
    totalInner += inner.iterations;

    const QCout = calcQCout(TC, T0, fixedTemps.TF, fixedTemps.TR, areas);
    const compOuter = resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0);
    const rf = getRefrigerantFunctions(refrigerant);
    const h_dis = rf.vaporEnthalpy(dischargeTemp, rf.satPressure(TC));
    const Tsub = TC - subcool;
    const h_liq = rf.liquidEnthalpy(Tsub);
    const QCin = compOuter.massFlow * (h_dis - h_liq);

    const F3 = QCout - QCin;
    if (debug) console.log(`  T2=${inner.T2.toFixed(3)} PR=${inner.PR.toFixed(4)} F3=${F3.toFixed(3)}`);

    if (Math.abs(F3) < tolOuter) {
      return { TC, T2: inner.T2, PR: inner.PR, TE, converged: true, outerIterations: iter+1, innerTotalIterations: totalInner, heatLoads: inner.heatLoads, compressor: inner.compressor, MR: inner.MR, MF: inner.MF };
    }

    const pertOpts = { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR };
    let innerPert = solveInner(TC+DH, geom, compParams, refrigerant, subcool,
                               fixedTemps, fan, electrical, condenserConfig,
                               evapGeom, TE, freezerPosition, pertOpts);
    if (!innerPert.converged) innerPert = solveInner(TC+DH, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, evapGeom, TE, freezerPosition, innerOptions);
    if (!innerPert.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Perturbation inner loop failed' };
    totalInner += innerPert.iterations;

    const dF3dTC = ((calcQCout(TC+DH, T0, fixedTemps.TF, fixedTemps.TR, areas) - QCin) - F3) / DH;
    if (Math.abs(dF3dTC) < 1e-9) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative' };
    TC -= Math.max(-2, Math.min(2, F3 / dF3dTC));
  }
  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations' };
}

// Dynamic TE wrapper â€“ iterates TE using NTU model
export function runThermalAnalysisDynamic(config) {
  const { fixedTemps, fan, geom, freezerPosition } = config;
  const { TF, TR } = fixedTemps;
  let TE = -25.27;
  let result;
  for (let i = 0; i < 5; i++) {
    result = solveThermalSystem(config, TE);
    if (!result.converged) return result;
    const { MR, MF, T2, TC, PR } = result;
    const T1 = (MF * TF + MR * TR) / fan.totalAirflow;
    const evapWidth_m  = (config.evapGeom?.evapWidth_mm  ?? 460) / 1000;
    const evapDepth_m  = (config.evapGeom?.evapDepth_mm  ?? 60)  / 1000;
    const evapArea_m2  =  config.evapGeom?.evapArea_m2   ?? 1.754;
    const faceArea = evapWidth_m * evapDepth_m;
    const v_ms = fan.totalAirflow / faceArea / 3600;
    const alpha = 12.93 * Math.pow(v_ms, 0.415);
    const C_air = fan.totalAirflow * RHO_AIR * CP_AIR;
    const UA_eff = alpha * evapArea_m2 / Math.max(0.01, PR);
    const NTU = UA_eff / C_air;
    const eff = 1 - Math.exp(-NTU);
    const newTE = T1 - (T1 - T2) / Math.max(0.001, eff);
    if (Math.abs(newTE - TE) < 0.1) {
      result.TE = newTE;
      return result;
    }
    TE = newTE;
  }
  result.TE = TE;
  result.warning = 'TE iteration did not fully converge';
  return result;
}
```


---

*Converted from `solver.js` on 2026-05-27 14:13:10*


---
## js_engine_traversal.md

# traversal.js

**Original file:** `traversal.js`

**File type:** .JS

**Size:** 10,908 bytes

**Last modified:** 2026-05-03 22:45:32


---

## Content

```javascript
/**
 * @file traversal.js
 * Pass 2 â€” single recursive descent that simultaneously:
 *   1. Derives each node's available space from parent context
 *   2. Validates dimension-dependent rules at each node
 *   3. Calculates leaf volumes immediately after validation passes
 *
 * If a node fails dimension-dependent validation, its entire subtree is
 * skipped (childrenSkipped: true on the error). Sibling subtrees continue.
 *
 * Fitting-level errors do NOT skip the leaf â€” they exclude the offending
 * fitting from IEC deductions only; gross and EG_Net are unaffected.
 */

import { calcLeaf } from './calc.js';

const DIM_TOL   = 0.01;   // mm tolerance for explicit height balance
const RATIO_TOL = 0.001;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Runs Pass 2 from the root node.
 * Call only after validateStructure() returns no errors.
 *
 * @param {import('./types').Node}   rootNode
 * @param {import('./types').Space}  rootSpace  - from deriveRootSpace()
 * @returns {{ leaves: import('./types').LeafResult[],
 *             errors: import('./types').ValidationError[],
 *             warnings: import('./types').Warning[] }}
 */
export function traverseAndCompute(rootNode, rootSpace) {
  const errors   = [];
  const warnings = [];
  const leaves   = [];

  // Pre-traverse: validate cabinet-level wall ratio and positive internal dims
  // These are checked before traverseNode to avoid propagating bad root space.
  // (Called by runCalculation in index.js before this function is invoked.)

  traverseNode(rootNode, rootSpace, errors, warnings, leaves);

  return { leaves, errors, warnings };
}

// ---------------------------------------------------------------------------
// Recursive node traversal
// ---------------------------------------------------------------------------

/**
 * @param {import('./types').Node}                node
 * @param {import('./types').Space}               space
 * @param {import('./types').ValidationError[]}   errors
 * @param {import('./types').Warning[]}           warnings
 * @param {import('./types').LeafResult[]}        leaves
 */
function traverseNode(node, space, errors, warnings, leaves) {
  switch (node.nodeType) {
    case 'leaf':
      processLeaf(node, space, errors, warnings, leaves);
      break;
    case 'horizontal':
      processHorizontal(node, space, errors, warnings, leaves);
      break;
    case 'vertical':
      processVertical(node, space, errors, warnings, leaves);
      break;
  }
}

// ---------------------------------------------------------------------------
// Horizontal split
// ---------------------------------------------------------------------------

function processHorizontal(node, space, errors, warnings, leaves) {
  const { children, dividers, id } = node;
  const mode = children[0].heightMode;

  // Derive child heights
  let childHeights;
  if (mode === 'ratio') {
    const totalDividerH = dividers.reduce((s, d) => s + d.thickness, 0);
    const usableH = space.height - totalDividerH;
    childHeights = children.map(c => usableH * c.heightValue);
  } else {
    // explicit mode â€” validate balance first
    const sumHeights   = children.reduce((s, c) => s + c.heightValue, 0);
    const sumDividers  = dividers.reduce((s, d) => s + d.thickness, 0);
    const total        = sumHeights + sumDividers;

    if (Math.abs(total - space.height) > DIM_TOL) {
      errors.push({
        rule:           'heightBalance_explicit',
        nodeId:         id,
        message:        `Sum of heights (${sumHeights}) + dividers (${sumDividers}) = ${total} â‰  availableHeight (${space.height})`,
        childrenSkipped: true,
      });
      return; // skip entire subtree
    }
    childHeights = children.map(c => c.heightValue);
  }

  // Recurse into each child with its derived height
  for (let i = 0; i < children.length; i++) {
    const childSpace = {
      width:  space.width,
      height: childHeights[i],
      depth:  space.depth,
    };
    traverseNode(children[i].node, childSpace, errors, warnings, leaves);
  }
}

// ---------------------------------------------------------------------------
// Vertical split
// ---------------------------------------------------------------------------

function processVertical(node, space, errors, warnings, leaves) {
  const { dividerThickness, leftWidthRatio, left, right, id } = node;

  // Validate divider fits within available width
  if (dividerThickness >= space.width) {
    errors.push({
      rule:           'verticalDividerBounds',
      nodeId:         id,
      message:        `dividerThickness (${dividerThickness}) â‰¥ availableWidth (${space.width})`,
      childrenSkipped: true,
    });
    return;
  }

  const usableW  = space.width - dividerThickness;
  const leftW    = usableW * leftWidthRatio;
  const rightW   = usableW * (1 - leftWidthRatio);

  traverseNode(left,  { width: leftW,  height: space.height, depth: space.depth }, errors, warnings, leaves);
  traverseNode(right, { width: rightW, height: space.height, depth: space.depth }, errors, warnings, leaves);
}

// ---------------------------------------------------------------------------
// Leaf: dimension-dependent fitting validation + calculation
// ---------------------------------------------------------------------------

function processLeaf(node, space, errors, warnings, leaves) {
  const excludedFittingIds = new Set();
  const { fittings, id } = node;

  // Shelves
  for (const shelf of fittings.shelves ?? []) {
    const shelfErrors = validateShelf(shelf, space, id);
    for (const e of shelfErrors) {
      errors.push(e);
      excludedFittingIds.add(shelf.id); // exclude from IEC deduction
    }
  }

  // Drawers
  for (const drawer of fittings.drawers ?? []) {
    const drawerErrors = validateDrawer(drawer, space, id);
    for (const e of drawerErrors) {
      errors.push(e);
      excludedFittingIds.add(drawer.id);
    }
  }

  // Door bins
  for (const bin of fittings.doorBins ?? []) {
    const binErrors = validateDoorBin(bin, space, id);
    for (const e of binErrors) {
      errors.push(e);
      excludedFittingIds.add(bin.id);
    }
  }

  // Soft warning: door bin depth vs shelf depth
  const binDepthWarning = checkDoorBinDepth(fittings, space, id);
  if (binDepthWarning) warnings.push(binDepthWarning);

  // Calculate leaf volumes (gross and EG always computed; excluded fittings skipped in IEC)
  const result = calcLeaf(node, space, excludedFittingIds);
  leaves.push(result);
}

// ---------------------------------------------------------------------------
// Fitting validators (return ValidationError[])
// ---------------------------------------------------------------------------

function validateShelf(shelf, space, nodeId) {
  const errs = [];
  const topEdge = shelf.positionFromFloor + shelf.thickness;

  if (shelf.positionFromFloor <= 0) {
    errs.push({ rule: 'shelfPosition', nodeId,
      message: `Shelf positionFromFloor must be > 0, got ${shelf.positionFromFloor}` });
  } else if (topEdge >= space.height) {
    errs.push({ rule: 'shelfPosition', nodeId,
      message: `Shelf top (${topEdge} mm) exceeds compartment height (${space.height} mm)` });
  }

  if (shelf.depth > space.depth) {
    errs.push({ rule: 'shelfDepth', nodeId,
      message: `Shelf depth (${shelf.depth}) exceeds availableDepth (${space.depth})` });
  }

  if (shelf.width != null && shelf.width > space.width) {
    errs.push({ rule: 'shelfWidth', nodeId,
      message: `Shelf width (${shelf.width}) exceeds availableWidth (${space.width})` });
  }

  return errs;
}

function validateDrawer(drawer, space, nodeId) {
  const errs = [];
  const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;

  if (oW > space.width) {
    errs.push({ rule: 'drawerBounds', nodeId,
      message: `Drawer outerWidth (${oW}) exceeds availableWidth (${space.width})` });
  }
  if (oD > space.depth) {
    errs.push({ rule: 'drawerBounds', nodeId,
      message: `Drawer outerDepth (${oD}) exceeds availableDepth (${space.depth})` });
  }
  if (oH >= space.height) {
    errs.push({ rule: 'drawerBounds', nodeId,
      message: `Drawer outerHeight (${oH}) must be < compartment height (${space.height})` });
  }

  // Wall ratio: must be < 50% of the smallest outer dimension
  const minOuter = Math.min(oW, oD, oH);
  if (t >= minOuter * 0.5) {
    errs.push({ rule: 'drawerWall', nodeId,
      message: `wallThickness (${t}) â‰¥ 50% of smallest outer dimension (${minOuter})` });
  }

  // Inner dimensions positive
  const innerW = oW - 2 * t;
  const innerD = oD - 2 * t;
  const innerH = oH - t;
  if (innerW <= 0) errs.push({ rule: 'drawerInnerPositive', nodeId, message: `Derived innerWidth â‰¤ 0` });
  if (innerD <= 0) errs.push({ rule: 'drawerInnerPositive', nodeId, message: `Derived innerDepth â‰¤ 0` });
  if (innerH <= 0) errs.push({ rule: 'drawerInnerPositive', nodeId, message: `Derived innerHeight â‰¤ 0` });

  return errs;
}

function validateDoorBin(bin, space, nodeId) {
  const errs = [];
  const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;

  const minOuter = Math.min(oW, oH, oD);
  if (t >= minOuter * 0.5) {
    errs.push({ rule: 'doorBinWall', nodeId,
      message: `wallThickness (${t}) â‰¥ 50% of smallest outer dimension (${minOuter})` });
  }

  const innerW = oW - 2 * t;
  const innerH = oH - 2 * t;
  const innerD = oD - t;
  if (innerW <= 0) errs.push({ rule: 'doorBinInnerPositive', nodeId, message: `Derived innerWidth â‰¤ 0` });
  if (innerH <= 0) errs.push({ rule: 'doorBinInnerPositive', nodeId, message: `Derived innerHeight â‰¤ 0` });
  if (innerD <= 0) errs.push({ rule: 'doorBinInnerPositive', nodeId, message: `Derived innerDepth â‰¤ 0` });

  return errs;
}

// ---------------------------------------------------------------------------
// Soft warnings
// ---------------------------------------------------------------------------

/**
 * Fires if sum of all door bin depths exceeds availableDepth minus min shelf depth.
 * @returns {import('./types').Warning|null}
 */
function checkDoorBinDepth(fittings, space, nodeId) {
  const bins   = fittings.doorBins ?? [];
  const shelves = fittings.shelves ?? [];
  if (!bins.length) return null;

  const totalBinDepth = bins.reduce((s, b) => s + b.outerDepth, 0);

  // If no shelves, use 0 as minShelfDepth â€” threshold equals full availableDepth
  const minShelfDepth = shelves.length
    ? Math.min(...shelves.map(s => s.depth))
    : 0;

  const threshold = space.depth - minShelfDepth;

  if (totalBinDepth > threshold) {
    return {
      rule:    'doorBinDepth',
      nodeId,
      message: `Î£ bin depths (${totalBinDepth} mm) exceeds availableDepth âˆ’ minShelfDepth (${threshold} mm)`,
    };
  }
  return null;
}

```


---

*Converted from `traversal.js` on 2026-05-27 14:13:10*


---
## js_engine_types.md

# types.js

**Original file:** `types.js`

**File type:** .JS

**Size:** 4,486 bytes

**Last modified:** 2026-05-05 21:29:28


---

## Content

```javascript
/**
 * @file types.js
 * JSDoc type definitions shared across the calculation and validation engines.
 * No runtime code â€” import this file for IDE type hints only.
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

```


---

*Converted from `types.js` on 2026-05-27 14:13:10*


---
## js_engine_validationPass1.md

# validationPass1.js

**Original file:** `validationPass1.js`

**File type:** .JS

**Size:** 8,937 bytes

**Last modified:** 2026-05-03 22:45:27


---

## Content

```javascript
/**
 * @file validationPass1.js
 * Pass 1 â€” structural validation.
 * Operates on the raw node tree with no space/dimension context.
 * Catches all errors that can be detected from tree shape and metadata alone.
 * Returns ValidationError[]. Non-empty result blocks Pass 2 entirely.
 */

const VALID_TYPES   = new Set(['fresh', 'freezer', 'flex']);
const VALID_MODES   = new Set(['ratio', 'explicit']);
const MAX_LEAVES    = 8;
const RATIO_TOL     = 0.001;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Runs all Pass 1 structural checks on the root node.
 * @param {import('./types').Node} rootNode
 * @returns {import('./types').ValidationError[]}
 */
export function validateStructure(rootNode) {
  const errors = [];

  // Global: leaf count
  const leafCount = countLeaves(rootNode);
  if (leafCount > MAX_LEAVES) {
    errors.push({
      rule:    'maxLeaves',
      message: `${leafCount} leaves exceed maximum of ${MAX_LEAVES}`,
    });
  }

  // Recursive structural checks
  walkStructure(rootNode, errors);

  return errors;
}

// ---------------------------------------------------------------------------
// Leaf counting
// ---------------------------------------------------------------------------

/**
 * Counts all leaf nodes in the tree recursively.
 * @param {import('./types').Node} node
 * @returns {number}
 */
export function countLeaves(node) {
  if (node.nodeType === 'leaf') return 1;
  if (node.nodeType === 'vertical') {
    return countLeaves(node.left) + countLeaves(node.right);
  }
  if (node.nodeType === 'horizontal') {
    return node.children.reduce((sum, c) => sum + countLeaves(c.node), 0);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Recursive structural walk
// ---------------------------------------------------------------------------

/**
 * Walks the tree and collects structural errors into the errors array.
 * @param {import('./types').Node} node
 * @param {import('./types').ValidationError[]} errors
 */
function walkStructure(node, errors) {
  if (!node || typeof node !== 'object') {
    errors.push({ rule: 'malformedNode', message: 'Node is null or not an object' });
    return;
  }

  switch (node.nodeType) {
    case 'leaf':
      checkLeafStructure(node, errors);
      break;
    case 'horizontal':
      checkHorizontalShape(node, errors);
      checkHeightRatios(node, errors);
      for (const child of node.children) walkStructure(child.node, errors);
      break;
    case 'vertical':
      checkVerticalShape(node, errors);
      walkStructure(node.left,  errors);
      walkStructure(node.right, errors);
      break;
    default:
      errors.push({
        rule:    'unknownNodeType',
        nodeId:  node.id,
        message: `Unknown nodeType: "${node.nodeType}"`,
      });
  }
}

// ---------------------------------------------------------------------------
// Per-node checkers
// ---------------------------------------------------------------------------

/**
 * @param {import('./types').LeafNode} node
 * @param {import('./types').ValidationError[]} errors
 */
function checkLeafStructure(node, errors) {
  checkEnums(node, errors);
  checkPositiveFittingValues(node, errors);
}

/**
 * Validates type enum and required fields on a leaf.
 * @param {import('./types').LeafNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkEnums(node, errors) {
  if (!VALID_TYPES.has(node.type)) {
    errors.push({
      rule:    'checkEnums',
      nodeId:  node.id,
      message: `Unknown compartment type: ${node.type}`,
    });
  }

  // Verify fittings object exists
  if (!node.fittings) {
    errors.push({
      rule:    'missingFittings',
      nodeId:  node.id,
      message: 'LeafNode is missing fittings object',
    });
  }
}

/**
 * Checks that all numeric dimension/volume values in fittings are > 0.
 * @param {import('./types').LeafNode} node
 * @param {import('./types').ValidationError[]} errors
 */
function checkPositiveFittingValues(node, errors) {
  if (!node.fittings) return;
  const f = node.fittings;

  for (const shelf of f.shelves ?? []) {
    checkPositive(shelf, ['positionFromFloor', 'thickness', 'depth'], errors, node.id);
    if (shelf.width != null) checkPositive(shelf, ['width'], errors, node.id);
  }
  for (const drawer of f.drawers ?? []) {
    checkPositive(drawer, ['outerWidth', 'outerDepth', 'outerHeight', 'wallThickness'], errors, node.id);
  }
  for (const bin of f.doorBins ?? []) {
    checkPositive(bin, ['outerWidth', 'outerHeight', 'outerDepth', 'wallThickness'], errors, node.id);
  }
  if (f.iceMakerHousing?.volume != null && f.iceMakerHousing.volume <= 0) {
    errors.push({ rule: 'positiveValues', nodeId: node.id,
      message: 'iceMakerHousing.volume must be > 0' });
  }
  if (f.lightHousing?.volume != null && f.lightHousing.volume <= 0) {
    errors.push({ rule: 'positiveValues', nodeId: node.id,
      message: 'lightHousing.volume must be > 0' });
  }
}

/**
 * @param {import('./types').HorizontalSplitNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkHorizontalShape(node, errors) {
  const { children, dividers, id } = node;

  // dividerCount: must be exactly children.length - 1
  const expectedDividers = children.length - 1;
  if (dividers.length !== expectedDividers) {
    errors.push({
      rule:    'dividerCount',
      nodeId:  id,
      message: `Expected ${expectedDividers} divider(s), found ${dividers.length}`,
    });
  }

  // afterChildIndex: unique, in range [0, children.length - 2]
  const seen = new Set();
  for (const d of dividers) {
    if (seen.has(d.afterChildIndex)) {
      errors.push({
        rule:    'afterChildIndex_unique',
        nodeId:  id,
        message: `Duplicate afterChildIndex: ${d.afterChildIndex}`,
      });
    }
    seen.add(d.afterChildIndex);

    if (d.afterChildIndex < 0 || d.afterChildIndex > children.length - 2) {
      errors.push({
        rule:    'afterChildIndex_range',
        nodeId:  id,
        message: `afterChildIndex ${d.afterChildIndex} out of range [0, ${children.length - 2}]`,
      });
    }
  }

  // heightMode_uniform: all children must use the same heightMode
  const modes = new Set(children.map(c => c.heightMode));
  if (modes.size > 1) {
    errors.push({
      rule:    'heightMode_uniform',
      nodeId:  id,
      message: 'Mixed heightMode in same HorizontalSplitNode',
    });
    return; // cannot check ratios if modes are mixed
  }

  // Validate each child has a known heightMode
  for (const child of children) {
    if (!VALID_MODES.has(child.heightMode)) {
      errors.push({
        rule:    'heightMode_unknown',
        nodeId:  id,
        message: `Unknown heightMode: "${child.heightMode}"`,
      });
    }
  }
}

/**
 * Checks ratio balance for HorizontalSplitNode children in ratio mode.
 * Must run after checkHorizontalShape (depends on uniform mode guarantee).
 * @param {import('./types').HorizontalSplitNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkHeightRatios(node, errors) {
  if (!node.children.length) return;
  const mode = node.children[0].heightMode;
  if (mode !== 'ratio') return; // explicit balance checked in Pass 2

  const sum = node.children.reduce((acc, c) => acc + c.heightValue, 0);
  if (Math.abs(sum - 1.0) > RATIO_TOL) {
    errors.push({
      rule:    'heightBalance_ratio',
      nodeId:  node.id,
      message: `Ratio sum ${sum.toFixed(4)} deviates from 1.0 by more than ${RATIO_TOL}`,
    });
  }
}

/**
 * @param {import('./types').VerticalSplitNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkVerticalShape(node, errors) {
  const { leftWidthRatio, dividerThickness, id } = node;

  if (leftWidthRatio <= 0 || leftWidthRatio >= 1) {
    errors.push({
      rule:    'leftWidthRatio_bounds',
      nodeId:  id,
      message: `leftWidthRatio must satisfy 0 < value < 1, got ${leftWidthRatio}`,
    });
  }

  if (dividerThickness <= 0) {
    errors.push({
      rule:    'positiveValues',
      nodeId:  id,
      message: `VerticalSplitNode dividerThickness must be > 0, got ${dividerThickness}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {Object} obj
 * @param {string[]} fields
 * @param {import('./types').ValidationError[]} errors
 * @param {string} nodeId
 */
function checkPositive(obj, fields, errors, nodeId) {
  for (const field of fields) {
    if (obj[field] <= 0) {
      errors.push({
        rule:    'positiveValues',
        nodeId,
        message: `${field} must be > 0, got ${obj[field]}`,
      });
    }
  }
}

```


---

*Converted from `validationPass1.js` on 2026-05-27 14:13:10*


---
## js_io_io.md

# io.js

**Original file:** `io.js`

**File type:** .JS

**Size:** 5,747 bytes

**Last modified:** 2026-05-03 22:45:45


---

## Content

```javascript
/**
 * @file src/io/io.js
 * I/O layer â€” JSON config save/load and CSV export.
 * No DOM dependencies. Works in browser (File API) and Node.js.
 */

import { formatLeafDisplay, formatTotalsDisplay, toCuft, roundForDisplay } from '../engine/calc.js';

const SCHEMA_VERSION = '1.0';

// ---------------------------------------------------------------------------
// JSON â€” Save
// ---------------------------------------------------------------------------

/**
 * Serialises a CabinetConfig to a JSON string ready for download.
 * Stamps updatedAt; preserves createdAt from original if present.
 *
 * @param {import('../engine/types').CabinetConfig} config
 * @param {string} [name] - optional label to set in meta.name
 * @returns {string} JSON string
 */
export function configToJSON(config, name) {
  const now = new Date().toISOString();
  const out = {
    ...config,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name:      name ?? config.meta?.name ?? 'Untitled',
      createdAt: config.meta?.createdAt ?? now,
      updatedAt: now,
    },
  };
  return JSON.stringify(out, null, 2);
}

/**
 * Triggers a browser file download of the config JSON.
 * No-op in Node.js environments.
 *
 * @param {import('../engine/types').CabinetConfig} config
 * @param {string} [filename]
 */
export function downloadConfigJSON(config, filename) {
  if (typeof document === 'undefined') return;
  const json = configToJSON(config);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename ?? `${config.meta?.name ?? 'config'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// JSON â€” Load
// ---------------------------------------------------------------------------

/**
 * Parses a JSON string into a CabinetConfig.
 * Validates schemaVersion. Throws on parse error or version mismatch.
 *
 * @param {string} jsonString
 * @returns {import('../engine/types').CabinetConfig}
 * @throws {Error}
 */
export function configFromJSON(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  if (!parsed.schemaVersion) {
    throw new Error('Missing schemaVersion in config file.');
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Schema version mismatch: file is v${parsed.schemaVersion}, expected v${SCHEMA_VERSION}.`
    );
  }
  if (!parsed.cabinet?.layout) {
    throw new Error('Config file is missing cabinet.layout.');
  }

  return parsed;
}

/**
 * Reads a File object and resolves with a parsed CabinetConfig.
 * Browser only.
 *
 * @param {File} file
 * @returns {Promise<import('../engine/types').CabinetConfig>}
 */
export function loadConfigFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      try { resolve(configFromJSON(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// CSV â€” Export
// ---------------------------------------------------------------------------

/**
 * Builds a CSV string from a CalcResult.
 * Columns: Compartment, Type, Gross (L), EG Net (L), IEC Net (L),
 *          Gross (cu.ft), EG Net (cu.ft), IEC Net (cu.ft)
 * Final row: TOTAL.
 *
 * @param {import('../engine/types').CalcResult} result
 * @param {string} [configName]
 * @returns {string} CSV string
 */
export function resultToCSV(result, configName) {
  if (!result.leaves || !result.totals) {
    return '# No results available (calculation produced errors)\n';
  }

  const rows = [];

  // Header block
  rows.push(`# Refrigerator Net Storage Volume Calculator`);
  rows.push(`# Configuration: ${configName ?? 'Unnamed'}`);
  rows.push(`# Generated: ${new Date().toISOString()}`);
  rows.push('');

  // Column headers
  rows.push([
    'Compartment',
    'Type',
    'Gross (L)',
    'EG Net (L)',
    'IEC Net (L)',
    'Gross (cu.ft)',
    'EG Net (cu.ft)',
    'IEC Net (cu.ft)',
  ].join(','));

  // Per-leaf rows
  for (let i = 0; i < result.leaves.length; i++) {
    const leaf = result.leaves[i];
    const d    = formatLeafDisplay(leaf);
    rows.push([
      `Compartment ${i + 1}`,
      leaf.leafType,
      d.gross,
      d.egNet,
      d.iecNet,
      d.grossCuft,
      d.egNetCuft,
      d.iecNetCuft,
    ].join(','));
  }

  // Totals row
  const t = formatTotalsDisplay(result.totals);
  rows.push([
    'TOTAL',
    '',
    t.gross,
    t.egNet,
    t.iecNet,
    t.grossCuft,
    t.egNetCuft,
    t.iecNetCuft,
  ].join(','));

  // Warnings block
  if (result.warnings.length > 0) {
    rows.push('');
    rows.push('# Warnings');
    for (const w of result.warnings) {
      rows.push(`# [${w.rule}] ${w.message}`);
    }
  }

  return rows.join('\n');
}

/**
 * Triggers a browser file download of the results CSV.
 * No-op in Node.js environments.
 *
 * @param {import('../engine/types').CalcResult} result
 * @param {string} [configName]
 * @param {string} [filename]
 */
export function downloadResultsCSV(result, configName, filename) {
  if (typeof document === 'undefined') return;
  const csv  = resultToCSV(result, configName);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename ?? `${configName ?? 'results'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

```


---

*Converted from `io.js` on 2026-05-27 14:13:10*


---
## js_main.md

# main.js

**Original file:** `main.js`

**File type:** .JS

**Size:** 31,891 bytes

**Last modified:** 2026-05-17 22:35:46


---

## Content

```javascript
import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawFrontView, drawSideView } from './ui/schematic.js';
import { initSettingsModal, showModal } from './ui/settingsModal.js';
import { settings } from './settings.js';
import { formatTotalsDisplay, formatLeafDisplay, walkBoundaries, roundForDisplay } from './engine/calc.js';
import { initThermoUI } from './ui/thermoUI.js';
import { DEFAULT_CABINET, toVolumeFormat, toThermalFormat, upgradeConfig } from './engine/geometry.js';

// ---- DOM references ---------------------------------------------------
const divHorizInput       = document.getElementById('divHoriz');
const usableFactorInput   = document.getElementById('usableFactor');
const numCompartmentsInput= document.getElementById('numCompartments');
const compartmentBuilder  = document.getElementById('compartmentBuilder');
const calculateBtn        = document.getElementById('calculateBtn');
const saveBtn             = document.getElementById('saveBtn');
const loadBtn             = document.getElementById('loadBtn');
const exportBtn           = document.getElementById('exportBtn');
const messagesDiv         = document.getElementById('messages');
const messagesFieldset    = document.getElementById('messagesFieldset');
const schematicOverlay    = document.getElementById('schematicOverlay');
const schematicTooltip    = document.getElementById('schematicTooltip');
const settingsBtn         = document.getElementById('settingsBtn');
const resetAllBtn         = document.getElementById('resetAllBtn');
const storeSlotABtn       = document.getElementById('storeSlotABtn');
const storeSlotBBtn       = document.getElementById('storeSlotBBtn');
const compareSlotsBtn     = document.getElementById('compareSlotsBtn');
const comparisonModal     = document.getElementById('comparisonModal');
const closeComparison     = document.getElementById('closeComparison');
const comparisonContent   = document.getElementById('comparisonContent');
const splitter            = document.getElementById('splitter');
const leftPanel           = document.querySelector('.left-panel');

let configSlotA = null;
let configSlotB = null;
let currentConfig = null;
let dirtySchematic = false;
let isResizing = false;
let startX, startWidth;

// Splitter logic
splitter.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = leftPanel.getBoundingClientRect().width;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const delta = e.clientX - startX;
  const newWidth = Math.max(300, Math.min(800, startWidth + delta));
  leftPanel.style.flex = `0 0 ${newWidth}px`;
});
document.addEventListener('mouseup', () => {
  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

// ---- Shared cabinet geometry ------------------------------------------
let currentGeometry = { ...DEFAULT_CABINET };

// ---- Compartment reactive state ---------------------------------------
let compartmentsData = [];

fillGeometryDefaults();

// Dedicated listeners for geometry fields that affect internal height
['geom-H', 'geom-bottom3'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    syncConstraints();
    syncDisplay();
    markDirty();
  });
});

// Divider thickness changes also affect compartment heights
divHorizInput.addEventListener('input', () => {
  syncConstraints();
  syncDisplay();
  markDirty();
});

initCompartments();

function initCompartments() {
  const count = parseInt(numCompartmentsInput.value) || 1;
  compartmentsData = [];
  const defaultWalls = { top: 60, left: 60, right: 60, rear: 60, door: 60 };
  for (let i = 0; i < count; i++) {
    compartmentsData.push({
      type: i === 0 ? 'freezer' : 'fresh',
      ...defaultWalls,
      height: 0,
      ratio: i === 0 ? 0.4 : 0.6
    });
  }
  syncConstraints();
  buildCompartmentUI();
}

function syncConstraints() {
  const count = compartmentsData.length;
  const H = parseFloat(document.getElementById('geom-H')?.value) || 1680;
  const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
  const totalInsulTop = compartmentsData[0].top;
  const totalInsulBottom = parseFloat(document.getElementById('geom-bottom3')?.value) || 40;
  let internalH = H - totalInsulTop - totalInsulBottom - (count - 1) * dividerThick;
  if (internalH < 0) internalH = 0;
  if (internalH === 0) {
    compartmentsData[0].height = 0;
    compartmentsData[1].height = 0;
    compartmentsData[0].ratio = 0.5;
    compartmentsData[1].ratio = 0.5;
    return;
  }
  if (count === 1) {
    compartmentsData[0].height = internalH;
    compartmentsData[0].ratio = 1.0;
    return;
  }

  // Two compartments
  let h0 = compartmentsData[0].height;
  let h1 = compartmentsData[1].height;

  if (h0 === 0 && h1 === 0) {
    const r0 = Math.max(0.1, Math.min(0.9, compartmentsData[0].ratio));
    h0 = internalH * r0;
    h1 = internalH * (1 - r0);
  } else if (h0 !== 0 && h1 !== 0) {
    const sum = h0 + h1;
    if (Math.abs(sum - internalH) > 0.01) {
      h0 = Math.max(0.1 * internalH, Math.min(0.9 * internalH, h0));
      h1 = internalH - h0;
    }
  } else if (h0 !== 0) {
    h0 = Math.max(0.1 * internalH, Math.min(0.9 * internalH, h0));
    h1 = internalH - h0;
  } else if (h1 !== 0) {
    h1 = Math.max(0.1 * internalH, Math.min(0.9 * internalH, h1));
    h0 = internalH - h1;
  }

  compartmentsData[0].height = h0;
  compartmentsData[1].height = h1;
  compartmentsData[0].ratio = h0 / internalH;
  compartmentsData[1].ratio = h1 / internalH;
}

function onCompFieldChange(compIdx, field, value) {
  if (isNaN(value)) return;
  compartmentsData[compIdx][field] = value;

  if (field === 'height' || field === 'ratio') {
    const count = compartmentsData.length;
    const H = parseFloat(document.getElementById('geom-H')?.value) || 1680;
    const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
    const topInsul = compartmentsData[0].top;
    const bottomInsul = parseFloat(document.getElementById('geom-bottom3')?.value) || 40;
    const internalH = H - topInsul - bottomInsul - (count - 1) * dividerThick;

    if (count === 1) {
      compartmentsData[0].height = internalH;
      compartmentsData[0].ratio = 1.0;
    } else {
      if (field === 'height') {
        const minH = 0.1 * internalH;
        const maxH = 0.9 * internalH;
        let clamped = Math.max(minH, Math.min(maxH, value));
        compartmentsData[compIdx].height = clamped;
        const otherIdx = 1 - compIdx;
        compartmentsData[otherIdx].height = internalH - clamped;
        compartmentsData[0].ratio = compartmentsData[0].height / internalH;
        compartmentsData[1].ratio = 1.0 - compartmentsData[0].ratio;
      } else { // ratio changed (percentage)
        let percent = Math.max(10, Math.min(count === 1 ? 100 : 90, value));
        let clamped = percent / 100;
        compartmentsData[compIdx].ratio = clamped;
        compartmentsData[compIdx].height = internalH * clamped;
        const otherIdx = 1 - compIdx;
        compartmentsData[otherIdx].ratio = 1.0 - clamped;
        compartmentsData[otherIdx].height = internalH - compartmentsData[compIdx].height;
      }
    }
  }

  if (field === 'type' && compartmentsData.length > 1) {
    const otherIdx = 1 - compIdx;
    compartmentsData[otherIdx].type = value === 'freezer' ? 'fresh' : 'freezer';
  }

  syncDisplay();

  if (settings.autoCalculate) {
    calculateBtn.click();
  }
}

function syncDisplay() {
  const count = compartmentsData.length;
  for (let i = 0; i < count; i++) {
    const d = compartmentsData[i];
    const heightInput = document.getElementById(`comp-${i}-height`);
    const ratioInput  = document.getElementById(`comp-${i}-ratio`);
    const typeSelect  = document.getElementById(`comp-${i}-type`);
    if (heightInput) heightInput.value = d.height.toFixed(1);
    if (ratioInput) {
      ratioInput.value = count === 1 ? 100 : (d.ratio * 100).toFixed(0);
    }
    if (typeSelect) typeSelect.value = d.type;
  }
}

function buildCompartmentUI() {
  const builder = document.getElementById('compartmentBuilder');
  builder.innerHTML = '';

  const count = compartmentsData.length;
  const dividerLabel = document.getElementById('dividerLabel');
  if (dividerLabel) dividerLabel.style.display = count > 1 ? '' : 'none';

  for (let i = 0; i < count; i++) {
    const d = compartmentsData[i];
    const ratioMin = count === 1 ? 100 : 10;
    const ratioMax = count === 1 ? 100 : 90;
    const ratioVal = count === 1 ? 100 : Math.round(d.ratio * 100);

    const fieldset = document.createElement('fieldset');
    fieldset.innerHTML = `
      <legend>Compartment ${i+1}</legend>
      <label>Type:
        <select id="comp-${i}-type">
          <option value="freezer" ${d.type === 'freezer' ? 'selected' : ''}>Freezer</option>
          <option value="fresh"  ${d.type === 'fresh'  ? 'selected' : ''}>Fresh</option>
        </select>
      </label>
      <label>Height (mm): <input type="number" id="comp-${i}-height" step="any" value="${d.height.toFixed(1)}"></label>
      <label>Ratio (%): <input type="number" id="comp-${i}-ratio" step="1" min="${ratioMin}" max="${ratioMax}" value="${ratioVal}"></label>
      <fieldset>
        <legend>Wall Thicknesses (mm)</legend>
        <label>Top:    <input type="number" id="comp-${i}-top"    value="${d.top}"    step="any"></label>
        <label>Left:   <input type="number" id="comp-${i}-left"   value="${d.left}"   step="any"></label>
        <label>Right:  <input type="number" id="comp-${i}-right"  value="${d.right}"  step="any"></label>
        <label>Rear:   <input type="number" id="comp-${i}-rear"   value="${d.rear}"   step="any"></label>
        <label>Door:   <input type="number" id="comp-${i}-door"   value="${d.door}"   step="any"></label>
      </fieldset>
    `;
    builder.appendChild(fieldset);
  }

  // Attach listeners
  for (let i = 0; i < count; i++) {
    document.getElementById(`comp-${i}-type`).addEventListener('change', (e) => {
      onCompFieldChange(i, 'type', e.target.value);
    });
    document.getElementById(`comp-${i}-height`).addEventListener('change', (e) => {
      onCompFieldChange(i, 'height', parseFloat(e.target.value) || 0);
    });
    document.getElementById(`comp-${i}-ratio`).addEventListener('change', (e) => {
      onCompFieldChange(i, 'ratio', parseFloat(e.target.value) || 10);
    });
    for (const face of ['top','left','right','rear','door']) {
      document.getElementById(`comp-${i}-${face}`).addEventListener('input', (e) => {
        compartmentsData[i][face] = parseFloat(e.target.value) || 0;
        syncConstraints();
        syncDisplay();
        markDirty();
      });
    }
  }
}

function fillGeometryDefaults() {
  const def = DEFAULT_CABINET;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('geom-H', def.H);
  set('geom-W', def.W);
  set('geom-D', def.D);
  set('geom-Hb', def.Hb);
  set('geom-Db1', def.Db1);
  set('geom-Db2', def.Db2);
  set('geom-packingPos', def.packingPos);
  set('geom-doorGap', def.doorGap);
  set('geom-bottom1', 40);
  set('geom-bottom2', 40);
  set('geom-bottom3', 40);
}

// ---- Read geometry from panel -----------------------------------------
function readGeometryFromPanel() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
  const comps = compartmentsData;
  const count = comps.length;
  const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 20 : 0;

  let freezerComp = comps.find(c => c.type === 'freezer');
  let freshComp   = comps.find(c => c.type === 'fresh');

  const defWalls = { top: 60, left: 60, right: 60, rear: 60, door: 60 };

  const walls = {
    freezer: {
      top:    freezerComp ? freezerComp.top    : defWalls.top,
      bottom: freshComp   ? dividerThick       : 0,
      left:   freezerComp ? freezerComp.left   : defWalls.left,
      right:  freezerComp ? freezerComp.right  : defWalls.right,
      door:   freezerComp ? freezerComp.door   : defWalls.door,
      rear:   freezerComp ? freezerComp.rear   : defWalls.rear,
    },
    refrigerator: {
      top:    freshComp ? (freezerComp ? dividerThick : freshComp.top) : defWalls.top,
      bottom1: g('geom-bottom1') ?? 40,
      bottom2: g('geom-bottom2') ?? 40,
      bottom3: g('geom-bottom3') ?? 40,
      left:   freshComp ? freshComp.left   : defWalls.left,
      right:  freshComp ? freshComp.right  : defWalls.right,
      door:   freshComp ? freshComp.door   : defWalls.door,
      rear:   freshComp ? freshComp.rear   : defWalls.rear,
    }
  };

  return {
    H: g('geom-H') ?? DEFAULT_CABINET.H,
    W: g('geom-W') ?? DEFAULT_CABINET.W,
    D: g('geom-D') ?? DEFAULT_CABINET.D,
    Hb: g('geom-Hb') ?? DEFAULT_CABINET.Hb,
    Db1: g('geom-Db1') ?? DEFAULT_CABINET.Db1,
    Db2: g('geom-Db2') ?? DEFAULT_CABINET.Db2,
    doorGap: g('geom-doorGap') ?? DEFAULT_CABINET.doorGap,
    packingPos: g('geom-packingPos') ?? DEFAULT_CABINET.packingPos,
    airGap: 0,
    Hf: freezerComp ? freezerComp.height : 0,
    Hr: freshComp   ? freshComp.height   : 0,
    walls,
    _compartments: comps
  };
}

function getEffectiveThicknesses() {
  const comps = compartmentsData;
  const topComp = comps[0];
  const bottomComp = comps.length > 1 ? comps[1] : comps[0];
  const bottom1 = parseFloat(document.getElementById('geom-bottom1')?.value) || 40;
  const bottom2 = parseFloat(document.getElementById('geom-bottom2')?.value) || 40;
  const bottom3 = parseFloat(document.getElementById('geom-bottom3')?.value) || 40;

  return {
    top:    topComp.top,
    bottom: Math.max(bottom1, bottom2, bottom3),
    left:   Math.max(topComp.left, bottomComp.left),
    right:  Math.max(topComp.right, bottomComp.right),
    rear:   Math.max(topComp.rear, bottomComp.rear),
    door:   Math.max(topComp.door, bottomComp.door),
  };
}

// ---- Mark schematic dirty ---------------------------------------------
function markDirty() {
  dirtySchematic = true;
  if (settings.showDirtyOverlay) {
    schematicOverlay.classList.remove('hidden');
  } else {
    schematicOverlay.classList.add('hidden');
  }
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', markDirty));

// ---- Compartment builder init -----------------------------------------
numCompartmentsInput.addEventListener('input', () => {
  markDirty();
  initCompartments();
});

// ---- Volume calculation -----------------------------------------------
function buildConfigFromForm() {
  currentGeometry = readGeometryFromPanel();
  const volumeGeom = toVolumeFormat(currentGeometry);

  const count = compartmentsData.length;
  const leaves = [];

  for (let i = 0; i < count; i++) {
    const comp = compartmentsData[i];
    leaves.push({
      heightMode: 'ratio',
      heightValue: comp.ratio,
      node: {
        nodeType: 'leaf',
        id: `comp${i}`,
        type: comp.type,
        fittings: {
          shelves: [],
          drawers: [],
          doorBins: [],
          iceMakerHousing: { volume: null },
          lightHousing:    { volume: null },
        },
      },
    });
  }

  const rootNode = {
    nodeType: 'horizontal',
    id: 'root',
    children: leaves.map(l => ({ heightMode: l.heightMode, heightValue: l.heightValue, node: l.node })),
    dividers: count > 1 ? [{ afterChildIndex: 0, thickness: parseFloat(divHorizInput.value) || 20 }] : [],
  };

  const cabinet = {
    geometry: currentGeometry,
    layout: rootNode
  };

  return {
    config: {
      schemaVersion: '2.0',
      meta: { name: 'UI Config', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      cabinet
    },
    layout: rootNode
  };
}

// ---- Display messages -------------------------------------------------
function showMessages(errors, warnings, calcErrors) {
  messagesDiv.innerHTML = '';
  const all = [
    ...errors.map(e => `<p class="error">âŒ ${e.message}</p>`),
    ...warnings.map(w => `<p class="warning">âš ï¸ ${w.message}</p>`),
    ...calcErrors.map(e => `<p class="error">ðŸ”§ ${e.message}</p>`),
  ];
  if (all.length) {
    messagesDiv.innerHTML = all.join('');
    messagesFieldset.style.display = 'block';
  } else {
    messagesFieldset.style.display = 'none';
  }
}
function computeAccurateBottomVolume(geom, eff, bottomCompHeight_mm) {
  const { H, D, Hb, Db1, Db2, walls } = geom;
  const rearX = eff.rear;
  const doorX = D - eff.door;
  const innerTop = eff.top;

  // yâ€‘position of the top of the bottom compartment
  const topCompH = compartmentsData.length > 1 ? compartmentsData[0].height : 0;
  const divider  = compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
  const yTopBottom = innerTop + topCompH + divider;

  const yBottomRear = H - Hb - walls.refrigerator.bottom1;   // raised floor (inner surface)
  const yBottomDoor = H - walls.refrigerator.bottom3;        // lower floor (inner surface)

  const slopeStartX = rearX + Db1;                           // top of slope
  const slopeEndX   = rearX + Db2;                           // foot of slope

  // Shoelace formula for the cavity crossâ€‘section (mmÂ²)
  const points = [
    [rearX,        yTopBottom],
    [doorX,        yTopBottom],
    [doorX,        yBottomDoor],
    [slopeEndX,    yBottomDoor],
    [slopeStartX,  yBottomRear],
    [rearX,        yBottomRear]
  ];
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  area = Math.abs(area) / 2;

  const width = geom.W - eff.left - eff.right;
  return area * width * settings.mm3ToL;   // litres
}
// ---- Calculate button -------------------------------------------------
calculateBtn.addEventListener('click', () => {
  const { config, layout } = buildConfigFromForm();
  currentConfig = config;
  if (currentConfig) {
    storeSlotABtn.style.display = 'inline-block';
    storeSlotBBtn.style.display = 'inline-block';
    compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';
  }

  const result = runCalculation(config);

  if (result.leaves && result.totals) {
    // Replace the bottom leaf with the accurate steppedâ€‘floor cavity volume
    const eff = getEffectiveThicknesses();
    const bottomIdx = result.leaves.length - 1;
    const bottomCompHeight = compartmentsData[bottomIdx].height;
    const accurateBottomVol = computeAccurateBottomVolume(currentGeometry, eff, bottomCompHeight);

    const bottomLeaf = result.leaves[bottomIdx];
    const oldBottomVol = bottomLeaf.gross;
    bottomLeaf.gross = accurateBottomVol;
    result.totals.gross = result.totals.gross - oldBottomVol + accurateBottomVol;

    // Display
    const disp = formatTotalsDisplay(result.totals);
    document.getElementById('grossVol').textContent      = disp.gross;
    document.getElementById('grossVolCuft').textContent  = disp.grossCuft;

    const usableFactor = parseFloat(usableFactorInput?.value) || 97;
    const usableL = result.totals.gross * (usableFactor / 100);
    const usableCuft = usableL * settings.lToCuft;
    document.getElementById('usableVol').textContent      = roundForDisplay(usableL, 'L');
    document.getElementById('usableVolCuft').textContent  = roundForDisplay(usableCuft, 'cuft');
  }
    showMessages(result.validationErrors, result.warnings, result.calcErrors);

  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (frontCanvas && sideCanvas) {
    const rightPanel = document.querySelector('.right-panel');
    const panelHeight = rightPanel.clientHeight - 30;
    const panelWidth  = rightPanel.clientWidth - 20;
    frontCanvas.height = panelHeight;
    sideCanvas.height  = panelHeight;
    frontCanvas.width  = panelWidth / 2 - 5;
    sideCanvas.width   = panelWidth / 2 - 5;

    const effectiveWalls = getEffectiveThicknesses();
    const drawOptions = {
      dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
      compHeights: compartmentsData.map(c => c.height),
      doorGap: parseFloat(document.getElementById('geom-doorGap')?.value) || 10,
      compartments: compartmentsData.map(c => ({
        left: c.left,
        right: c.right,
        rear: c.rear
      })),
    };

    drawFrontView(frontCanvas, currentGeometry, effectiveWalls, layout, result.leaves, drawOptions);
    drawSideView(sideCanvas, currentGeometry, effectiveWalls, drawOptions);
    dirtySchematic = false;
    schematicOverlay.classList.add('hidden');
  }
});

// ---- Save / Load / Export ---------------------------------------------
saveBtn.addEventListener('click', () => {
  if (!currentConfig) { alert('Calculate first'); return; }
  downloadConfigJSON(currentConfig, currentConfig.meta.name);
});

loadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const config = await loadConfigFromFile(file);
      currentConfig = config;
      if (currentConfig) {
        storeSlotABtn.style.display = 'inline-block';
        storeSlotBBtn.style.display = 'inline-block';
        compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';
      }
      populateUIFromConfig(config);

      const result = runCalculation(config);
  if (result.leaves && result.totals) {
    // Replace the bottom leaf with the accurate steppedâ€‘floor cavity volume
    const eff = getEffectiveThicknesses();
    const bottomIdx = result.leaves.length - 1;
    const bottomCompHeight = compartmentsData[bottomIdx].height;
    const accurateBottomVol = computeAccurateBottomVolume(currentGeometry, eff, bottomCompHeight);

    const bottomLeaf = result.leaves[bottomIdx];
    const oldBottomVol = bottomLeaf.gross;
    bottomLeaf.gross = accurateBottomVol;
    result.totals.gross = result.totals.gross - oldBottomVol + accurateBottomVol;

    // Display
    const disp = formatTotalsDisplay(result.totals);
    document.getElementById('grossVol').textContent      = disp.gross;
    document.getElementById('grossVolCuft').textContent  = disp.grossCuft;

    const usableFactor = parseFloat(usableFactorInput?.value) || 97;
    const usableL = result.totals.gross * (usableFactor / 100);
    const usableCuft = usableL * settings.lToCuft;
    document.getElementById('usableVol').textContent      = roundForDisplay(usableL, 'L');
    document.getElementById('usableVolCuft').textContent  = roundForDisplay(usableCuft, 'cuft');
  }
        showMessages(result.validationErrors, result.warnings, result.calcErrors);

      const frontCanvas = document.getElementById('schematicFront');
      const sideCanvas  = document.getElementById('schematicSide');
      if (frontCanvas && sideCanvas && result.leaves) {
        const rightPanel = document.querySelector('.right-panel');
        const panelHeight = rightPanel.clientHeight - 30;
        const panelWidth  = rightPanel.clientWidth - 20;
        frontCanvas.height = panelHeight;
        sideCanvas.height  = panelHeight;
        frontCanvas.width  = panelWidth / 2 - 5;
        sideCanvas.width   = panelWidth / 2 - 5;

        const effectiveWalls = getEffectiveThicknesses();
        const drawOptions = {
          dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
          compHeights: compartmentsData.map(c => c.height),
          doorGap: parseFloat(document.getElementById('geom-doorGap')?.value) || 10,
          compartments: compartmentsData.map(c => ({
            left: c.left,
            right: c.right,
            rear: c.rear
          })),
        };
        drawFrontView(frontCanvas, currentGeometry, effectiveWalls, config.cabinet.layout, result.leaves, drawOptions);
        drawSideView(sideCanvas, currentGeometry, effectiveWalls, drawOptions);
        dirtySchematic = false;
        schematicOverlay.classList.add('hidden');
      }

      alert('Configuration loaded and calculated.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  input.click();
});

exportBtn.addEventListener('click', () => {
  if (!currentConfig) { alert('Calculate first'); return; }
  const result = runCalculation(currentConfig);
  downloadResultsCSV(result, currentConfig.meta.name);
});

// ---- Settings Modal --------------------------------------------------
initSettingsModal();
settingsBtn.addEventListener('click', showModal);

// ---- Reset All ---------------------------------------------------------
resetAllBtn.addEventListener('click', () => {
  if (!confirm('Reset all fields to default values and clear results?')) return;

  currentGeometry = { ...DEFAULT_CABINET };
  document.getElementById('geom-H').value = DEFAULT_CABINET.H;
  document.getElementById('geom-W').value = DEFAULT_CABINET.W;
  document.getElementById('geom-D').value = DEFAULT_CABINET.D;
  document.getElementById('geom-Hb').value = DEFAULT_CABINET.Hb;
  document.getElementById('geom-Db1').value = DEFAULT_CABINET.Db1;
  document.getElementById('geom-Db2').value = DEFAULT_CABINET.Db2;
  document.getElementById('geom-packingPos').value = DEFAULT_CABINET.packingPos;
  document.getElementById('geom-doorGap').value = DEFAULT_CABINET.doorGap;
  document.getElementById('geom-bottom1').value = 40;
  document.getElementById('geom-bottom2').value = 40;
  document.getElementById('geom-bottom3').value = 40;
  divHorizInput.value = 20;
  numCompartmentsInput.value = 2;

  initCompartments();

  document.getElementById('grossVol').textContent      = '--';
  document.getElementById('grossVolCuft').textContent  = '--';
  document.getElementById('usableVol').textContent      = '--';
  document.getElementById('usableVolCuft').textContent  = '--';

  messagesDiv.innerHTML = '';
  messagesFieldset.style.display = 'none';

  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (frontCanvas) frontCanvas.getContext('2d').clearRect(0, 0, frontCanvas.width, frontCanvas.height);
  if (sideCanvas) sideCanvas.getContext('2d').clearRect(0, 0, sideCanvas.width, sideCanvas.height);

  schematicOverlay.classList.add('hidden');
  dirtySchematic = false;
  currentConfig = null;
});

// ---- Autoâ€‘calculate & settings change handler ------------------------
document.addEventListener('input', (e) => {
  if (settings.autoCalculate && e.target.closest('.left-panel')) {
    calculateBtn.click();
  }
});

document.addEventListener('settings-changed', () => {
  if (settings.autoCalculate && currentConfig) {
    calculateBtn.click();
  } else {
    markDirty();
  }
});

// ---- Slot storage -----------------------------------------------------
storeSlotABtn.addEventListener('click', () => {
  if (!currentConfig) return;
  configSlotA = JSON.parse(JSON.stringify(currentConfig));
  alert('Configuration stored in Slot A.');
  compareSlotsBtn.style.display = 'inline-block';
});

storeSlotBBtn.addEventListener('click', () => {
  if (!currentConfig) return;
  configSlotB = JSON.parse(JSON.stringify(currentConfig));
  alert('Configuration stored in Slot B.');
  compareSlotsBtn.style.display = 'inline-block';
});

// ---- Compare Slots ----------------------------------------------------
compareSlotsBtn.addEventListener('click', () => {
  if (!configSlotA && !configSlotB) {
    alert('No stored configurations to compare.');
    return;
  }
  let resultA = null, resultB = null;
  if (configSlotA) resultA = runCalculation(configSlotA);
  if (configSlotB) resultB = runCalculation(configSlotB);
  buildComparisonTable(resultA, resultB);
  comparisonModal.classList.remove('hidden');
});

closeComparison.addEventListener('click', () => { comparisonModal.classList.add('hidden'); });
window.addEventListener('click', (e) => { if (e.target === comparisonModal) comparisonModal.classList.add('hidden'); });

function buildComparisonTable(resultA, resultB) {
  if (!resultA && !resultB) { comparisonContent.innerHTML = '<p>No configurations stored.</p>'; return; }
  const hasLeavesA = resultA && resultA.leaves && resultA.totals;
  const hasLeavesB = resultB && resultB.leaves && resultB.totals;
  const fmtTotals = (totals) => {
    if (!totals) return { gross:'-', usable:'-', grossCuft:'-', usableCuft:'-' };
    const usableFactor = parseFloat(usableFactorInput?.value) || 97;
    return {
      gross: roundForDisplay(totals.gross, 'L'),
      usable: roundForDisplay(totals.gross * (usableFactor / 100), 'L'),
      grossCuft: roundForDisplay(totals.gross * settings.lToCuft, 'cuft'),
      usableCuft: roundForDisplay(totals.gross * (usableFactor / 100) * settings.lToCuft, 'cuft'),
    };
  };
  const tA = fmtTotals(hasLeavesA ? resultA.totals : null);
  const tB = fmtTotals(hasLeavesB ? resultB.totals : null);
  let html = `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <thead><tr><th></th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Litres</th><th>cu.ft.</th><th>Litres</th><th>cu.ft.</th></tr></thead>
      <tbody>
      <tr><td><strong>Gross</strong></td><td>${tA.gross}</td><td>${tA.grossCuft}</td><td>${tB.gross}</td><td>${tB.grossCuft}</td></tr>
      <tr><td><strong>Usable</strong></td><td>${tA.usable}</td><td>${tA.usableCuft}</td><td>${tB.usable}</td><td>${tB.usableCuft}</td></tr>
      </tbody></table>`;
  if (hasLeavesA && resultA.leaves.length > 0 && hasLeavesB && resultB.leaves.length > 0) {
    html += `<h3>Perâ€‘Compartment Breakdown</h3>`;
    const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
    html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <tr><th>Compartment</th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Gross</th><th>Usable</th><th>Gross</th><th>Usable</th></tr>`;
    for (let i = 0; i < maxLeaves; i++) {
      const leafA = resultA.leaves[i], leafB = resultB.leaves[i];
      const fmtA = leafA ? {
        gross: roundForDisplay(leafA.gross, 'L'),
        usable: roundForDisplay(leafA.gross * (parseFloat(usableFactorInput?.value) || 97) / 100, 'L'),
      } : { gross:'-', usable:'-' };
      const fmtB = leafB ? {
        gross: roundForDisplay(leafB.gross, 'L'),
        usable: roundForDisplay(leafB.gross * (parseFloat(usableFactorInput?.value) || 97) / 100, 'L'),
      } : { gross:'-', usable:'-' };
      html += `<tr><td>Comp ${i+1}</td><td>${fmtA.gross}</td><td>${fmtA.usable}</td><td>${fmtB.gross}</td><td>${fmtB.usable}</td></tr>`;
    }
    html += `</table>`;
  }
  comparisonContent.innerHTML = html;
}

// Thermo UI init with geometry provider
initThermoUI(() => readGeometryFromPanel());
```


---

*Converted from `main.js` on 2026-05-27 14:13:09*


---
## js_settings.md

# settings.js

**Original file:** `settings.js`

**File type:** .JS

**Size:** 1,371 bytes

**Last modified:** 2026-05-04 14:38:09


---

## Content

```javascript
const DEFAULTS = {
  iceMakerRemovable: true,       // deduct from EG Net if true
  lightRemovable: true,          // deduct from EG Net if true
  iecFactor: 0.97,               // IEC fixed deduction factor
  mm3ToL: 1e-6,
  lToCuft: 0.0353147,
  displayPrecisionL: 2,
  displayPrecisionCuft: 3,
  canvasWidth: 600,
  canvasHeight: 800,
  autoCalculate: false,          // autoâ€‘run calculate on input change
  showDirtyOverlay: true,
};

const STORAGE_KEY = 'refrigerator-calc-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULTS };
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const settings = loadSettings();

export function updateSettings(newSettings) {
  Object.assign(settings, newSettings);
  saveSettings(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  saveSettings(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

export function getSettings() {
  return { ...settings };
}

```


---

*Converted from `settings.js` on 2026-05-27 14:13:09*


---
## js_ui_schematic.md

# schematic.js

**Original file:** `schematic.js`

**File type:** .JS

**Size:** 17,532 bytes

**Last modified:** 2026-05-17 05:54:14


---

## Content

```javascript
/**
 * Draw a dimension line with extension lines, arrows, and label.
 * Styled to standard CAD drafting representation.
 */
function drawDim(ctx, x1, y1, x2, y2, offset, label, {
  color = '#2980b9',
  lineWidth = 1,
  arrowSize = 5,
  font = 'bold 11px "Segoe UI", Arial, sans-serif',
  textOffsetX = 0,
  textOffsetY = 0,
  drawExtLines = true
} = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = -dy / len;
  const ny =  dx / len;

  const p1x = x1 + nx * offset;
  const p1y = y1 + ny * offset;
  const p2x = x2 + nx * offset;
  const p2y = y2 + ny * offset;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  if (drawExtLines && offset !== 0) {
    ctx.beginPath();
    const extStart = Math.sign(offset) * 2;
    const extEnd = offset + Math.sign(offset) * 4; // Slightly past the dim line
    ctx.moveTo(x1 + nx * extStart, y1 + ny * extStart);
    ctx.lineTo(x1 + nx * extEnd, y1 + ny * extEnd);
    ctx.moveTo(x2 + nx * extStart, y2 + ny * extStart);
    ctx.lineTo(x2 + nx * extEnd, y2 + ny * extEnd);
    ctx.stroke();
  }

  // Draw main dimension line
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();

  const angle = Math.atan2(dy, dx);
  ctx.fillStyle = color;
  for (const [px, py, sign] of [[p1x, p1y, 1], [p2x, p2y, -1]]) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      px - arrowSize * Math.cos(angle - Math.PI / 6.5) * sign,
      py - arrowSize * Math.sin(angle - Math.PI / 6.5) * sign
    );
    ctx.lineTo(
      px - arrowSize * Math.cos(angle + Math.PI / 6.5) * sign,
      py - arrowSize * Math.sin(angle + Math.PI / 6.5) * sign
    );
    ctx.closePath();
    ctx.fill();
  }

  if (label) {
    const midX = (p1x + p2x) / 2 + textOffsetX;
    const midY = (p1y + p2y) / 2 + textOffsetY;
    
    ctx.translate(midX, midY);

    // Keep text upright and readable (Standard CAD behavior)
    let textAngle = angle;
    if (textAngle > Math.PI / 2 + 0.01) {
        textAngle -= Math.PI;
    } else if (textAngle < -Math.PI / 2 + 0.01) {
        textAngle += Math.PI;
    }
    // Force vertical lines to read bottom-to-top strictly
    if (Math.abs(textAngle - Math.PI / 2) < 0.01) {
        textAngle = -Math.PI / 2;
    }

    ctx.rotate(textAngle);

    ctx.font = font;
    const metrics = ctx.measureText(label);
    const tw = metrics.width;
    const th = 12; // Approximate font height
    const gap = 4; // Separation from the dimension line

    // Semi-transparent background box to prevent overlap with model lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-tw / 2 - 4, -th - gap - 2, tw + 8, th + 4, 3);
    } else {
      ctx.fillRect(-tw / 2 - 4, -th - gap - 2, tw + 8, th + 4);
    }
    ctx.fill();

    // Render dimension value completely off the line
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -gap);
  }
  ctx.restore();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Front view
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, W } = geometry;
  const { dividerThickness = 0, compHeights = [], compartments = [] } = options;

  const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / W, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Outer cabinet
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W * scale, H * scale);

  // Perâ€‘compartment inner boundaries
  const innerLeft  = compartments.map(c => c.left);
  const innerRight = compartments.map(c => W - c.right);
  const intTop     = effectiveWalls.top;
  const intBottom  = H - effectiveWalls.bottom;

  // Build the inner cavity polygon (stepped if left/right differ)
  ctx.beginPath();
  // outer clockwise
  ctx.rect(0, 0, W * scale, H * scale);
  // inner cavity counterâ€‘clockwise
  let y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    const leftX  = innerLeft[i]  * scale;
    const rightX = innerRight[i] * scale;

    if (i === 0) {
      ctx.moveTo(leftX, y * scale);
    } else {
      ctx.lineTo(leftX, y * scale);   // step left if thickness changed
    }
    ctx.lineTo(rightX, y * scale);
    y += h;
    ctx.lineTo(rightX, y * scale);
    if (i < compHeights.length - 1) {
      // only close the bottom side after last compartment
      // just continue to next
    }
  }
  ctx.lineTo(innerLeft[compHeights.length - 1] * scale, y * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Draw individual compartments
  const types = leaves ? leaves.map(l => l.leafType) : [];
  y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    const leftX  = innerLeft[i]  * scale;
    const rightX = innerRight[i] * scale;
    const compY = y * scale;
    const compH = h * scale;

    ctx.fillStyle = i === 0 ? '#e8f0e8' : '#ffffff';
    ctx.fillRect(leftX, compY, rightX - leftX, compH);
    ctx.strokeStyle = '#999';
    ctx.strokeRect(leftX, compY, rightX - leftX, compH);
    ctx.fillStyle = '#000'; ctx.font = '12px Arial';
    if (types[i]) ctx.fillText(types[i], leftX + 4, compY + 16);

    y += h;

    // divider after this compartment if there is a next one
    if (i < compHeights.length - 1 && dividerThickness > 0) {
      const dividerY = y * scale;
      const dividerH = dividerThickness * scale;
      ctx.fillStyle = '#aaa';
      ctx.fillRect(leftX, dividerY, rightX - leftX, dividerH);
      ctx.strokeStyle = '#666';
      ctx.strokeRect(leftX, dividerY, rightX - leftX, dividerH);
      y += dividerThickness;
    }
  }

  // Dimension lines (left side â€“ compartment heights & divider)
  const dimX = -35;
  y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    drawDim(ctx, dimX, y * scale, dimX, (y + h) * scale, 0, `[h= ${h.toFixed(0)}]`);
    y += h;
    if (i < compHeights.length - 1 && dividerThickness > 0) {
      const dividerBottom = y + dividerThickness;
      drawDim(ctx, dimX, y * scale, dimX, dividerBottom * scale, 0, `[div= ${dividerThickness}]`);
      y = dividerBottom;
    }
  }

  // Horizontal dimensions at bottom
  drawDim(ctx, 0, H * scale, W * scale, H * scale, 35, `[W= ${W.toFixed(0)}]`);
  // Left thickness for top compartment
  drawDim(ctx, 0, 0, innerLeft[0] * scale, 0, -20, `[tLeft= ${compartments[0].left.toFixed(0)}]`);
  // Right thickness for top compartment
  drawDim(ctx, innerRight[0] * scale, 0, W * scale, 0, -20, `[tRight= ${compartments[0].right.toFixed(0)}]`);
  // If second compartment has different left/right, draw additional dimensions?
  // For simplicity, we only show the top compartment's â€“ can be improved later.

  ctx.restore();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Side view â€“ perâ€‘compartment rear thicknesses
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function drawSideView(canvas, geometry, effectiveWalls, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, D, Hb, Db1, Db2, walls } = geometry;
  const { dividerThickness = 0, compHeights = [], doorGap = 0, compartments = [] } = options;

  const tTop      = effectiveWalls.top;
  const tDoor     = effectiveWalls.door;
  const tRear     = effectiveWalls.rear;            // global rear for compressor box
  const tRbottom1 = walls.refrigerator.bottom1;
  const tRbottom2 = walls.refrigerator.bottom2;
  const tRbottom3 = walls.refrigerator.bottom3;

  const compRear = compartments.map(c => c.rear);   // perâ€‘compartment

  const PAD = { left: 60, top: 40, right: 60, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / D, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Outer cabinet
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, D * scale, H * scale);

  const innerDoor = D - tDoor;
  const innerTop  = tTop;
  const floorLowerY  = H - tRbottom3;
  const floorRaisedY = H - Hb - tRbottom1;
  // Use bottom compartmentâ€™s rear (or the only compartment) for the stepped floor
  const bottomRear = compRear.length === 2 ? compRear[1] : compRear[0];
  const slopeStartX = bottomRear + Db1;
  const slopeEndX   = bottomRear + Db2;  
  // ---- 1. Insulation bands (per compartment, nonâ€‘overlapping) ----
  // Top compartment
  const topH = compHeights[0];
  const topRearX = compRear[0] * scale;
  const topY = innerTop * scale;
  const topCompH = topH * scale;
  ctx.beginPath();
  ctx.rect(0, 0, D * scale, topY + topCompH);                     // outer slice
  ctx.moveTo(topRearX, topCompH);
  ctx.lineTo(innerDoor * scale, topY);
  ctx.lineTo(innerDoor * scale, topY + topCompH);
  ctx.lineTo(topRearX, topY + topCompH);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // If two compartments, bottom compartment insulation
  if (compHeights.length === 2) {
    const bottomH = compHeights[1];
    const bottomRearX = compRear[1] * scale;
    const bottomY = (innerTop + topH + dividerThickness) * scale;
    const bottomCompH = bottomH * scale;
    ctx.beginPath();
    ctx.rect(0, bottomY, D * scale, bottomCompH);             // outer slice
    // inner cutout follows the stepped floor
    ctx.moveTo(bottomRearX, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY + bottomCompH);
    ctx.lineTo(innerDoor * scale, floorLowerY * scale);       // down to lower floor (should be same as bottom bottom)
    ctx.lineTo(slopeEndX * scale, floorLowerY * scale);
    ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
    ctx.lineTo(bottomRearX, floorRaisedY * scale);            // back to rear at raised floor
    ctx.closePath();
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();
  }

  // ---- 2. Compressor box ----
  // (same as before, using global tRear)
  const slopeDx = slopeEndX - slopeStartX;
  const slopeDy = floorLowerY - floorRaisedY;
  const slopeLen = Math.sqrt(slopeDx*slopeDx + slopeDy*slopeDy);
  let nx =  slopeDy / slopeLen;
  let ny = -slopeDx / slopeLen;
  if (ny < 0) { nx = -nx; ny = -ny; }

  const yTopCB = floorRaisedY + tRbottom1;
  const sTop = slopeDy !== 0 ? (yTopCB - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xTopCB = slopeStartX + sTop * slopeDx + nx * tRbottom2;

  const yBottomCB = H;
  const sBottom = slopeDy !== 0 ? (yBottomCB - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xBottomCB = slopeStartX + sBottom * slopeDx + nx * tRbottom2;

  ctx.beginPath();
  ctx.moveTo(0, H * scale);
  ctx.lineTo(0, yTopCB * scale);
  ctx.lineTo(xTopCB * scale, yTopCB * scale);
  ctx.lineTo(xBottomCB * scale, yBottomCB * scale);
  ctx.closePath();
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#555'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Comp.', 6, yTopCB * scale + 14);

  // ---- 3. White inner cavity (two separate shapes) ----
  // Top compartment
  ctx.beginPath();
  ctx.rect(topRearX, topY, innerDoor * scale - topRearX, topCompH);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
  ctx.stroke();
  // bottom compartment
  if (compHeights.length === 2) {
    const bottomRearX = compRear[1] * scale;
    const bottomY = (innerTop + topH + dividerThickness) * scale;
    const bottomCompH = compHeights[1] * scale;
    ctx.beginPath();
    ctx.moveTo(bottomRearX, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY + bottomCompH);
    ctx.lineTo(innerDoor * scale, floorLowerY * scale);
    ctx.lineTo(slopeEndX * scale, floorLowerY * scale);
    ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
    ctx.lineTo(bottomRearX, floorRaisedY * scale);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ---- 4. Divider & doors ----
  let drawnDoors = [];
  if (compHeights.length === 2 && dividerThickness > 0) {
    const dividerY = innerTop + topH;
    const dividerH = dividerThickness;

    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, dividerY * scale,
                 (innerDoor) * scale, dividerH * scale);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(0, dividerY * scale,
                  (innerDoor) * scale, dividerH * scale);

    const doorLeftX = innerDoor * scale;
    const doorWidth = (D - innerDoor) * scale;
    const topDoorTop = 0;
    const topDoorBottom = (dividerY + dividerH/2) * scale - (doorGap / 2) * scale;
    const bottomDoorTop = (dividerY + dividerH/2) * scale + (doorGap / 2) * scale;
    const bottomDoorBottom = H * scale;

    ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.fillRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
    ctx.fillRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
    ctx.strokeRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);

    drawnDoors.push({ top: topDoorTop, bottom: topDoorBottom });
    drawnDoors.push({ top: bottomDoorTop, bottom: bottomDoorBottom });

    drawDim(ctx, D * scale, topDoorBottom, D * scale, bottomDoorTop, -45,
            `[door gap= ${(dividerThickness + doorGap).toFixed(0)}]`);
  } else {
    drawnDoors.push({ top: innerTop * scale, bottom: floorLowerY * scale });
  }

  // ---- Dimensions ----
  drawDim(ctx, 0, H * scale, 0, 0, -45, `[H= ${H.toFixed(0)}]`);
  drawDim(ctx, 0, H * scale, 0, floorRaisedY * scale, -20, `[Hb= ${Hb.toFixed(0)}]`);
  drawDim(ctx, 0, 0, D * scale, 0, -25, `[D= ${D.toFixed(0)}]`);
  drawDim(ctx, bottomRear * scale, floorRaisedY * scale, slopeStartX * scale, floorRaisedY * scale, -18, `[Db1= ${Db1.toFixed(0)}]`);
  drawDim(ctx, bottomRear * scale, floorLowerY * scale, slopeEndX * scale, floorLowerY * scale, -18, `[Db2= ${Db2.toFixed(0)}]`);
  const topMidX = (tRear + innerDoor) / 2 * scale;
  drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, `[tTop= ${tTop.toFixed(0)}]`);

  drawnDoors.forEach(door => {
    const doorMidY = (door.top + door.bottom) / 2.5;
    drawDim(ctx, innerDoor * scale, doorMidY, D * scale, doorMidY, 0, `[tDoor= ${tDoor.toFixed(0)}]`);
  });

  // Rear dimensions â€“ per compartment
  for (let i = 0; i < compHeights.length; i++) {
    if (i === 0 || compRear[i] !== compRear[i-1]) {
      let compY = innerTop;
      for (let j = 0; j < i; j++) compY += compHeights[j];
      if (i > 0) compY += dividerThickness;
      const midY = (compY + compY + compHeights[i]) / 2.5 * scale;
      drawDim(ctx, 0, midY, compRear[i] * scale, midY, 0, `[tRear= ${compartments[i].rear.toFixed(0)}]`);
    }
  }

  const botMidX = (slopeEndX + innerDoor) / 2.5 * scale;
  drawDim(ctx, botMidX, floorLowerY * scale, botMidX, H * scale, 0, `[tRb3= ${tRbottom3.toFixed(0)}]`);

  const midSlopeX = (slopeStartX + slopeEndX) / 2;
  const midSlopeY = (floorRaisedY + floorLowerY) / 2;
  const innerPX = midSlopeX * scale;
  const innerPY = midSlopeY * scale;
  const outerPX = innerPX + nx * (tRbottom2 * scale);
  const outerPY = innerPY + ny * (tRbottom2 * scale);
  drawDim(ctx, innerPX, innerPY, outerPX, outerPY, 0, `[tRb2= ${tRbottom2.toFixed(0)}]`);

  // Compartment height dimensions (right side)
  if (compHeights.length === 2) {
    const dimX = D * scale + 20;
    let yPos = innerTop;
    compHeights.forEach((h, idx) => {
      const bottomY = yPos + h;
      drawDim(ctx, dimX, yPos * scale, dimX, bottomY * scale, 0, `[h= ${h.toFixed(0)}]`);
      yPos = bottomY;
      if (idx === 0 && dividerThickness > 0) yPos += dividerThickness;
    });
  } else if (compHeights.length === 1) {
    drawDim(ctx, D * scale + 20, innerTop * scale, D * scale + 20, (innerTop + compHeights[0]) * scale, 0,
            `[h= ${compHeights[0].toFixed(0)}]`);
  }

  ctx.restore();
}
```


---

*Converted from `schematic.js` on 2026-05-27 14:13:10*


---
## js_ui_settingsModal.md

# settingsModal.js

**Original file:** `settingsModal.js`

**File type:** .JS

**Size:** 5,434 bytes

**Last modified:** 2026-05-04 14:38:09


---

## Content

```javascript
import { settings, updateSettings, resetSettings, getSettings } from '../settings.js';

let modal, closeBtn, settingsForm, saveBtn, exportBtn, importBtn, resetBtn;

export function initSettingsModal() {
  modal = document.getElementById('settingsModal');
  closeBtn = document.getElementById('closeSettings');
  settingsForm = document.getElementById('settingsForm');
  saveBtn = document.getElementById('settingsSave');
  exportBtn = document.getElementById('settingsExport');
  importBtn = document.getElementById('settingsImport');
  resetBtn = document.getElementById('settingsReset');

  closeBtn.addEventListener('click', hide);
  saveBtn.addEventListener('click', () => { collectAndSave(); hide(); });
  exportBtn.addEventListener('click', exportSettings);
  importBtn.addEventListener('click', importSettings);
  resetBtn.addEventListener('click', resetAndClose);
  window.addEventListener('click', (e) => { if (e.target === modal) hide(); });
}

export function showModal() {
  buildForm();
  modal.classList.remove('hidden');
}

function hide() {
  modal.classList.add('hidden');
}

function resetAndClose() {
  if (confirm('Reset all settings to factory defaults?')) {
    resetSettings();
    buildForm();
    hide();
  }
}

function buildForm() {
  const s = getSettings();
  settingsForm.innerHTML = `
    <fieldset>
      <legend>Volume Calculation Constants</legend>
      <label>IEC fixed deduction factor (0â€‘1): <input type="number" id="setIecFactor" value="${s.iecFactor}" step="0.01" min="0" max="1"></label>
      <label>mmÂ³ â†’ Litre: <input type="number" id="setMm3ToL" value="${s.mm3ToL}" step="0.0000001" min="0"></label>
      <label>Litre â†’ cu.ft: <input type="number" id="setLToCuft" value="${s.lToCuft}" step="0.0000001" min="0"></label>
    </fieldset>
    <fieldset>
      <legend>ES 3794 / IEC Deductions</legend>
      <p><em>Egyptian Net = Gross âˆ’ Userâ€‘removable accessories (shelves, drawers, door bins, and housings if marked removable).</em></p>
      <label><input type="checkbox" id="setIceMakerRemovable" ${s.iceMakerRemovable ? 'checked' : ''}> Ice maker housing is userâ€‘removable</label>
      <label><input type="checkbox" id="setLightRemovable" ${s.lightRemovable ? 'checked' : ''}> Light housing is userâ€‘removable</label>
    </fieldset>
    <fieldset>
      <legend>Display & Canvas</legend>
      <label>Decimal places (Litres): <input type="number" id="setPrecisionL" value="${s.displayPrecisionL}" min="0" max="5"></label>
      <label>Decimal places (cu.ft): <input type="number" id="setPrecisionCuft" value="${s.displayPrecisionCuft}" min="0" max="5"></label>
      <label>Canvas width: <input type="number" id="setCanvasW" value="${s.canvasWidth}" step="10" min="200"></label>
      <label>Canvas height: <input type="number" id="setCanvasH" value="${s.canvasHeight}" step="10" min="200"></label>
    </fieldset>
    <fieldset>
      <legend>Behaviour</legend>
      <label><input type="checkbox" id="setAutoCalculate" ${s.autoCalculate ? 'checked' : ''}> Autoâ€‘calculate on input change</label>
      <label><input type="checkbox" id="setShowDirtyOverlay" ${s.showDirtyOverlay ? 'checked' : ''}> Show â€œschematic outdatedâ€ overlay</label>
    </fieldset>
  `;
}

function collectAndSave() {
  const iceMakerRemovable = document.getElementById('setIceMakerRemovable').checked;
  const lightRemovable = document.getElementById('setLightRemovable').checked;
  const iecFactor = parseFloat(document.getElementById('setIecFactor').value) || 0.97;
  const mm3ToL = parseFloat(document.getElementById('setMm3ToL').value) || 1e-6;
  const lToCuft = parseFloat(document.getElementById('setLToCuft').value) || 0.0353147;
  const displayPrecisionL = parseInt(document.getElementById('setPrecisionL').value) || 2;
  const displayPrecisionCuft = parseInt(document.getElementById('setPrecisionCuft').value) || 3;
  const canvasWidth = parseInt(document.getElementById('setCanvasW').value) || 600;
  const canvasHeight = parseInt(document.getElementById('setCanvasH').value) || 800;
  const autoCalculate = document.getElementById('setAutoCalculate').checked;
  const showDirtyOverlay = document.getElementById('setShowDirtyOverlay').checked;

  updateSettings({
    iceMakerRemovable, lightRemovable, iecFactor, mm3ToL, lToCuft,
    displayPrecisionL, displayPrecisionCuft,
    canvasWidth, canvasHeight,
    autoCalculate, showDirtyOverlay,
  });
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(getSettings(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'refrigerator-calc-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      // Merge with current but override with imported keys
      updateSettings({ ...getSettings(), ...imported });
      buildForm();
      alert('Settings imported. Save & close to apply.');
    } catch (err) {
      alert('Invalid settings file.');
    }
  };
  input.click();
}

```


---

*Converted from `settingsModal.js` on 2026-05-27 14:13:10*


---
## js_ui_thermoUI.md

# thermoUI.js

**Original file:** `thermoUI.js`

**File type:** .JS

**Size:** 5,506 bytes

**Last modified:** 2026-05-24 01:14:32


---

## Content

```javascript
import { runThermoAnalysis, buildDefaultConfig } from '../engine/thermo/index.js';
import { toThermalFormat } from '../engine/geometry.js';
import { SJ54H_COMPONENTS } from '../engine/thermo/defaultComponents.js';
import { runThermalAnalysisDynamic } from '../engine/thermo/solver.js';

let getGeometryFn = null;
let thermoSection, runBtn, resultsDiv, errorDiv;

export function initThermoUI(getGeometry) {
  thermoSection = document.getElementById('thermoSection');
  if (!thermoSection) return;

  runBtn = document.getElementById('thermoRunBtn');
  resultsDiv = document.getElementById('thermoResults');
  errorDiv = document.getElementById('thermoErrors');

  if (!runBtn || !resultsDiv || !errorDiv) {
    console.warn('Thermo UI elements missing â€“ thermal analysis disabled.');
    return;
  }

  getGeometryFn = getGeometry;
  runBtn.addEventListener('click', handleRun);

  document.getElementById('thermoSubcool').value  = SJ54H_COMPONENTS.subcool_K;
  document.getElementById('thermoDiscTemp').value = SJ54H_COMPONENTS.dischargeTemp_C;
  document.getElementById('thermoFanFlow').value  = SJ54H_COMPONENTS.fan.totalAirflow_m3h;
  document.getElementById('thermoDefHeater').value = SJ54H_COMPONENTS.electrical.defrostHeater_W;
  document.getElementById('thermoDefOn').value     = SJ54H_COMPONENTS.electrical.defrostOn_min;
}

function handleRun() {
  clearMessages();

  if (!getGeometryFn) {
    showError('Geometry source not available.');
    return;
  }
  const cabinetGeom = getGeometryFn();

  // Thermal guard: freezer must be top compartment
  if (cabinetGeom._compartments && cabinetGeom._compartments.length > 1 &&
      cabinetGeom._compartments[0].type !== 'freezer') {
    showError('Thermal analysis currently supports only freezerâ€‘top configurations.');
    return;
  }

  const geom = toThermalFormat(cabinetGeom);

  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
    showError('Please fill in ambient, freezer, and refrigerator temperatures.');
    return;
  }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';
  const subcool = parseFloat(document.getElementById('thermoSubcool')?.value) || 10;
  const dischargeTemp = parseFloat(document.getElementById('thermoDiscTemp')?.value) || 60;
  const fanFlow = parseFloat(document.getElementById('thermoFanFlow')?.value) || 59.5;
  const defHeater = parseFloat(document.getElementById('thermoDefHeater')?.value) || 140;
  const defOnMin = parseFloat(document.getElementById('thermoDefOn')?.value) || 0;

  const compParams = SJ54H_COMPONENTS.compressor;
  const condenserConfig = {
    K_side: SJ54H_COMPONENTS.condenser.K_side_kcalhm2C,
    K_back: SJ54H_COMPONENTS.condenser.K_back_kcalhm2C,
    backCondenserEfficiency: SJ54H_COMPONENTS.condenser.backCondenserEfficiency,
    k_RFront1: SJ54H_COMPONENTS.condenser.k_RFront1,
    k_RFront2: SJ54H_COMPONENTS.condenser.k_RFront2,
    k_FRPartition1: SJ54H_COMPONENTS.condenser.k_FRPartition1,
    k_FRPartition2: SJ54H_COMPONENTS.condenser.k_FRPartition2,
    k_FFront1: SJ54H_COMPONENTS.condenser.k_FFront1,
    k_FFront2: SJ54H_COMPONENTS.condenser.k_FFront2,
  };

  const config = {
    geom,
    compParams,
    condenserConfig,
    refrigerant,
    subcool,
    dischargeTemp,
    fixedTemps: { T0, TF, TR, TE: -23.3 },
    fan: { totalAirflow: fanFlow },
    electrical: {
      defrostHeater_W: defHeater,
      defrostOn_min: defOnMin,
      pwbOn_W: SJ54H_COMPONENTS.electrical.pwbOn_W,
      pwbOff_W: SJ54H_COMPONENTS.electrical.pwbOff_W,
      timerPeriod_h: SJ54H_COMPONENTS.electrical.timerPeriod_h,
    },
  };

const result = runThermalAnalysisDynamic(config);
  if (!result.success) {
    showError(result.errors.join('; '));
  } else {
    displayResults(result.results);
    if (result.warnings.length) showWarnings(result.warnings);
  }
}

function displayResults(res) {
  if (!res) return;
  const html = `
    <table>
      <tr><td>Condensing temp TC:</td><td>${res.TC.toFixed(2)} Â°C</td></tr>
      <tr><td>Evap outlet T2:</td><td>${res.T2.toFixed(2)} Â°C</td></tr>
      <tr><td>Running ratio PR:</td><td>${(res.PR * 100).toFixed(1)} %</td></tr>
      <tr><td>Comp. cooling capacity:</td><td>${res.compressor.coolingCapacity.toFixed(2)} kcal/h</td></tr>
      <tr><td>Comp. input power:</td><td>${res.compressor.inputPower.toFixed(2)} W</td></tr>
      <tr><td>Mass flow:</td><td>${res.compressor.massFlow.toFixed(3)} kg/h</td></tr>
      <tr><td>Heat load QF:</td><td>${res.heatLoads.QF.toFixed(2)} kcal/h</td></tr>
      <tr><td>Heat load QR:</td><td>${res.heatLoads.QR.toFixed(2)} kcal/h</td></tr>
      <tr><td>Heat load QEV:</td><td>${res.heatLoads.QEV.toFixed(2)} kcal/h</td></tr>
    </table>
  `;
  resultsDiv.innerHTML = html;
}

function clearMessages() {
  resultsDiv.innerHTML = '';
  errorDiv.innerHTML = '';
}

function showError(msg) {
  errorDiv.innerHTML = `<p class="error">âŒ ${msg}</p>`;
}

function showWarnings(warnings) {
  const ul = document.createElement('ul');
  warnings.forEach(w => {
    const li = document.createElement('li');
    li.textContent = w;
    li.className = 'warning';
    ul.appendChild(li);
  });
  errorDiv.appendChild(ul);
}
```


---

*Converted from `thermoUI.js` on 2026-05-27 14:13:10*


---
## pv73 calc_MACROS.md

# VBA Macros




Sub Macro2()

Dim AA(10, 10), X(10), FX0(10), FX1(10), FDX(10)

' Æ’nÆ’â€œÆ’`Æ’â€œÆ’O Macro
' Æ’}Æ’NÆ’Ââ€¹LËœ^â€œÃº : 2002/4/13  Æ’â€ Â[Æ’UÂ[â€“Â¼ : takatori
'
    Cells(3, 5) = ""
    DD1 = 0.0005
    DX = 0.001
    DY = 0.00001
    DZ = 0.001
    DH = 0.001
    NN = 0
    NNC = 0
    NM = 0
    KF = 2
    KTC = Cells(36, 5)

A0:
    For I = 1 To KF
    X(I) = Cells(36 + I, 5)
    Next I
   
A1:
    For I = 1 To KF
    FX0(I) = Cells(42 + I, 5)
    Next I
    
    For I = 1 To KF
    If Abs(FX0(I)) > DD1 Then GoTo A2
    Next I
    
    NN = 0
    If KTC = 1 Then GoTo BB
    GoTo ZZ

A2:
    NN = NN + 1
    If NN > 100 Then GoTo CC
    
    For I = 1 To KF
    Cells(36 + I, 5) = X(I) + DX
    
    For J = 1 To KF
    FX1(J) = Cells(42 + J, 5)
    AA(J, I) = (FX1(J) - FX0(J)) / DX

    Next J
    
    Cells(36 + I, 5) = X(I)
    Next I
    
    For I = 1 To KF
    AA(I, KF + 1) = -1 * FX0(I)
    Next I
    
    N = KF
    
    For K = 1 To N
    AK = AA(K, K)
    For J = 1 To N + 1
    AA(K, J) = AA(K, J) / AK
    Next J
    For I = 1 To N
    AIK = AA(I, K)
    For J = 1 To N + 1
    If I = K Then GoTo DD
    AA(I, J) = AA(I, J) - AIK * AA(K, J)
    Next J
DD:
    Next I
    Next K
        
    For I = 1 To KF
    X(I) = X(I) + AA(I, KF + 1)
    Cells(36 + I, 5) = X(I)
    Next I
    
    GoTo A1
BB:
    If KTC = 0 Then GoTo ZZ
    If NNC = 1 Then GoTo EE
    NM = NM + 1
    If NM > 100 Then GoTo CC
    X3 = Cells(39, 5)
    FH0 = Cells(45, 5)
    If Abs(FH0) < DD1 Then GoTo ZZ
    Cells(39, 5) = X3 + DH
    NNC = 1
    GoTo A0
EE:

    FH1 = Cells(45, 5)
    FDH = (FH1 - FH0) / DH
    X3 = X3 - FH0 / FDH
    Cells(39, 5) = X3
    NNC = 0
    GoTo A0
    
    
CC:
    Cells(3, 5) = "NG!"
    GoTo XX
    
ZZ:
    Cells(3, 5) = "OK!"
XX:

'
End Sub


---
## pv73 calc_MAIN_formulas.md

# Sheet: MAIN - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U | Column_V | Column_W | Column_X | Column_Y | Column_Z | Column_AA | Column_AB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-pv73k   > | Ver. 2014/01/07 |  |  |  |  | Refrigerant |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  | OK! |  | R-600a=1,R-134a=2 | 1 | `=IF(H3=1,"R-600a",IF(H3=2,"R-134a","??"))` |  |  |  | Refrigerant | R-600a |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼´ï¼¥ï¼­ï¼°ï¼¡ï¼²ï¼¡ï¼´ï¼µï¼²ï¼¥  â—‡ | (â„ƒ) |  | â—‡HEAT LOAD â—‡ |  |  | â—‡  Compressor Data  â—‡ |  |  |  |  |  | COMP NAME | EGX80CLC 100V 50Hz |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F ROOM   TF      (â„ƒ) | -18 |  | QF     TOTAL(kcal/h)  (inlet) | `=SIZE!E32` |  | COMPRESSOR NAME | `=N4` | R-600a |  |  |  | Capacity | `=[1]DATA!$K$5` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| R ROOM   TR      (â„ƒ) | 3 |  | QR     TOTAL(kcal/h)  (inlet) | `=SIZE!E33+E8` |  | 220/240V 50Hz |  |  |  |  |  | COP | `=[1]DATA!$I$7` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DP CON.  TC      (â„ƒ) | `=B8+E39` | Trial | QEV    TOTAL (kcal/h)  (inlet) | `=SIZE!E34` |  | å®šæ ¼ï½ºï½°ï¾…ï½° |  |  |  |  |  | Rpm0= | `=[1]DATA!$D$5` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE  T0      (â„ƒ) | 25 |  | heater          (kcal/h) | 0 |  | N(rpm) | `=N7` |  | Volume Efficiency |  |  | Vc= | `=[1]DATA!$D$4` | Rotational Speed â€‹â€‹Correction |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | heater          (W) | `=E8/0.86` |  | Vc(cc) | `=N8` |  | Î·v=(A+B*PC/PE+C*PC)*KÎ·v |  |  | A= | `=[1]DATA!O4` | a= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼¯ ï¼´ ï¼¨ ï¼¥ ï¼² ï¼³  â—‡ |  |  | Qtotal  (=QF+QR+QEV) | `=SUM(E5:E7)` |  | Î·v | `=(N9+N10*H14/H15+N11*H14)*K10` |  | KÎ·v= | `=P9+P10*H8+P11*H8^2` |  | B= | `=[1]DATA!O5` | b= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN TOTAL                (m3/h) | 146.4 |  |  |  |  | T IN | 32.2 |  |  |  |  | C= | `=[1]DATA!O6` | c= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN Diameter   Ï†mm | 100 |  | â—‡  CALCULATION â—‡ |  |  | TC  Cond | 54.4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN SPEED               (rpm) | 2850 |  | Fan out air temp         T3      (â„ƒ) | `=E37+E7/B11/B21/B20/E38` |  | TE  Evap | -23.3 |  | R-600a | R-134a |  | AW= | `=[1]DATA!R4` | Rotational Speed â€‹â€‹Correction |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN INPUT                (W) | 2.4 |  | R Air Volume             MR     (m3/h) | `=E6/B20/B21/(B6-E13)/E38` | `=E14/B11` | Pc (Tcond) | `=IF(H3=1,J14,IF(H3=2,K14,"??"))` |  | `=EXP(68.322-4401/(H12+273.16)-9.8436*LN(H12+273.16)+0.0127711*(H12+273.16))` | `=EXP(104.918-5301.3/(H12+273.16)-16.2481*LN(H12+273.16)+0.0246593*(H12+273.16))` |  | BW= | `=[1]DATA!R5` | Ka= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| DEF. HEATER INPUT        (W) | 112 |  | F Air Volume             MF     (m3/h) | `=B11-E14` |  | Pe (Teva) | `=IF(H3=1,J15,IF(H3=2,K15,"??"))` |  | `=EXP(68.322-4401/(H13+273.16)-9.8436*LN(H13+273.16)+0.0127711*(H13+273.16))` | `=EXP(104.918-5301.3/(H13+273.16)-16.2481*LN(H13+273.16)+0.0246593*(H13+273.16))` |  | CW= | `=[1]DATA!R6` | Kb= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp ON     (W) | 2 |  | QF'  (FAN)                    (kcal/h) | `=(B11-E14)*B21*B20*(B5-E13)*E38` |  | Hout (kcal/kg) | `=IF(H3=1,J16,IF(H3=2,K16,"??"))` |  | `=104.5+0.049951*(H11+273.16)+0.00058822*(H11+273.16)^2-249.18*J15/(H11+273.16)` | `= 119.36 + 0.023174 *(H11+273.16) + 0.00031297 * (H11+273.16) ^ 2 - 138.07 *K15/ (H11+273.16)` |  | DW= | `=[1]DATA!R7` | Kc= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp OFF    (W) | 1 |  | QR'  (FAN)                    (kcal/h) | `=E14*B20*B21*(B6-E13)*E38` |  | Hin  (kcal/kg) | `=IF(H3=1,J17,IF(H3=2,K17,"??"))` |  | `=75.545+0.55731*H11+0.0007088*H11^2+0.0000029408*H11^3` | `= 100.019 + 0.31763 * H11+ 0.00033057 * H11^ 2 + 0.0000035281 *H11^ 3` |  | EW= | `=[1]DATA!R8` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| TIMER   Period          (hr) | 10.5 |  | QEV'    =M*Î³*CP*(TEVIN-TEVOUT)*PR | `=B11*B21*B20*(E13-E37)*E38` |  | V(specific volumeï¼‰ | `=IF(H3=1,J18,IF(H3=2,K18,"??"))` |  | `= 0.015883+0.001455*(H11+273.16)/J15-7.2936/(H11+273.16)-0.0004645*J15` | `=0.01248+0.0008207*(H11+273.16)/K15-4.663/(H11+273.16)-0.0002297*K15` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Def. HEATER   ON  time  (min) | 0 |  | Air Speed in Evaporator       (m/sec) | `=B11/(B24*B25)/3600*10^6` |  | G(mass flow rate) | `=H10*H8*60*H9*10^(-6)/H18` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DENSITY(Air)      Î³     (kg/m3) | 1.365 |  | EV INLET  Air   Temp.     T1     (â„ƒ) | `=(E14*B6+E15*B5)/B11` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cp(Air 0â„ƒ)              (kcal/kgâ„ƒ) | 0.24 |  | LOG. MEAN TEMP. DIFF. OF EVA.  (â„ƒ) | `=E10/E23/B33/E38` |  | Rated capacity | `=H19*(H16-H17)` | kcal/h |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | SUB CAL. X | `=EXP((E20-E37)/E21)` |  |  | `=H21/0.86` | W | å…¥åŠ›å›žè»¢æ•°è£œæ­£ |  |  |  | TC= | `=B7` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  EVAPORATOR  (NALCO)  â—‡ |  |  | EVA  Heat transfer Î± ( kcal/hm2â„ƒ) | `=12.93*E19^0.415` |  | Rated input(ï¼·ï¼‰ | `=K23*(N13+N14*H13+N15*H12+N16*H12*H13+N17*H13^2)*H8/N7` | W | Kw= | `=P14+P15*H8+P16*H8^2` |  |  | Te= | `=E24` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV WIDTH  (=30mm*N)      (mm) | 440.5 |  | EV TEMPRATURE                  (â„ƒ) | `=(E20-E22*E37)/(1-E22)` |  | COP | `=H21/H23/0.86` | W=(AW+BW*TE+CW*TC*TE+DW*TE^2)*Kw*Rpm/Rpm0 |  |  |  |  | T0= | `=B8` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV DEPTH                 (mm) | 58 |  | QEV''(Ability of Evaporator)  (kcal/h) | `=E23*B33*E21` |  |  |  |  |  |  |  |  | Tsub= | `=K28` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV Tire (pitch) | 5 |  | COMP INPUT | `=K32` |  | â—‡  Cooling capacity of Refrigerator Condition  â—‡ |  |  |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Diameter  Ï† mm | 8 |  | ON Time INPUT | `=E26+B14+B16` |  | Pc (Tcond) | `=IF(H3=1,N27,IF(H3=2,O27,"??"))` |  | Capi Sub-cool | 10 |  | Pc= | `=EXP(68.322-4401/(O22+273.16)-9.8436*LN(O22+273.16)+0.0127711*(O22+273.16))` | `=EXP(104.918-5301.3/(O22+273.16)-16.2481*LN(O22+273.16)+0.0246593*(O22+273.16))` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface  27*77mm/pc | `=(27*77-3.146*(B27/2)^2*2)*2/10^6` |  | Energy consumption kWh/24h | `=(E27*E38+(1-E38)*B17)*24/1000+B15*E31*B19/60/1000` |  | Pe (Teva) | `=IF(H3=1,N28,IF(H3=2,O28,"??"))` |  | TC-Sub cool | `=B7-K27` |  | Pe= | `=EXP(68.322-4401/(O23+273.16)-9.8436*LN(O23+273.16)+0.0127711*(O23+273.16))` | `=EXP(104.918-5301.3/(O23+273.16)-16.2481*LN(O23+273.16)+0.0246593*(O23+273.16))` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Toatal fin quqntity | `=B45` |  | KWH/MONTH | `=E28*30` |  | V(m3/kgï¼‰ | `=IF(H3=1,N29,IF(H3=2,O29,"??"))` |  | Hevin | `=IF(H3=1,N30,IF(H3=2,O30,"??"))` |  | v= | `=0.015883+0.001455*(O24+273.16)/N28-7.2936/(O24+273.16)-0.0004645*N28` | `=0.01248+0.0008207*(O24+273.16 )/O28-4.663/(O24+273.16)-0.0002297*O28` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface    m2 | `=B29*B28` |  | Qcomp(Ability of Compressor)   (kcal/h) | `=K31` |  | Volume Efficiency | `=(N9+N10*H27/H28+N11*H27)*K10` |  | Hevout | `=IF(H3=1,N31,IF(H3=2,O31,"??"))` |  | Hevin= | `=75.545+0.55731*O25+0.0007088*O25^2+0.0000029408*O25^3` | `=100.019+0.31763*O25+0.00033057*O25^2+0.0000035281*O25^ 3` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Surface  Ï†8mm | `=(3.146*B27*B24)*B26*2/10^6` |  | How many defrost in a day   ï¼ˆTimes/24h) | `=24/E32` |  | G(kg/h) | `=H30*H8*60*H9*10^(-6)/H29` |  | QCOMP | `=H31*(K30-K29)` |  | Hevout= | `=104.5+0.049951*(O23+273.16)+0.00058822*(O23+273.16)^2-249.18*N28/(O23+273.16)` | `= 119.36 + 0.023174 *(O23+273.16) + 0.00031297 * (O23+273.16) ^ 2 - 138.07 *O28/ (O23+273.16)` |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Side Plate surface | `=0.07*0.235` |  | Defrosting cycle   Hr | `=B18/E38` |  |  |  |  | COMP INPUT | `=K23*(N13+N14*E24+N15*B7+N16*B7*E24+N17*E24*E24)*H8/N7` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| SURFACE OF EVAPORATOR    (m2) | `=B30+B31+B32` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | â—‡  Condenser Heat Exchange   â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡ quantity of Evaporator fin  â—‡ |  |  | â—‡  ï¼¶ï¼¡ï¼²ï¼©ï¼¡ï¼¢ï¼¬ï¼¥  â—‡ |  |  | ï¼² Front | `=(0.3405*(B7-B8)+0.03322*(B7-B6))*(SIZE!B7*2+SIZE!B9)/1000` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Evaporator Fin quantity | æžšæ•° |  | Calculate Cond Temp?  Yes=1, No=0 | 1 |  | ï¼¦ï¼² Partition | `=(0.1984*(B7-B8)+0.1219*(B7-B5))*(SIZE!B9-SIZE!B25-SIZE!B24)/1000` |  | ç†±é€šéŽçŽ‡ | é¢ç© |  | ã‚µã‚¤ãƒ‰ã‚³ãƒ³ãƒ»ãƒãƒƒã‚¯ã‚³ãƒ³ã®ç†±é€šéŽçŽ‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 part | 67 |  | X1 =EV OUT  Temp.          T2     (â„ƒ) | -19.325223898279788 | Trial | ï¼¦ Front | `=(0.3395*(B7-B8)+0.0344*(B7-B5))*(SIZE!B8*2)/1000` |  | K | S |  |  | K | Pipe Pitch |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 part | 73 |  | X2 =RUNNING RATIO          PR     (ï¼…) | 0.46552849936977625 | Trial | Sid  Condenser | `=J38*K38*E39` | Side Cond | `=N38` | `=(SIZE!B6*(SIZE!B10-30)-(SIZE!B13+SIZE!B12)*SIZE!B11/2)*2/10^6` |  | Side Cond | `=(10.57-0.042*O38+0.00005*O38^2)` | 150 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 part | 73 |  | X3 = âŠ¿T ( TC-T0) | 7.959973536317755 |  | Back Condenser | `=J39*K39*E39` | Back Cond | `=N39` | `=SIZE!B9*(SIZE!B6-SIZE!B11)/10^6*K40` |  | Back Cond | `=(10.57-0.042*O39+0.00005*O39^2)` | 200 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 part | 47 |  |  |  |  | TOTAL  QC0ut | `=SUM(H35:H39)` | ãƒãƒƒã‚¯ã‚³ãƒ³æ”¾ç†±åŠ¹çŽ‡ |  | 0.7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 part | 36 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 part | 0 |  | â—‡  ï¼£ï¼¯ï¼®ï¼¤ï¼©ï¼´ï¼©ï¼¯ï¼®  â—‡ |  |  | â—‡ Radiate Heat â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
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

---
## pv73 calc_MAIN_values.md

# Sheet: MAIN - VALUES (Calculated/Displayed)

*This shows the calculated values as they appear in Excel*

## Data Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | Column_E | Column_F | Column_G | Column_H | Column_I | Column_J | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q | Column_R | Column_S | Column_T | Column_U | Column_V | Column_W | Column_X | Column_Y | Column_Z | Column_AA | Column_AB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-pv73k   > | Ver. 2014/01/07 |  |  |  |  | Refrigerant |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  | OK! |  | R-600a=1,R-134a=2 | 1 | R-600a |  |  |  | Refrigerant | R-600a |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼´ï¼¥ï¼­ï¼°ï¼¡ï¼²ï¼¡ï¼´ï¼µï¼²ï¼¥  â—‡ | (â„ƒ) |  | â—‡HEAT LOAD â—‡ |  |  | â—‡  Compressor Data  â—‡ |  |  |  |  |  | COMP NAME | EGX80CLC 100V 50Hz |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F ROOM   TF      (â„ƒ) | -18 |  | QF     TOTAL(kcal/h)  (inlet) | 24.04444892528598 |  | COMPRESSOR NAME | EGX80CLC 100V 50Hz | R-600a |  |  |  | Capacity | 139.84308475197383 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| R ROOM   TR      (â„ƒ) | 3 |  | QR     TOTAL(kcal/h)  (inlet) | 21.378465301500093 |  | 220/240V 50Hz |  |  |  |  |  | COP | 1.0377965473245203 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DP CON.  TC      (â„ƒ) | 32.959973536317754 | Trial | QEV    TOTAL (kcal/h)  (inlet) | 4.456262999632735 |  | å®šæ ¼ï½ºï½°ï¾…ï½° |  |  |  |  |  | Rpm0= | 2220 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE  T0      (â„ƒ) | 25 |  | heater          (kcal/h) | 0 |  | N(rpm) | 2220 |  | Volume Efficiency |  |  | Vc= | 10.17 | Rotational Speed â€‹â€‹Correction |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | heater          (W) | 0 |  | Vc(cc) | 10.17 |  | Î·v=(A+B*PC/PE+C*PC)*KÎ·v |  |  | A= | 0.9302583559597055 | a= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  ï¼¯ ï¼´ ï¼¨ ï¼¥ ï¼² ï¼³  â—‡ |  |  | Qtotal  (=QF+QR+QEV) | 49.87917722641881 |  | Î·v | 0.763625237055447 |  | KÎ·v= | 1 |  | B= | -0.012294405565323853 | b= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN TOTAL                (m3/h) | 146.4 |  |  |  |  | T IN | 32.2 |  |  |  |  | C= | -0.0020532051517885733 | c= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN Diameter   Ï†mm | 100 |  | â—‡  CALCULATION â—‡ |  |  | TC  Cond | 54.4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN SPEED               (rpm) | 2850 |  | Fan out air temp         T3      (â„ƒ) | -19.125633533951014 |  | TE  Evap | -23.3 |  | R-600a | R-134a |  | AW= | -403.45924099760987 | Rotational Speed â€‹â€‹Correction |  |  |  |  |  |  |  |  |  |  |  |  |  |
| FAN INPUT                (W) | 2.4 |  | R Air Volume             MR     (m3/h) | 6.33564221465305 | 0.043276244635608266 | Pc (Tcond) | 7.835776826532984 |  | 7.835776826532984 | 14.992292497076312 |  | BW= | -10.669447614327456 | Ka= | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| DEF. HEATER INPUT        (W) | 112 |  | F Air Volume             MF     (m3/h) | 140.06435778534694 |  | Pe (Teva) | 0.6399178637701737 |  | 0.6399178637701737 | 1.171334242712946 |  | CW= | 13.074324324321825 | Kb= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp ON     (W) | 2 |  | QF'  (FAN)                    (kcal/h) | 24.04444868218791 |  | Hout (kcal/kg) | 174.0792661518202 |  | 174.0792661518202 | 155.0895912232625 |  | DW= | 0.34869206555942833 | Kc= | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| PWB input     Comp OFF    (W) | 1 |  | QR'  (FAN)                    (kcal/h) | 21.37846530150009 |  | Hin  (kcal/kg) | 94.32347647011841 |  | 94.32347647011841 | 110.7072242203688 |  | EW= | 0.037469902334827346 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| TIMER   Period          (hr) | 10.5 |  | QEV'    =M*Î³*CP*(TEVIN-TEVOUT)*PR | 4.4562629996327745 |  | V(specific volumeï¼‰ | 0.6860064886989208 |  | 0.6860064886989208 | 0.21089214370746862 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Def. HEATER   ON  time  (min) | 0 |  | Air Speed in Evaporator       (m/sec) | 1.591712656724986 |  | G(mass flow rate) | 1.5079162699869755 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DENSITY(Air)      Î³     (kg/m3) | 1.365 |  | EV INLET  Air   Temp.     T1     (â„ƒ) | -17.091198862652227 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Cp(Air 0â„ƒ)              (kcal/kgâ„ƒ) | 0.24 |  | LOG. MEAN TEMP. DIFF. OF EVA.  (â„ƒ) | 5.2621549906485106 |  | Rated capacity | 120.26505288669749 | kcal/h |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | SUB CAL. X | 1.528895615294822 |  |  | 139.84308475197383 | W | å…¥åŠ›å›žè»¢æ•°è£œæ­£ |  |  |  | TC= | 32.959973536317754 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  EVAPORATOR  (NALCO)  â—‡ |  |  | EVA  Heat transfer Î± ( kcal/hm2â„ƒ) | 15.680949738109854 |  | Rated input(ï¼·ï¼‰ | 134.74999999999494 | W | Kw= | 1 |  |  | Te= | -23.549167094296358 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV WIDTH  (=30mm*N)      (mm) | 440.5 |  | EV TEMPRATURE                  (â„ƒ) | -23.549167094296358 |  | COP | 1.03779654732452 | W=(AW+BW*TE+CW*TC*TE+DW*TE^2)*Kw*Rpm/Rpm0 |  |  |  |  | T0= | 25 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV DEPTH                 (mm) | 58 |  | QEV''(Ability of Evaporator)  (kcal/h) | 107.14527100691862 |  |  |  |  |  |  |  |  | Tsub= | 22.959973536317754 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| EV Tire (pitch) | 5 |  | COMP INPUT | 28.858397981949786 |  | â—‡  Cooling capacity of Refrigerator Condition  â—‡ |  |  |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Diameter  Ï† mm | 8 |  | ON Time INPUT | 33.258397981949784 |  | Pc (Tcond) | 4.527779307783581 |  | Capi Sub-cool | 10 |  | Pc= | 4.527779307783581 | 8.54402304391223 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface  27*77mm/pc | 0.003956656 |  | Energy consumption kWh/24h | 0.3844128865106425 |  | Pe (Teva) | 0.6329531083276008 |  | TC-Sub cool | 22.959973536317754 |  | Pe= | 0.6329531083276008 | 1.158389818606113 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Toatal fin quqntity | 296 |  | KWH/MONTH | 11.532386595319274 |  | V(m3/kgï¼‰ | 0.6765218083059241 |  | Hevin | 88.75006836527743 |  | v= | 0.6765218083059241 | 0.2078160853243258 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Fin Surface    m2 | 1.1711701760000002 |  | Qcomp(Ability of Compressor)   (kcal/h) | 107.14527096393257 |  | Volume Efficiency | 0.8330148517604343 |  | Hevout | 152.98583124731502 |  | Hevin= | 88.75006836527743 | 107.52874247327101 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pipe Surface  Ï†8mm | 0.11086504 |  | How many defrost in a day   ï¼ˆTimes/24h) | 1.0640651414166316 |  | G(kg/h) | 1.6680002876387396 |  | QCOMP | 107.14527096393257 |  | Hevout= | 152.98583124731502 | 144.00350205972978 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Side Plate surface | 0.01645 |  | Defrosting cycle   Hr | 22.555010088994987 |  |  |  |  | COMP INPUT | 28.858397981949786 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| SURFACE OF EVAPORATOR    (m2) | 1.2984852160000002 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | â—‡  Condenser Heat Exchange   â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡ quantity of Evaporator fin  â—‡ |  |  | â—‡  ï¼¶ï¼¡ï¼²ï¼©ï¼¡ï¼¢ï¼¬ï¼¥  â—‡ |  |  | ï¼² Front | 10.713009027188813 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Evaporator Fin quantity | æžšæ•° |  | Calculate Cond Temp?  Yes=1, No=0 | 1 |  | ï¼¦ï¼² Partition | 4.916297379443706 |  | ç†±é€šéŽçŽ‡ | é¢ç© |  | ã‚µã‚¤ãƒ‰ã‚³ãƒ³ãƒ»ãƒãƒƒã‚¯ã‚³ãƒ³ã®ç†±é€šéŽçŽ‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 part | 67 |  | X1 =EV OUT  Temp.          T2     (â„ƒ) | -19.325223898279788 | Trial | ï¼¦ Front | 6.64750768500198 |  | K | S |  |  | K | Pipe Pitch |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 part | 73 |  | X2 =RUNNING RATIO          PR     (ï¼…) | 0.46552849936977625 | Trial | Sid  Condenser | 96.37625566565463 | Side Cond | 5.395 | 2.244228 |  | Side Cond | 5.395 | 150 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 part | 73 |  | X3 = âŠ¿T ( TC-T0) | 7.959973536317755 |  | Back Condenser | 28.557641484229343 | Back Cond | 4.17 | 0.860349 |  | Back Cond | 4.17 | 200 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 part | 47 |  |  |  |  | TOTAL  QC0ut | 147.21071124151848 | ãƒãƒƒã‚¯ã‚³ãƒ³æ”¾ç†±åŠ¹çŽ‡ |  | 0.7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 part | 36 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 part | 0 |  | â—‡  ï¼£ï¼¯ï¼®ï¼¤ï¼©ï¼´ï¼©ï¼¯ï¼®  â—‡ |  |  | â—‡ Radiate Heat â—‡ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7 part |  |  | F1= QF-QF' | 2.4309807145073137e-07 | T2 | Q COND  Qcin | 147.21071190419318 | kcal/kg | Discharge |  |  |  | TC= | 32.959973536317754 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 8 part |  |  | F2= Qtotal-Qcomp*PR | 2.0011221124605072e-08 | Pr | enthalpy |  |  | Temp | 60 |  |  | Td= | 60 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Total | 296 |  | F3= QCout-QCin | -6.626746937854477e-07 | Tc | COND. IN | 183.04504142019874 | kcal/kg |  |  |  |  | R-600a | R-134a |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | COND. OUT | 94.78923415496853 | kcal/kg |  |  |  | Hcod nin | 183.04504142019874 | 158.2780772324761 |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  | Hcond out | 94.78923415496853 | 110.97352290370623 |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Outer Cab. Temp Rise |  | Cab. Temp. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | F,R Cab | 4.294405722843429 | 26.99916825184028 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  | Back Cab | 3.3193089646445038 | 26.5452329212556 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

**Rows with data:** 49
**Columns:** 28
**File type:** Values (calculated results)

---
## pv73 calc_SIZE_formulas.md

# Sheet: SIZE - FORMULAS (Original Excel Formulas)

*This shows the actual formulas as entered in Excel*

*Formulas are shown in `code blocks` for clarity*

## Formula Table

| =MAIN!A1 | Column_B | Column_C | Column_D | PR= | =MAIN!E38 | TF= | =MAIN!B5 | T2= | =MAIN!E37 | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `=MAIN!A2` |  | CP | 70mm |  |  | TR= | `=MAIN!B6` | Cab Side | `=MAIN!I50` |  |  |  |  |  |  |  |
|  |  |  |  | Comp temp | `=50*F1+H4` | TC= | `=MAIN!B7` | Back cab | `=MAIN!I51` |  |  |  |  |  |  |  |
| â—‡  ï¼³  ï¼©  ï¼º  ï¼¥  â—‡ | (mm) |  |  |  |  | T0= | `=MAIN!B8` | Cab Bottom | `=(F3-H4)*F1+H4` |  |  |  |  |  |  |  |
| â—‡  BASIC  SIZE  â—‡ |  |  | â—‡  Heat Load  â—‡ |  |  |  | B=K*S |  |  |  |  |  |  |  |  |  |
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
| â—‡ THICKNESS OF WALL â—‡ |  |  | F TOP | `=H16*(J16-I16)` | `=(B$9-(B$24+B$25)/2)*(B10-B$26/2)*10^(-6)` | `=1/(1/B$41+1/B$41+B23/1000/(B$34+0.00011*(I16+J16)/2))` | `=G16*F16` | `=H1` | `=H2` |  |  |  |  |  |  |  |
| R TOP | 55 |  | F LEFT | `=H17*(J17-I17)` | `=((B8-(B21+B27)/2)*(B10-B26/2)-((B13+B12)*B11/2))*10^(-6)` | `=1/(1/B$40+1/B$41+B24/1000/(B$34+0.00011*(I17+J17)/2))` | `=G17*F17` | `=H1` | `=J2` |  |  |  |  |  |  |  |
| R LEFT | 57 |  | F FIGHT | `=H18*(J18-I18)` | `=F17` | `=1/(1/B$40+1/B$41+B25/1000/(B$34+0.00011*(I18+J18)/2))` | `=G18*F18` | `=H1` | `=J2` |  |  |  |  |  |  |  |
| R RIGHT | 57 |  | F BOTTOMã€€1 | `=H19*(J19-I19)` | `=(B9-(B24+B25)/2)*B12*10^(-6)` | `=1/(1/B$40+1/B$41+B27/1000/(B$34+0.00011*(I19+J19)/2))` | `=G19*F19` | `=H1` | `=J4` |  |  |  |  |  |  |  |
| R BACK | 80 |  | F BOTTOMã€€2 | `=H20*(J20-I20)` | `=(B9-(B24+B25)/2)*(SQRT(B11^2+(B13-B12)^2))*10^(-6)` | `=1/(1/B$40+1/B$41+B28/1000/(B$34+0.00011*(I20+J20)/2))` | `=G20*F20` | `=H1` | `=J4` |  |  |  |  |  |  |  |
| R BOTTOM â€» | 32 |  | F BOTTOMã€€3 | `=H21*(J21-I21)` | `=(B9-(B24+B25)/2)*(B10-B13)*10^(-6)` | `=1/(1/B$40+1/B$41+B29/1000/(B$34+0.00011*(I21+J21)/2))` | `=G21*F21` | `=H1` | `=H4` |  |  |  |  |  |  |  |
| R DOOR | 58 |  | F DOOF | `=H22*(J22-I22)` | `=(B9-B36*2)*(B8-B14/2-B36*2)*10^(-6)` | `=1/(1/B$40+1/B$41+B30/1000/(B$34+0.00011*(I22+J22)/2))` | `=G22*F22` | `=H1` | `=H4` |  |  |  |  |  |  |  |
| F TOP â€» | 32 |  | F PACKIN | `=H23*(J23-I23)` | `=((B8-B36*2)+(B9-B36*2))*2*10^(-3)` | `=B37` | `=G23*F23` | `=H1` | `=H4` |  |  |  |  |  |  | 1 |
| F LEFT | 82 |  | F DPCON(F-FFont) | `=(0.0546*(MAIN!B7-MAIN!B5)-0.0491*(MAIN!B8-MAIN!B5))*F24*MAIN!E38` | `=(B8*2+B9)*10^(-3)` | * | * | * | * |  |  |  |  |  |  | 2 |
| F RIGHT | 82 |  | PWB Heat LOAD | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| EVA BACK | 55 |  | EVA BACK | `=H26*(J26-I26)` | `=(B9-(B24+B25)/2)*(B8-B11-(B23+B27)/2)*10^(-6)` | `=1/(1/B$40+1/B$41+B26/1000/(B$34+0.00011*(I26+J26)/2))` | `=G26*F26` | `=J1` | `=J3` |  |  |  |  |  | 3 |  |
| F BOTTOM 1 | 76 |  | FAN LOAD (FAN INPUT*0.86*Prï¼‰ | `=MAIN!B14*0.86*MAIN!E38` |  |  |  |  |  |  |  |  |  |  |  |  |
| F BOTTOM 2 | 80 |  | DEF. HEATER LOAD | `=MAIN!B15*0.86*MAIN!B19/60/24` |  |  |  |  |  |  |  |  |  |  |  |  |
| F BOTTOM 3 | 82 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F DOOR | 80 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  Thermal Conductivity  â—‡ | (kcal/mhâ„ƒ) |  | QF     TOTAL(kcal/h)  (inlet) | `=SUM(E16:E25)` |  |  |  |  |  |  |  |  |  |  |  |  |
| URETANE | 0.0165 |  | QR     TOTAL(kcal/h)  (inlet) | `=SUM(E7:E15)` |  |  |  |  |  |  |  |  |  |  |  |  |
| A=X-0.00011*T          X= | `=B33-0.00011*25` |  | QEVOUT TOTAL(kcal/h)  (inlet) | `=SUM(E26:E28)` |  |  |  |  |  |  |  |  |  |  |  |  |
| PS FORM     Î» | 0.035 |  | QEV  (=QF+QR+QEVOUT) | `=SUM(E32:E34)` |  |  |  |  |  |  |  |  |  |  |  |  |
| Packing position  L mm | 15 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PAKKIN | 0.035 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  Heat trancefer coefficent â—‡ | (kcal/m2hâ„ƒ) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
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

---
## pv73 calc_SIZE_values.md

# Sheet: SIZE - VALUES (Calculated/Displayed)

*This shows the calculated values as they appear in Excel*

## Data Table

| FAN COOL MODEL | Column_B | Column_C | Column_D | PR= | 0.46552849936977625 | TF= | -18 | T2= | -19.325223898279788 | Column_K | Column_L | Column_M | Column_N | Column_O | Column_P | Column_Q |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <  SJ-pv73k   > |  | CP | 70mm |  |  | TR= | 3 | Cab Side | 26.99916825184028 |  |  |  |  |  |  |  |
|  |  |  |  | Comp temp | 48.27642496848881 | TC= | 32.959973536317754 | Back cab | 26.5452329212556 |  |  |  |  |  |  |  |
| â—‡  ï¼³  ï¼©  ï¼º  ï¼¥  â—‡ | (mm) |  |  |  |  | T0= | 25 | Cab Bottom | 35.83583918627379 |  |  |  |  |  |  |  |
| â—‡  BASIC  SIZE  â—‡ |  |  | â—‡  Heat Load  â—‡ |  |  |  | B=K*S |  |  |  |  |  |  |  |  |  |
| TOTAL HIGHT         H | 1794 |  | POSITION | Q(kcal/h) | S(m2) or L(m) | K | B | INSIDE TEMP | OUTSIDE TEMP |  |  |  |  |  |  |  |
| R HIGHT             HR | 1048 |  | R TOP | 2.7187540739821245 | 0.47748599999999997 | 0.25881330685203574 | 0.12357973063555112 | 3 | 25 |  |  |  |  |  |  |  |
| F HIGHT             HF | 746 |  | R LERT | 3.930803515736131 | 0.6499115 | 0.2520176302892344 | 0.16378915612772177 | 3 | 26.99916825184028 |  |  |  |  |  |  |  |
| WIDTH               W | 795 |  | R RIGHT | 3.930803515736131 | 0.6499115 | 0.2520176302892344 | 0.16378915612772177 | 3 | 26.99916825184028 |  |  |  |  |  |  |  |
| DEPTH               D | 687 |  | R BOTTOM | -3.7473366358247793 | 0.47748599999999997 | 0.3737169293046118 | 0.17844460170594187 | 3 | -18 |  |  |  |  |  |  |  |
| BOTOM HIGHT        Hb | 248 |  | R BACK | 3.191009484951473 | 0.741321 | 0.18281793584918682 | 0.13552677502165503 | 3 | 26.5452329212556 |  |  |  |  |  |  |  |
| BOTTOM DEPTH       Db1 | 195 |  | R DOOR | 4.1992138692598475 | 0.774945 | 0.24630568323381585 | 0.19087335769362943 | 3 | 25 |  |  |  |  |  |  |  |
| BOTTOM DEPTH       Db2 | 261 |  | R PACKIN | 2.7458200000000006 | 3.5660000000000003 | 0.035 | 0.12481000000000002 | 3 | 25 |  |  |  |  |  |  |  |
| Door gap of F&R door | 10 |  | R DPCON1(RR-Partition) | 3.151123325107604 | 0.681 | * | * | * | * |  |  |  |  |  |  |  |
|  |  |  | R DPCON2(R-Rront) | 1.2582741525515564 | 2.891 | * | * | * | * |  |  |  |  |  |  |  |
| â—‡ THICKNESS OF WALL â—‡ |  |  | F TOP | 3.69034013264421 | 0.47022349999999996 | 0.3737169293046118 | 0.17573048250686713 | -18 | 3 |  |  |  |  |  |  |  |
| R TOP | 55 |  | F LEFT | 2.987173481772801 | 0.39982999999999996 | 0.1660277115326437 | 0.06638285990209693 | -18 | 26.99916825184028 |  |  |  |  |  |  |  |
| R LEFT | 57 |  | F FIGHT | 2.987173481772801 | 0.39982999999999996 | 0.1660277115326437 | 0.06638285990209693 | -18 | 26.99916825184028 |  |  |  |  |  |  |  |
| R RIGHT | 57 |  | F BOTTOMã€€1 | 1.3795157219861334 | 0.139035 | 0.18430241499320044 | 0.025624486268579622 | -18 | 35.83583918627379 |  |  |  |  |  |  |  |
| R BACK | 80 |  | F BOTTOMã€€2 | 1.729000206801049 | 0.1829786390265268 | 0.17551860762034943 | 0.03211615594620251 | -18 | 35.83583918627379 |  |  |  |  |  |  |  |
| R BOTTOM â€» | 32 |  | F BOTTOMã€€3 | 2.1524415302672284 | 0.303738 | 0.16480249350972376 | 0.050056779773656475 | -18 | 25 |  |  |  |  |  |  |  |
| R DOOR | 58 |  | F DOOF | 3.9464830794284302 | 0.5439149999999999 | 0.1687371671415156 | 0.09177867626577745 | -18 | 25 |  |  |  |  |  |  |  |
| F TOP â€» | 32 |  | F PACKIN | 4.45781 | 2.962 | 0.035 | 0.10367000000000001 | -18 | 25 |  |  |  |  |  |  | 1 |
| F LEFT | 82 |  | F DPCON(F-FFont) | 0.7145112906133265 | 2.287 | * | * | * | * |  |  |  |  |  |  | 2 |
| F RIGHT | 82 |  | PWB Heat LOAD | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| EVA BACK | 55 |  | EVA BACK | 3.495412176933517 | 0.31657199999999996 | 0.24070927766986722 | 0.0762018174505052 | -19.325223898279788 | 26.5452329212556 |  |  |  |  |  | 3 |  |
| F BOTTOM 1 | 76 |  | FAN LOAD (FAN INPUT*0.86*Prï¼‰ | 0.9608508226992182 |  |  |  |  |  |  |  |  |  |  |  |  |
| F BOTTOM 2 | 80 |  | DEF. HEATER LOAD | 0 |  |  |  |  |  |  |  |  |  |  |  |  |
| F BOTTOM 3 | 82 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| F DOOR | 80 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  Thermal Conductivity  â—‡ | (kcal/mhâ„ƒ) |  | QF     TOTAL(kcal/h)  (inlet) | 24.04444892528598 |  |  |  |  |  |  |  |  |  |  |  |  |
| URETANE | 0.0165 |  | QR     TOTAL(kcal/h)  (inlet) | 21.378465301500093 |  |  |  |  |  |  |  |  |  |  |  |  |
| A=X-0.00011*T          X= | 0.01375 |  | QEVOUT TOTAL(kcal/h)  (inlet) | 4.456262999632735 |  |  |  |  |  |  |  |  |  |  |  |  |
| PS FORM     Î» | 0.035 |  | QEV  (=QF+QR+QEVOUT) | 49.87917722641881 |  |  |  |  |  |  |  |  |  |  |  |  |
| Packing position  L mm | 15 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PAKKIN | 0.035 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| â—‡  Heat trancefer coefficent â—‡ | (kcal/m2hâ„ƒ) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| OUTSIDE | 6 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| INSIDE | 10 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | VOLUME: |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Refrigeratorr Gross volume | 403.859559 | 59 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Freezer   Gross Volume | 225.130704 | 125 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | TOTAL | 628.990263 | 184 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | ISO VOLUME |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Freezer VOLUME | 348.695154 | 48 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | Refrigerator | 212.872704 | 120 |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  | TOTAL | 561.567858 | 168 |  |  |  |  |  |  |  |  |  |  |  |
| DOOR |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Packing |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

**Rows with data:** 48
**Columns:** 17
**File type:** Values (calculated results)

