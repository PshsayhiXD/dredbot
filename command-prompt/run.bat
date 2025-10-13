@echo off
setlocal enabledelayedexpansion
title Dredbot Server

set ip=

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set addr=%%a
  set addr=!addr: =!
  echo !addr! | findstr /r "10\.[0-9]*\.[0-9]*\.[0-9]* 192\.168\.[0-9]*\.[0-9]* 172\.[1-3][0-9]\.[0-9]*\.[0-9]*" >nul
  if not errorlevel 1 (
    set ip=!addr!
    goto :foundip
  )
)

:foundip
if defined ip (
  echo Detected local IP: %ip%
) else (
  echo No private IPv4 found.
)

cd /d "D:\Pshsayhi FIles\others\Ngrok"
echo 1 Starting Ngrok...
start "" ngrok.exe http --domain=intent-horribly-killdeer.ngrok-free.app https://%ip%:3002

timeout /t 5 /nobreak >nul

cd /d "D:\Pshsayhi FIles\Dredbots\dredbot_server_data"
echo 2 Starting servers...
start /b node localhost.js
if errorlevel 1 (
    echo Failed to start localhost.js
    goto :error
)
start /b node bot.js
if errorlevel 1 (
    echo Failed to start bot.js
    goto :error
)
start /b node utils/validator.js
if errorlevel 1 (
    echo Failed to validate Items
    goto :error
)

cd /d "D:\Pshsayhi FIles\Dredbots\cors-anywhere-master"
echo 3 Starting cors-anywhere...
start /b node server.js
if errorlevel 1 (
    echo Failed to start server.js
    goto :error
)

pause
timeout /t 2 /nobreak >nul

cd /d "D:\Pshsayhi FIles\Dredbots\dredbot_server_data"
echo 4 Starting UI...
node UI.js

pause
exit /b 0

:error
echo An error occurred while starting the server components.
pause
exit /b 1