# VBA Macros




Sub Macro2()

Dim AA(10, 10), X(10), FX0(10), FX1(10), FDX(10)

' ƒnƒ“ƒ`ƒ“ƒO Macro
' ƒ}ƒNƒ‹L˜^“ú : 2002/4/13  ƒ†[ƒU[–¼ : takatori
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
