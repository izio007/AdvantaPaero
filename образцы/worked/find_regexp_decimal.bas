Attribute VB_Name = "Module1"
Sub CopyAllCodes_WithColumnC()
    Dim src As Worksheet, dst As Worksheet
    Dim lastRow As Long, i As Long
    Dim valB As String, valG As String, valC As String
    Dim re As Object, matches As Object
    Dim matchItem As Object
    Dim sheetName As String
    Dim destRow As Long
    Dim foundCount As Long
    
    sheetName = "Результат_Final"
    Set src = ActiveSheet
    
    If src.Name = sheetName Then
        MsgBox "Перейди на лист с данными!", vbExclamation
        Exit Sub
    End If
    
    On Error Resume Next
    Set dst = ThisWorkbook.Sheets(sheetName)
    On Error GoTo 0
    
    If dst Is Nothing Then
        Set dst = ThisWorkbook.Sheets.Add(After:=src)
        dst.Name = sheetName
    Else
        dst.Cells.Clear
    End If
    
    ' Заголовки
    dst.Cells(1, 1).Value = "Код"
    dst.Cells(1, 2).Value = "Данные из C"
    
    ' Паттерн: минимум 3 точки, буквы (латиница+кириллица), цифры
    Set re = CreateObject("VBScript.RegExp")
    re.Global = True
    re.IgnoreCase = True
    re.Pattern = "[A-Za-zА-Яа-яЁё0-9]+(\.[A-Za-zА-Яа-яЁё0-9]+){3,}"
    
    lastRow = src.Cells(src.Rows.Count, "B").End(xlUp).Row
    Dim lastRowG As Long
    lastRowG = src.Cells(src.Rows.Count, "G").End(xlUp).Row
    If lastRowG > lastRow Then lastRow = lastRowG
    
    destRow = 2
    foundCount = 0
    Application.ScreenUpdating = False
    
    For i = 1 To lastRow
        valC = CStr(src.Cells(i, "C").Value)
        
        ' Проверка столбца B
        valB = CStr(src.Cells(i, "B").Value)
        If Len(Trim(valB)) > 0 Then
            Set matches = re.Execute(valB)
            For Each matchItem In matches
                dst.Cells(destRow, 1).Value = matchItem.Value
                dst.Cells(destRow, 2).Value = valC
                destRow = destRow + 1
                foundCount = foundCount + 1
            Next matchItem
        End If
        
        ' Проверка столбца G
        valG = CStr(src.Cells(i, "G").Value)
        If Len(Trim(valG)) > 0 Then
            Set matches = re.Execute(valG)
            For Each matchItem In matches
                dst.Cells(destRow, 1).Value = matchItem.Value
                dst.Cells(destRow, 2).Value = valC
                destRow = destRow + 1
                foundCount = foundCount + 1
            Next matchItem
        End If
    Next i
    
    dst.Columns("A:B").AutoFit
    Application.ScreenUpdating = True
    dst.Activate
    
    MsgBox "Готово!" & vbCrLf & _
           "Найдено кодов: " & foundCount & vbCrLf & _
           "Лист: " & dst.Name, vbInformation
End Sub


