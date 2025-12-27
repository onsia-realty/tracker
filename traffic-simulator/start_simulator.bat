@echo off
chcp 65001 > nul
echo ========================================
echo 트래픽 시뮬레이터 실행
echo ========================================
echo.

echo 가상환경 활성화...
call venv\Scripts\activate.bat

echo.
echo ⚠️  휴대폰 준비 사항:
echo   1. USB 케이블로 휴대폰 연결
echo   2. USB 디버깅 허용
echo   3. USB 테더링 활성화
echo.
echo 시뮬레이터 시작...
echo.

python main.py

pause
