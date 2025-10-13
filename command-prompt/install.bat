@echo off
setlocal enabledelayedexpansion
set "NODE_URL=https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi"
set "NODE_INSTALLER=node-v20.12.2-x64.msi"
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found.
    echo Downloading Node.js installer...
    bitsadmin /transfer nodeDownloadJob /download /priority normal "%NODE_URL%" "%CD%\%NODE_INSTALLER%"
    if not exist "%NODE_INSTALLER%" (
        echo Failed to download Node.js. Please install manually from https://nodejs.org
        pause
        exit /b 1
    )
    echo Installing Node.js silently...
    msiexec /i "%NODE_INSTALLER%" /quiet /norestart
    echo Waiting for installation to complete...
    timeout /t 15 >nul
    node -v >nul 2>&1
    if %errorlevel% neq 0 (
        echo Node.js installation failed or not added to PATH yet.
        echo Please restart your system or install Node.js manually.
        pause
        exit /b 1
    )
) else (
    echo Node.js is already installed.
)
if not exist node_modules (
    echo node_modules folder not found.
) else (
    echo node_modules folder exists.
)
choice /M "Do you want to install required packages"
if errorlevel 2 (
    echo Skipping package installation.
) else (
    echo Installing packages...
    npm install 
    if %errorlevel% neq 0 (
        echo Package installation failed.
        pause
        exit /b 1
    )
)

echo Setup complete.
pause
exit /b 0
