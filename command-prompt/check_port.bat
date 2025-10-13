@echo off
echo PID     Process Name         Local Address          State
for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING') do (
  for /f "tokens=1,2" %%b in ('tasklist /FI "PID eq %%a" /FO TABLE /NH') do (
    echo %%a    %%b               %%a
  )
)
pause
