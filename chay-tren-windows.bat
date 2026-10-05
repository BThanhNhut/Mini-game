@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org & pause & exit /b)
if not exist node_modules call npm install
npm start
pause
