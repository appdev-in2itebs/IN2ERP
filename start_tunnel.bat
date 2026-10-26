@echo off
echo ========================================================
echo   In2IT ERP - Public Ngrok Tunnel Launcher
echo   Reserved Domain: https://reapprove-creole-concise.ngrok-free.dev
echo ========================================================
echo.
echo NOTE: Ngrok requires your Personal Authtoken from:
echo       https://dashboard.ngrok.com/get-started/your-authtoken
echo.
echo If you have not added it yet, run:
echo   npx ngrok config add-authtoken ^<YOUR_AUTHTOKEN^>
echo.
echo (The ID rd_3H7Tbj2qxSm5loFEHW7hUrmlOy8 is your Reserved Domain ID,
echo  not your personal authtoken).
echo.
echo Forwarding traffic to port 5173...
echo.
npx -y ngrok http --url=reapprove-creole-concise.ngrok-free.dev 5173
pause
