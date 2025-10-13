@echo off
setlocal
if not exist certs (
    mkdir certs
)
set KEY_FILE=certs\key.pem
set CERT_FILE=certs\cert.pem
echo Generating 365-day self-signed certificate and key...
openssl req -x509 -newkey rsa:2048 -nodes -keyout %KEY_FILE% -out %CERT_FILE% -days 365 -subj "/CN=localhost"
if exist %KEY_FILE% if exist %CERT_FILE% (
    echo.
    echo Success!
    echo   - Private Key: %KEY_FILE%
    echo   - Certificate: %CERT_FILE%
) else (
    echo.
    echo [-] Failed to generate certificate or key.
)

pause
