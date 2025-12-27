# 문제 해결 가이드

## 대시보드 연결 오류

### 증상
```
사이트에 연결할 수 없음
localhost에서 연결을 거부했습니다.
```

### 해결 방법

#### 1. 대시보드가 실행 중인지 확인

**확인:**
```bash
# 새 터미널 창 열기
start_dashboard.bat
```

**정상 출력:**
```
========================================
🚀 Flask 대시보드 시작
========================================

📁 프로젝트 루트: D:\claude\홈페이지\분양현장_랜딩\traffic-simulator
📁 로그 디렉토리: D:\claude\홈페이지\분양현장_랜딩\traffic-simulator\logs
📊 세션 DB: D:\claude\홈페이지\분양현장_랜딩\traffic-simulator\logs\sessions.db
📊 순위 DB: D:\claude\홈페이지\분양현장_랜딩\traffic-simulator\logs\rankings.db

📊 대시보드 URL: http://localhost:5000
   브라우저에서 위 URL로 접속하세요

========================================

 * Serving Flask app 'app'
 * Debug mode: on
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
```

#### 2. 포트 5000이 사용 중인 경우

**확인:**
```bash
netstat -ano | findstr :5000
```

**다른 프로그램이 5000 포트 사용 중이면:**

**방법 A: 다른 포트 사용 (권장)**

`dashboard\app.py` 파일의 마지막 부분 수정:
```python
app.run(host='0.0.0.0', port=5001, debug=True)  # 5000 → 5001
```

그리고 브라우저에서 `http://localhost:5001` 접속

**방법 B: 5000 포트 사용 중인 프로그램 종료**

```bash
# 프로세스 ID 확인
netstat -ano | findstr :5000

# 프로세스 종료 (PID는 위에서 확인한 번호)
taskkill /PID <PID> /F
```

#### 3. 방화벽 차단

**Windows 방화벽 설정:**
1. Windows 검색 → "Windows Defender 방화벽"
2. "고급 설정" 클릭
3. "인바운드 규칙" → "새 규칙"
4. 포트 → TCP → 5000 → 허용
5. 이름: Flask Dashboard

#### 4. 가상환경 활성화 확인

```bash
# 터미널에서 확인
venv\Scripts\activate
python --version
python -c "import flask; print(flask.__version__)"
```

정상이면:
```
Python 3.x.x
3.0.0
```

#### 5. flask-cors 패키지 누락

**증상:**
```
ModuleNotFoundError: No module named 'flask_cors'
```

**해결:**
```bash
venv\Scripts\activate
pip install flask-cors
```

---

## ADB 연결 오류

### 증상
```
❌ 휴대폰이 연결되지 않았습니다.
```

### 해결 방법

#### 1. ADB 설치 확인

```bash
adb version
```

**출력이 없으면:**
```bash
# Chocolatey 사용
choco install adb

# 또는 수동 다운로드
# https://developer.android.com/studio/releases/platform-tools
```

#### 2. ADB 재시작

```bash
adb kill-server
adb start-server
adb devices
```

**정상 출력:**
```
List of devices attached
ABC123DEF456    device
```

#### 3. USB 디버깅 재설정

1. 휴대폰: 설정 → 개발자 옵션 → USB 디버깅 OFF
2. 3초 대기
3. USB 디버깅 ON
4. USB 케이블 제거 후 다시 연결
5. "USB 디버깅 허용" 팝업 → 확인

#### 4. USB 드라이버 설치

**Windows에서 휴대폰이 인식되지 않으면:**

1. 장치 관리자 열기
2. "휴대용 디바이스" 또는 "기타 장치" 확인
3. 노란색 느낌표가 있으면 드라이버 업데이트
4. 제조사 웹사이트에서 USB 드라이버 다운로드:
   - Samsung: Samsung USB Driver
   - LG: LG USB Driver
   - Google Pixel: Google USB Driver

---

## 비행기 모드 권한 오류

### 증상
```
⚠️ 비행기 모드 활성화 실패 (권한 문제일 수 있음)
수동으로 휴대폰에서 비행기 모드를 켜고 10초 후 꺼주세요.
```

### 해결 방법

#### 방법 1: 수동 제어 (권장)

1. 프로그램이 안내 메시지 표시할 때
2. 휴대폰에서 비행기 모드 ON
3. 5초 대기
4. 비행기 모드 OFF
5. 10초 대기 (네트워크 재연결)
6. 프로그램에서 Enter 누르기

#### 방법 2: ADB 권한 부여 (Android 10 이상)

일부 Android 버전에서는 ADB로 비행기 모드 제어가 불가능합니다.
→ 방법 1 (수동 제어)을 사용하세요.

---

## IP가 변경되지 않음

### 증상
```
⚠️ IP 변경 실패 (동일 IP: xxx.xxx.xxx.xxx)
```

### 해결 방법

#### 1. 대기 시간 늘리기

`modules\phone_tethering.py` 파일 수정:

```python
# 비행기 모드 ON 후 대기
time.sleep(5)  # → time.sleep(10)

# 비행기 모드 OFF 후 대기
time.sleep(10)  # → time.sleep(20)
```

#### 2. 통신사별 특성

**일부 통신사는 IP가 자주 변경되지 않을 수 있습니다:**

- SKT: 비교적 자주 변경됨
- KT: 중간 정도
- LG U+: 변경이 느릴 수 있음

**해결:**
- 대기 시간을 더 늘리기
- 또는 Wi-Fi와 모바일 데이터를 번갈아 사용

#### 3. 수동 확인

```bash
# 현재 IP 확인
curl https://api.ipify.org

# 비행기 모드 전환 후 다시 확인
curl https://api.ipify.org
```

---

## Playwright 브라우저 오류

### 증상
```
playwright._impl._api_types.Error: Executable doesn't exist
```

### 해결 방법

```bash
venv\Scripts\activate
playwright install chromium
```

---

## 모듈 import 오류

### 증상
```
ModuleNotFoundError: No module named 'xxx'
```

### 해결 방법

```bash
# 가상환경 활성화
venv\Scripts\activate

# 패키지 재설치
pip install -r requirements.txt

# Playwright 브라우저 설치
playwright install chromium
```

---

## 데이터베이스 오류

### 증상
```
sqlite3.OperationalError: unable to open database file
```

### 해결 방법

#### 1. logs 디렉토리 생성

```bash
mkdir logs
```

#### 2. 권한 확인

프로젝트 폴더에 쓰기 권한이 있는지 확인

#### 3. 경로 확인

`dashboard\app.py` 실행 시 출력되는 경로 확인:
```
📁 로그 디렉토리: D:\claude\홈페이지\분양현장_랜딩\traffic-simulator\logs
```

---

## 일반적인 해결 순서

**문제 발생 시:**

1. ✅ **가상환경 활성화 확인**
   ```bash
   venv\Scripts\activate
   ```

2. ✅ **패키지 재설치**
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```

3. ✅ **ADB 재시작**
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

4. ✅ **휴대폰 재연결**
   - USB 케이블 제거 후 다시 연결
   - USB 디버깅 재승인

5. ✅ **프로그램 재시작**
   ```bash
   # Ctrl+C로 종료 후
   start_simulator.bat
   ```

6. ✅ **PC 재시작**
   - 모든 방법이 실패하면 PC 재시작

---

## 도움 요청

여전히 문제가 해결되지 않으면:

1. 오류 메시지 전체 복사
2. 실행 환경 정보:
   - Windows 버전
   - Python 버전
   - 휴대폰 모델 및 Android 버전
3. GitHub Issues에 문의
