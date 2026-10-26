@echo off
echo ========================================================
echo   In2IT ERP - Instant Cloudflare Public Tunnel
echo   (Zero-config public access without tokens)
echo ========================================================
echo.
echo Launching cloudflared tunnel to http://localhost:5173...
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173
pause
