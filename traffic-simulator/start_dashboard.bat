@echo off
chcp 65001 > nul
echo ========================================
echo 대시보드 실행
echo ========================================
echo.

echo 가상환경 활성화...
call venv\Scripts\activate.bat

echo.
echo 대시보드 시작...
echo 브라우저에서 http://localhost:5000 접속
echo.

python dashboard\app.py

pause
