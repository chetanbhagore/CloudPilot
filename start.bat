@echo off
title CloudPilot - Dual Mode Engine Launcher
color 0A

echo ========================================================
echo       CloudPilot - Starting Presentation Stack
echo       TECHyug 2K26 National Cloud Competition
echo ========================================================
echo.

echo [1/2] Starting Python FastAPI Backend on http://localhost:8000 ...
start "CloudPilot FastAPI Backend (:8000)" cmd /k "python backend/run.py"

timeout /t 2 /nobreak > nul

echo [2/2] Starting React Vite Frontend on http://localhost:5173 ...
start "CloudPilot Vite Frontend (:5173)" cmd /k "npm run dev"

echo.
echo ========================================================
echo   Stack launched successfully!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000 (Swagger: /docs)
echo ========================================================
echo.
pause
