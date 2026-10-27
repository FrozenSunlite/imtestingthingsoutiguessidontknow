Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\\Users\\------\\Downloads\\Talent Tree\\Standalone\\standalone\\desktop"
WshShell.Run "cmd /c node serve.js", 0, False
