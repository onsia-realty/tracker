@echo off
chcp 65001 > nul
echo ========================================
echo 트래픽 시뮬레이터 설치
echo ========================================
echo.

echo [1/5] Python 버전 확인...
python --version
if errorlevel 1 (
    echo ❌ Python이 설치되지 않았습니다!
    echo    https://www.python.org/downloads/ 에서 Python 3.10 이상을 다운로드하세요.
    pause
    exit /b 1
)
echo ✅ Python 확인 완료
echo.

echo [2/5] 가상환경 생성...
if not exist venv (
    python -m venv venv
    echo ✅ 가상환경 생성 완료
) else (
    echo ℹ️  가상환경이 이미 존재합니다
)
echo.

echo [3/5] 가상환경 활성화 및 패키지 설치...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
echo ✅ 패키지 설치 완료
echo.

echo [4/5] Playwright 브라우저 설치...
playwright install chromium
echo ✅ Playwright 설치 완료
echo.

echo [5/5] ADB 확인...
adb version > nul 2>&1
if errorlevel 1 (
    echo ⚠️  ADB가 설치되지 않았습니다!
    echo    휴대폰 테더링 모드를 사용하려면 ADB 설치가 필요합니다.
    echo.
    echo    📥 다운로드:
    echo    https://developer.android.com/studio/releases/platform-tools
    echo.
    echo    다운로드 후:
    echo    1. 압축 해제
    echo    2. 시스템 환경변수 PATH에 추가
    echo    3. 명령 프롬프트 재시작
    echo.
    echo    또는 Chocolatey로 설치:
    echo    choco install adb
    echo.
) else (
    echo ✅ ADB 설치 확인
    adb version
)
echo.

echo ========================================
echo ✅ 설치 완료!
echo ========================================
echo.
echo 다음 단계:
echo 1. 휴대폰 USB 디버깅 활성화
echo    - 설정 → 휴대폰 정보 → 빌드번호 7번 탭
echo    - 개발자 옵션 → USB 디버깅 ON
echo.
echo 2. 휴대폰 USB 연결 및 테더링
echo    - USB 케이블로 연결
echo    - "USB 디버깅 허용" 승인
echo    - 설정 → 핫스팟 및 테더링 → USB 테더링 ON
echo.
echo 3. 시뮬레이터 실행
echo    python main.py
echo.
echo 4. 대시보드 실행 (별도 터미널)
echo    python dashboard\app.py
echo    브라우저: http://localhost:5000
echo.

pause
