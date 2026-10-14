Attribute VB_Name = "Module1"
'ws.Cells(lastRow + 1, 1).Select
'ws.Outline.SummaryRow = xlSummaryAbove

Private Sub SetColumnWidthsByHeader()
    Dim ws As Worksheet
    Set ws = ActiveSheet
    
    Const commonWidth As Double = 11.45
    
    Dim lastCol As Long
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol)).EntireColumn.ColumnWidth = commonWidth
    

    Dim specialColumns As Variant
    specialColumns = Array( _
        Array("Руководитель", 19.45), _
        Array("Название проекта", 92.18), _
        Array("Уровень вложенности", 3.64), _
        Array("Исполнитель", 19.45) _
    )


    Dim i As Long
    Dim headerName As String
    Dim targetWidth As Double
    Dim foundCell As Range
    
    For i = LBound(specialColumns) To UBound(specialColumns)
        headerName = specialColumns(i)(0)
        targetWidth = specialColumns(i)(1)
        
        Set foundCell = Nothing
        Set foundCell = ws.Rows(1).Find( _
            What:=headerName, _
            LookIn:=xlValues, _
            LookAt:=xlPart, _
            SearchOrder:=xlByColumns _
        )
        
        If Not foundCell Is Nothing Then
            ws.Columns(foundCell.Column).ColumnWidth = targetWidth
        Else
        End If
    Next i
    
'    MsgBox "Ширина столбцов установлена: общая = " & commonWidth & ", особые заголовки обработаны."
End Sub


Sub FormatAsSmartTableWithTree()
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim lastCol As Long
    Dim tableRange As Range
    Dim i As Long, j As Long
    Dim currentLevel As Integer, nextLevel As Integer
    Dim progressCol As Long, pStartCol As Long, pEndCol As Long, fStartCol As Long, fEndCol As Long
    Dim nameCol As Long, codeCol As Long, statusCol As Long
    Dim tbl As ListObject
    Dim cellText As String
    Dim currentDate As Date
    Dim isParent As Boolean
    Dim isCompleted As Boolean
    Dim projCode As String
    Dim startPos As Long
    
    Set ws = ActiveSheet
    currentDate = Date
    
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    
    If lastRow < 2 Or lastCol < 1 Then Exit Sub
    
    Set tableRange = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol))
    
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    
    On Error Resume Next
    ws.ListObjects(1).Unlist
    ws.Cells.ClearOutline
    ws.Cells.Interior.Color = xlNone
    On Error GoTo 0
    
    progressCol = 0: pStartCol = 0: pEndCol = 0: fStartCol = 0: fEndCol = 0: nameCol = 0: codeCol = 0: statusCol = 0
    For j = 1 To lastCol
        cellText = ws.Cells(1, j).Value
        If InStr(1, cellText, "Процент", vbTextCompare) > 0 Or InStr(1, cellText, "выполн", vbTextCompare) > 0 Then progressCol = j
        If InStr(1, cellText, "План: Начало", vbTextCompare) > 0 Then pStartCol = j
        If InStr(1, cellText, "План: Окончание", vbTextCompare) > 0 Then pEndCol = j
        If InStr(1, cellText, "Факт: Начало", vbTextCompare) > 0 Then fStartCol = j
        If InStr(1, cellText, "Факт: Окончание", vbTextCompare) > 0 Then fEndCol = j
        If InStr(1, cellText, "Название", vbTextCompare) > 0 Then nameCol = j
        If InStr(1, cellText, "Код проекта", vbTextCompare) > 0 Then codeCol = j
        If InStr(1, cellText, "Статус", vbTextCompare) > 0 Then statusCol = j
    Next j
    
    For i = 2 To lastRow
        For j = 1 To lastCol
            If Trim(ws.Cells(i, j).Value) = "-" Then ws.Cells(i, j).Value = ""
        Next j
        If pStartCol > 0 Then If IsDate(ws.Cells(i, pStartCol).Value) Then ws.Cells(i, pStartCol).Value = CDate(ws.Cells(i, pStartCol).Value)
        If pEndCol > 0 Then If IsDate(ws.Cells(i, pEndCol).Value) Then ws.Cells(i, pEndCol).Value = CDate(ws.Cells(i, pEndCol).Value)
        If fStartCol > 0 Then If IsDate(ws.Cells(i, fStartCol).Value) Then ws.Cells(i, fStartCol).Value = CDate(ws.Cells(i, fStartCol).Value)
        If fEndCol > 0 Then If IsDate(ws.Cells(i, fEndCol).Value) Then ws.Cells(i, fEndCol).Value = CDate(ws.Cells(i, fEndCol).Value)
    Next i
    
    Set tbl = ws.ListObjects.Add(xlSrcRange, tableRange, , xlYes)
    tbl.TableStyle = "TableStyleMedium4"
    tbl.ShowHeaders = True
    
    With tableRange
        .Font.Name = "Segoe UI"
        .Font.Size = 10
        .Font.Color = RGB(31, 41, 55)
        .VerticalAlignment = xlCenter
    End With
    
    ws.Activate
    ws.Cells(2, 1).Select
    ActiveWindow.FreezePanes = False
    ActiveWindow.FreezePanes = True
    
    ws.Cells(lastRow + 1, 1).Select
    ws.Outline.SummaryRow = xlSummaryAbove
    
    For i = 2 To lastRow
        If IsNumeric(ws.Cells(i, 1).Value) And ws.Cells(i, 1).Value <> "" Then
            currentLevel = CInt(ws.Cells(i, 1).Value)
        Else
            currentLevel = 0
        End If
        
        If i < lastRow Then
            If IsNumeric(ws.Cells(i + 1, 1).Value) And ws.Cells(i + 1, 1).Value <> "" Then
                nextLevel = CInt(ws.Cells(i + 1, 1).Value)
            Else
                nextLevel = 0
            End If
        Else
            nextLevel = 0
        End If
        
        isParent = (nextLevel > currentLevel)
        
        isCompleted = False
        If statusCol > 0 Then
            Dim progCheck As String
            progCheck = Trim(CStr(ws.Cells(i, statusCol).Value))
            If progCheck = "Выполнено" Or progCheck = "Завершено" Or progCheck = "Завершён" Or progCheck = "Готово" Then
                isCompleted = True
            End If
        End If
        
        ws.Rows(i).RowHeight = 21
        
        If currentLevel > 0 And currentLevel <= 7 Then
            On Error Resume Next
            ws.Rows(i).OutlineLevel = currentLevel + 1
            On Error GoTo 0
        End If
        
        Select Case currentLevel
            Case 0
                With ws.Range(ws.Cells(i, 1), ws.Cells(i, lastCol))
                    .Font.Bold = True
                    .Font.Size = 11.5
                    .Interior.Color = RGB(229, 231, 235)
                End With
            Case 1
                With ws.Range(ws.Cells(i, 1), ws.Cells(i, lastCol))
                    .Font.Bold = True
                    .Font.Size = 10.5
                    .Interior.Color = RGB(243, 244, 246)
                End With
            Case 2, 3
                With ws.Range(ws.Cells(i, 1), ws.Cells(i, lastCol))
                    .Font.Size = 10
                    .Font.Bold = isParent
                    If isCompleted Then .Font.Color = RGB(160, 165, 175)
                End With
            Case Else
                With ws.Range(ws.Cells(i, 1), ws.Cells(i, lastCol))
                    .Font.Size = 9.5
                    .Font.Bold = isParent
                    If isParent Then
                        .Font.Color = RGB(50, 55, 65)
                    Else
                        If isCompleted Then
                            .Font.Color = RGB(160, 165, 175)
                        Else
                            .Font.Color = RGB(90, 100, 115)
                        End If
                    End If
                End With
        End Select
        
        If codeCol > 0 Then
            If isCompleted Then
                ws.Cells(i, codeCol).Font.Strikethrough = True
            Else
                ws.Cells(i, codeCol).Font.Strikethrough = False
            End If
        End If
        
        ws.Cells(i, 1).HorizontalAlignment = xlCenter
        
        If fStartCol > 0 And pStartCol > 0 Then
            If IsDate(ws.Cells(i, fStartCol).Value) And IsDate(ws.Cells(i, pStartCol).Value) Then
                If ws.Cells(i, fStartCol).Value < ws.Cells(i, pStartCol).Value Then
                    ws.Cells(i, fStartCol).Interior.Color = RGB(254, 226, 226)
                    ws.Cells(i, fStartCol).Font.Color = RGB(185, 28, 28)
                End If
            End If
        End If
        
        If pEndCol > 0 And fEndCol > 0 Then
            If IsDate(ws.Cells(i, pEndCol).Value) And ws.Cells(i, fEndCol).Value = "" Then
                If ws.Cells(i, pEndCol).Value < currentDate Then
                    ws.Cells(i, pEndCol).Interior.Color = RGB(255, 247, 237)
                    ws.Cells(i, pEndCol).Font.Color = RGB(194, 65, 12)
                    ws.Cells(i, pEndCol).Font.Bold = True
                End If
            End If
        End If
        
        If progressCol > 0 Then
            If isCompleted Then
                With ws.Cells(i, progressCol)
                    .Interior.Color = RGB(187, 215, 196)
                    .Font.Color = RGB(120, 125, 122)
                    .Font.Bold = False
                End With
            End If
        End If
        
        If nameCol > 0 Then
            Dim textValue As String
            textValue = CStr(ws.Cells(i, nameCol).Value)
            If textValue Like "*[U*]*" Then
                startPos = InStr(textValue, "[")
                If startPos > 0 Then
                    projCode = Mid(textValue, startPos, InStr(textValue, "]") - startPos + 1)
                    With ws.Cells(i, nameCol).Characters(startPos, Len(projCode)).Font
                        .Color = -65536
                        .FontStyle = "жирный"
                    End With
                End If
            End If
        End If
    Next i
    
    For j = 1 To lastCol
        If j = pStartCol Or j = pEndCol Or j = fStartCol Or j = fEndCol Then
            ws.Columns(j).NumberFormat = "dd.mm.yyyy"
            ws.Columns(j).HorizontalAlignment = xlCenter
        End If
    Next j
    
    SetColumnWidthsByHeader
    
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    ActiveWorkbook.Save
    Range("C10").Select
    ActiveCell.FormulaR1C1 = _
        "        1.1.1.3.4 этап ПИ СЧ ОКР Защитник-К (АО НИИ ""Экран"") [UEN-ZAO-M-14316-03-N]"
    With ActiveCell.Characters(Start:=1, Length:=61).Font
        .Name = "Segoe UI"
        .FontStyle = "полужирный"
        .Size = 9.5
        .Strikethrough = False
        .Superscript = False
        .Subscript = False
        .OutlineFont = False
        .Shadow = False
        .Underline = xlUnderlineStyleNone
        .Color = -12503246
        .TintAndShade = 0
        .ThemeFont = xlThemeFontNone
    End With
    With ActiveCell.Characters(Start:=62, Length:=22).Font
        .Name = "Segoe UI"
        .FontStyle = "полужирный"
        .Size = 9.5
        .Strikethrough = False
        .Superscript = False
        .Subscript = False
        .OutlineFont = False
        .Shadow = False
        .Underline = xlUnderlineStyleSingle
        .Color = -12503246
        .TintAndShade = 0
        .ThemeFont = xlThemeFontNone
    End With
    Range("C17").Select
    ActiveWindow.SmallScroll Down:=-40
    Range("C5").Select
    ActiveCell.FormulaR1C1 = "      1.1.1.СЧ ОКР Защитник-К [UEN-ZAO-M-14316]"
    With ActiveCell.Characters(Start:=1, Length:=30).Font
        .Name = "Segoe UI"
        .FontStyle = "полужирный"
        .Size = 10
        .Strikethrough = False
        .Superscript = False
        .Subscript = False
        .OutlineFont = False
        .Shadow = False
        .Underline = xlUnderlineStyleNone
        .Color = -13162209
        .TintAndShade = 0
        .ThemeFont = xlThemeFontNone
    End With
    With ActiveCell.Characters(Start:=31, Length:=17).Font
        .Name = "Segoe UI"
        .FontStyle = "полужирный"
        .Size = 10
        .Strikethrough = False
        .Superscript = False
        .Subscript = False
        .OutlineFont = False
        .Shadow = False
        .Underline = xlUnderlineStyleSingle
        .Color = -65536
        .TintAndShade = 0
        .ThemeFont = xlThemeFontNone
    End With
    Range("C10").Select
    ActiveCell.FormulaR1C1 = _
        "        1.1.1.3.4 этап ПИ СЧ ОКР Защитник-К (АО НИИ ""Экран"") [UEN-ZAO-M-14316-03-N]"
    With ActiveCell.Characters(Start:=1, Length:=61).Font
        .Name = "Segoe UI"
        .FontStyle = "полужирный"
        .Size = 9.5
        .Strikethrough = False
        .Superscript = False
        .Subscript = False
        .OutlineFont = False
        .Shadow = False
        .Underline = xlUnderlineStyleNone
        .Color = -12503246
        .TintAndShade = 0
        .ThemeFont = xlThemeFontNone
    End With
    With ActiveCell.Characters(Start:=62, Length:=22).Font
        .Name = "Segoe UI"
        .FontStyle = "полужирный"
        .Size = 9.5
        .Strikethrough = False
        .Superscript = False
        .Subscript = False
        .OutlineFont = False
        .Shadow = False
        .Underline = xlUnderlineStyleSingle
        .Color = -65536
        .TintAndShade = 0
        .ThemeFont = xlThemeFontNone
    End With
    Range("C13").Select
End Sub
Sub Макрос3()
Attribute Макрос3.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Макрос3 Макрос
'

'
    With Selection.Font
        .Color = -65536
        .TintAndShade = 0
    End With
End Sub
