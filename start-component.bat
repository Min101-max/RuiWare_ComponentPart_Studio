@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting component template generator...
start "Component Template Generator" /D "%~dp0" cmd /k "npm run dev -- --host 127.0.0.1 --port 5180"

set "URL=http://127.0.0.1:5180/"
echo Waiting for the local service...
for /L %%i in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 1; if ($response.StatusCode -ge 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
  if not errorlevel 1 goto open_browser
  timeout /t 1 /nobreak >nul
)

echo The service did not respond within 30 seconds.
pause
exit /b 1

:open_browser
echo Opening %URL% ...
start "" "%URL%"
if errorlevel 1 rundll32 url.dll,FileProtocolHandler "%URL%"
endlocal
