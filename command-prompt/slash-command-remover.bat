@echo off
cd /d "D:\Pshsayhi FIles\Dredbots\dredbot_server_data"

echo [Slash Command Remover]
set /p commandName=Enter command name to remove (or type "all" to remove all): 
set /p scope=Enter "global", "guild", or custom guild ID (leave blank for default guild):

if "%scope%"=="" (
    set "scope=guild"
)

echo.
echo [INFO] Removing "%commandName%" from "%scope%"...
node "commands\Slash\slash-remover.js" %commandName% %scope%

if errorlevel 1 (
    echo.
    echo [ERROR] The command failed with exit code %errorlevel%.
) else (
    echo.
    echo [SUCCESS] Command removal completed.
)

pause
