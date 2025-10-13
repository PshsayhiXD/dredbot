@echo off
setlocal enabledelayedexpansion
set "tempDir=..\temp"
set "logCount=0"
for %%f in ("%tempDir%\*.log") do (
    set /a logCount+=1
)
echo Found !logCount! log file(s).
if !logCount! GEQ 5 (
    choice /m "!logCount! logs found. Do you want to delete all temp files?"
    if errorlevel 2 (
        echo Cancelled.
        exit /b
    )
)
echo Deleting !logCount! log file(s)...
rd /s /q "%tempDir%"
mkdir "%tempDir%"
echo Done.
pause
