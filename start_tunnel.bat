@echo off
setlocal
REM ============================================================================
REM  In2IT ERP - start everything with one double-click:
REM    1. backend API   (http://127.0.0.1:8000, own window)
REM    2. frontend      (http://127.0.0.1:5173, own window)
REM    3. public tunnel (Cloudflare, this window)
REM  Anyone with the public link reaches this machine. Close this window (or
REM  Ctrl+C) to stop the tunnel; close the other two windows to stop the app.
REM
REM  Tunnel: ngrok is blocked by Windows Defender on company machines, so this uses
REM  cloudflared (C:\Program Files (x86)\cloudflared). Two modes:
REM    - Quick tunnel (default): free, no account; a new *.trycloudflare.com URL each start.
REM    - Fixed URL: create a named tunnel in Cloudflare Zero Trust (Networks > Tunnels)
REM      with a public hostname pointing to http://127.0.0.1:5173, then fill in the
REM      two values below.
REM
REM  One-time setup on a new machine:
REM    cd backend  &&  python -m venv .venv  &&  .venv\Scripts\pip install -e ".[dev]"
REM ============================================================================

REM --- Fixed URL (optional). Settings live in tunnel.local.cmd next to this file (git-ignored).
REM  Free fixed URL with Microsoft Dev Tunnels. One-time setup in a terminal:
REM     winget install Microsoft.devtunnel
REM     devtunnel user login
REM     devtunnel create in2erp-dev
REM     devtunnel port create in2erp-dev -p 5173
REM     devtunnel access create in2erp-dev --tenant      (only your organisation's accounts)
REM  then in tunnel.local.cmd:
REM     set DEVTUNNEL_ID=in2erp-dev
REM  Or a Cloudflare named tunnel on your own domain:
REM     set CF_TUNNEL_TOKEN=<token>
REM     set CF_HOSTNAME=erp.example.com
set DEVTUNNEL_ID=
set CF_TUNNEL_TOKEN=
set CF_HOSTNAME=

set ROOT=%~dp0
if exist "%ROOT%tunnel.local.cmd" call "%ROOT%tunnel.local.cmd"
set PY=%ROOT%backend\.venv\Scripts\python.exe
set CLOUDFLARED=C:\Program Files (x86)\cloudflared\cloudflared.exe
if not exist "%CLOUDFLARED%" set CLOUDFLARED=cloudflared
REM Lets the dev server accept the fixed hostname (trycloudflare.com is always allowed).
if defined CF_HOSTNAME set VITE_ALLOWED_HOSTS=%CF_HOSTNAME%

if not exist "%PY%" (
  echo [ERROR] Backend environment not found: %PY%
  echo         Run: cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\pip install -e ".[dev]"
  pause & exit /b 1
)

echo [1/4] Updating database schema...
pushd "%ROOT%backend"
"%PY%" -m alembic upgrade head
if errorlevel 1 ( echo [ERROR] Database migration failed. & popd & pause & exit /b 1 )
popd

echo [2/4] Starting backend on http://127.0.0.1:8000 ...
call :port_in_use 8000 && (echo        already running) || (
  start "In2ERP Backend" /D "%ROOT%backend" cmd /k ""%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
)

echo [3/4] Starting frontend on http://127.0.0.1:5173 ...
if not exist "%ROOT%frontend\node_modules" (
  echo        installing frontend packages ^(first run only^)...
  pushd "%ROOT%frontend" & call npm install & popd
)
call :port_in_use 5173 && (echo        already running) || (
  start "In2ERP Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"
)

echo        waiting for both servers...
powershell -NoProfile -Command ^
  "$deadline=(Get-Date).AddSeconds(90);" ^
  "foreach($u in 'http://127.0.0.1:8000/health','http://127.0.0.1:5173/'){" ^
  "  while($true){ try{ Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3 | Out-Null; break } catch { if((Get-Date) -gt $deadline){ Write-Host ('[ERROR] Not responding: ' + $u); exit 1 }; Start-Sleep 1 } }" ^
  "}"
if errorlevel 1 ( echo         Check the Backend / Frontend windows for errors. & pause & exit /b 1 )

echo [4/4] Opening public tunnel...
echo   Local: http://localhost:5173
REM Resolve devtunnel before the block: variables inside ( ) are expanded when it is parsed.
if defined DEVTUNNEL_ID call :find_devtunnel
if defined DEVTUNNEL_ID (
  if not defined DEVTUNNEL_EXE (
    echo [ERROR] devtunnel is not installed. Run: winget install Microsoft.devtunnel
    pause & exit /b 1
  )
  echo   Fixed public URL is printed below as "Connect via browser".
  echo.
  "%DEVTUNNEL_EXE%" host %DEVTUNNEL_ID%
) else if defined CF_TUNNEL_TOKEN (
  echo.
  echo   PUBLIC URL: https://%CF_HOSTNAME%
  echo.
  "%CLOUDFLARED%" tunnel --no-autoupdate run --token %CF_TUNNEL_TOKEN%
) else (
  REM Print the quick-tunnel URL as soon as Cloudflare assigns it.
  start "" /B powershell -NoProfile -Command ^
    "for($i=0;$i -lt 90;$i++){ try{ $h=(Invoke-RestMethod http://127.0.0.1:20291/quicktunnel -TimeoutSec 2).hostname; if($h){ Write-Host ''; Write-Host ('  PUBLIC URL: https://' + $h) -ForegroundColor Green; Write-Host ''; break } } catch {}; Start-Sleep 1 }"
  "%CLOUDFLARED%" tunnel --no-autoupdate --metrics 127.0.0.1:20291 --url http://127.0.0.1:5173
)
echo.
echo Tunnel stopped. The app keeps running in its own windows until you close them.
pause
exit /b 0

:find_devtunnel
for /f "delims=" %%F in ('where devtunnel 2^>nul') do ( set "DEVTUNNEL_EXE=%%F" & exit /b 0 )
set "WG=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Microsoft.devtunnel_Microsoft.Winget.Source_8wekyb3d8bbwe\devtunnel.exe"
if exist "%WG%" set "DEVTUNNEL_EXE=%WG%"
exit /b 0

:port_in_use
netstat -ano | findstr /R /C:"127.0.0.1:%1 .*LISTENING" /C:"0.0.0.0:%1 .*LISTENING" >nul
exit /b %errorlevel%
