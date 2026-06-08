# VBA Macros






'
' Record2 ƒ}ƒNƒ
' Ï¸Û‹L˜^“ú : 1996/8/3  Õ°»Þ°–¼ : ƒVƒƒ[ƒv(Š”)
'
'

Dim N, AA(20, 20), F(10), TC(40), TE(40), PC(40), PE(40), Q(40), W(40), ETV(40), G(40), TEV, TD, IL, IGL, IG, VG, PL, PH, T, EAA(40), REI, ITC
    
Sub Record2()
Dim QU(40)
  

'  ƒf[ƒ^[‚Ì“Ç‚Ýž‚Ý
'  VC:ƒVƒŠƒ“ƒ_[—eÏ
'  RPM:‰ñ“]”
'  NE:ö”­‰·“x‚Ìƒf[ƒ^[”
'  NC:‹Ãk‰·“xƒf[ƒ^[”
'  NN:‘Sƒf[ƒ^[”
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
    
'  ‘ÌÏŒø—¦‚Ì‹ßŽ—Ž®ì¬
    
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
    
'@Å¬‚Qæ–@ŒvŽZƒ}ƒgƒŠƒNƒXì¬
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
    
'  ‘ÌÏŒø—¦‚ÌŒvŽZŒ‹‰Ê‚Ìˆóü
    
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
' ƒ}ƒgƒŠƒNƒX‚ÌŒvŽZ
    MATX
' ‘ÌÏŒø—¦‚ÌŒW”ˆóŽš
    E1 = AA(1, 4)
    E2 = AA(2, 4)
    E3 = AA(3, 4)
    Cells(21, 1) = "ƒÅv="
    Cells(21, 2) = E1
    
    Cells(21, 3) = E2
    Cells(21, 4) = "* PC/PE +"
    Cells(21, 5) = E3
    Cells(21, 6) = "* PC"
    
    If YN = "N" Then GoTo BX
'  “ü—Í‹ßŽ—Ž®‚Ìì¬
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
' ƒ}ƒgƒŠƒNƒX‚ÌŒvŽZ
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
    
'  ‘ÌÏŒø—¦‚ÌƒOƒ‰ƒt

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
    

    
'’èŠi—â“€”\—ÍA“ü—Í‚ÌŒvŽZ
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
    
    
    
'@—â“€”\—ÍA“ü—Í‚ÌŒvŽZ
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
' R-134a —â”}“Á«Ž®
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
' R-600a —â”}“Á«
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
    


