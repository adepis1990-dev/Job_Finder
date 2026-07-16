@echo off
REM Resume App — Start both backend and frontend (Windows)
cd /d "%~dp0"

echo.
echo  Resume App Launcher
echo  --------------------
echo.

REM Check if node_modules has correct platform binaries
if not exist "frontend\node_modules\@esbuild\win32-x64" (
    echo [!] Installing frontend dependencies for Windows...
    cd frontend
    if exist node_modules rmdir /s /q node_modules
    npm install
    cd ..
    echo.
)

echo Starting backend on http://localhost:8000 ...
echo Starting frontend on http://localhost:3000 ...
echo.

start "Backend" /min cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
start "Frontend" /min cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo  Both servers started (minimized windows).
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo.
echo  Close the minimized windows to stop the servers.
pause
