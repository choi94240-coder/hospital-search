@echo off
REM 같은 와이파이의 휴대폰에서 접속할 수 있게 서버를 실행합니다.
set HOST=0.0.0.0
set PORT=3000
node "%~dp0server\server.js"
pause
