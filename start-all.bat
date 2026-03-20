@echo off
echo ========================================
echo    RBSchool Backend Services Starter
echo ========================================
echo.

echo Choose an option:
echo 1. Start all services with Docker (Recommended)
echo 2. Start all services locally (Development)
echo 3. Stop all Docker services
echo 4. View Docker logs
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto docker-start
if "%choice%"=="2" goto local-start
if "%choice%"=="3" goto docker-stop
if "%choice%"=="4" goto docker-logs
if "%choice%"=="5" goto exit
goto invalid

:docker-start
echo.
echo Starting all services with Docker...
echo This may take a few minutes on first run...
echo.
docker-compose up --build -d
echo.
echo All services started successfully!
echo.
echo Services available at:
echo - API Gateway: http://localhost:8000
echo - Auth Service: http://localhost:3001
echo - User Service: http://localhost:3002
echo - Academic Service: http://localhost:3003
echo - Attendance Service: http://localhost:3004
echo - Fee Service: http://localhost:3005
echo - Notification Service: http://localhost:3006
echo - School Service: http://localhost:3007
echo.
echo MongoDB instances:
echo - Auth DB: localhost:27017
echo - Users DB: localhost:27018
echo - Academic DB: localhost:27019
echo - Attendance DB: localhost:27020
echo - Fee DB: localhost:27021
echo - Notification DB: localhost:27022
echo - School DB: localhost:27023
echo.
echo Redis: localhost:6379
echo.
pause
goto menu

:local-start
echo.
echo Starting all services locally...
echo Make sure you have installed all dependencies first!
echo.
npm run dev
goto menu

:docker-stop
echo.
echo Stopping all Docker services...
docker-compose down -v
echo.
echo All services stopped!
echo.
pause
goto menu

:docker-logs
echo.
echo Showing Docker logs (Press Ctrl+C to stop):
echo.
docker-compose logs -f
goto menu

:invalid
echo.
echo Invalid choice! Please try again.
echo.
pause
goto menu

:menu
echo.
echo Press any key to return to menu...
pause > nul
cls
goto start

:exit
echo.
echo Goodbye!
exit /b 0

:start
cls
goto :eof
