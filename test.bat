@echo off
REM Run all tests. Double-click or: .\test.bat
node "%~dp0test-auth.js"
if errorlevel 1 exit /b 1
node "%~dp0test-api.js"
