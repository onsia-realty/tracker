# 🚀 웹사이트 트래픽 시뮬레이터

휴대폰 USB 테더링 또는 Bright Data 프록시를 사용하여 자연스러운 웹사이트 트래픽을 시뮬레이션하는 도구입니다.

## ⚠️ 중요 경고

본 도구는 **교육 및 자체 웹사이트 테스트 목적**으로만 제공됩니다.
- 검색 엔진 조작 목적의 사용은 Google/네이버 정책 위반입니다
- 부정클릭 탐지 시스템 우회는 법적 문제가 발생할 수 있습니다
- 사용에 따른 모든 책임은 사용자에게 있습니다

자세한 경고사항은 [계획서](./PLAN.md)를 참고하세요.

---

## 📋 기능

### ✅ 2가지 실행 모드

**모드 1: 휴대폰 USB 테더링** (⭐ 권장)
- 비용: 무료 (데이터 요금만)
- 10건마다 자동으로 비행기 모드로 IP 변경
- 수동 실행으로 더 안전
- 실제 모바일 IP 사용

**모드 2: Bright Data 프록시**
- 비용: 월 $500-2,000
- 24시간 무인 자동 실행
- 안정적이지만 비용 부담

### ✅ 핵심 기능
- ✅ 휴대폰 USB 테더링 + ADB 비행기 모드 제어
- ✅ 디바이스 에뮬레이션 (모바일 60%, PC 40%)
- ✅ 자연스러운 행동 시뮬레이션 (마우스, 스크롤, 체류시간)
- ✅ Referrer 다양화 (네이버/구글/SNS/직접)
- ✅ SQLite 세션 로깅
- ✅ 검색 순위 자동 추적
- ✅ Flask 웹 대시보드

---

## 🚀 빠른 시작 (휴대폰 테더링 모드)

### 1단계: 사전 준비

**Python 설치**
```bash
# Python 3.10 이상 필요
python --version
```

**ADB 설치** (Android Debug Bridge)
```bash
# Windows (Chocolatey 사용)
choco install adb

# 또는 수동 다운로드
# https://developer.android.com/studio/releases/platform-tools
# 다운로드 후 시스템 PATH에 추가
```

**프로젝트 다운로드**
```bash
cd D:\claude\홈페이지\분양현장_랜딩\traffic-simulator
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### 2단계: 휴대폰 설정

1. **개발자 옵션 활성화**
   ```
   설정 → 휴대폰 정보 → 소프트웨어 정보 → 빌드번호 7번 탭
   ```

2. **USB 디버깅 켜기**
   ```
   설정 → 개발자 옵션 → USB 디버깅 ON
   ```

3. **USB 연결 및 테더링**
   ```
   USB 케이블로 PC 연결
   → "USB 디버깅 허용" 팝업에서 확인
   → 설정 → 네트워크 → 핫스팟 및 테더링 → USB 테더링 ON
   ```

4. **ADB 연결 확인**
   ```bash
   adb devices
   # List of devices attached
   # ABC123DEF456    device  ← 이렇게 나오면 성공!
   ```

### 3단계: 실행

```bash
python main.py

# 모드 선택: 1 (휴대폰 USB 테더링)
```

**자동 실행 과정**:
```
1. 휴대폰 연결 확인
2. 세션 10건 실행
3. 자동으로 비행기 모드 ON (5초)
4. 비행기 모드 OFF (10초 대기)
5. IP 변경 확인
6. 다시 10건 실행
7. 반복...
```

---

## 📊 대시보드 사용

```bash
# 별도 터미널에서 실행
python dashboard/app.py

# 브라우저에서 접속
http://localhost:5000
```

**대시보드 기능**:
- 실시간 통계 (성공률, 평균 체류시간, 부정클릭 점수)
- 검색 순위 변동 그래프
- 최근 세션 로그 테이블
- 30초마다 자동 업데이트

---

## 📁 프로젝트 구조

```
traffic-simulator/
├── main.py                      # 메인 실행 파일
├── requirements.txt             # Python 패키지
├── README.md                    # 이 파일
├── PLAN.md                      # 상세 계획서
│
├── modules/                     # 핵심 모듈
│   ├── phone_tethering.py       # 휴대폰 테더링 + ADB 제어
│   ├── device_emulator.py       # 디바이스 에뮬레이션
│   ├── behavior_simulator.py    # 행동 시뮬레이션
│   ├── referrer_handler.py      # Referrer 처리
│   ├── session_logger.py        # SQLite 로깅
│   └── rank_tracker.py          # 검색 순위 추적
│
├── dashboard/                   # Flask 대시보드
│   ├── app.py                   # Flask 서버
│   └── templates/
│       └── dashboard.html       # 대시보드 UI
│
├── config/                      # 설정 파일
├── logs/                        # 로그 및 DB
│   ├── sessions.db              # 세션 로그 (SQLite)
│   └── rankings.db              # 검색 순위 (SQLite)
│
└── start_tethering.bat          # Windows 자동 실행
```

---

## ⚙️ 설정

### 세션당 IP 변경 횟수 변경
```python
# main.py 수정
simulator = AdvancedTrafficSimulator(
    mode='tethering',
    max_sessions_per_ip=20  # 기본: 10 → 20으로 변경
)
```

### 대기 시간 조정
```python
# main.py의 run_manual_mode() 함수에서
wait_time = random.randint(300, 600)  # 5-10분
# → wait_time = random.randint(600, 1200)  # 10-20분으로 변경
```

### 타겟 웹사이트 변경
```python
# modules/referrer_handler.py에서
target_url = 'yongin-honorsville.vercel.app'
# → target_url = 'your-website.com'로 변경
```

---

## 🔧 문제 해결

### ADB 연결 안 됨
```bash
# 1. ADB 재시작
adb kill-server
adb start-server

# 2. 휴대폰 재연결
USB 케이블 제거 후 다시 연결

# 3. USB 디버깅 재승인
설정 → 개발자 옵션 → USB 디버깅 OFF → ON
```

### 비행기 모드 권한 오류
```
일부 Android 버전에서는 ADB로 비행기 모드 제어가 불가능할 수 있습니다.
→ 수동으로 휴대폰에서 비행기 모드를 ON/OFF 하세요.
→ 프로그램이 안내 메시지를 표시합니다.
```

### IP가 변경되지 않음
```
1. 비행기 모드 대기 시간 늘리기
   modules/phone_tethering.py에서:
   time.sleep(5) → time.sleep(10)
   time.sleep(10) → time.sleep(20)

2. 통신사 확인
   일부 통신사는 IP가 자주 변경되지 않을 수 있습니다.
```

### 부정클릭 탐지 점수가 높음
```
1. 체류 시간 늘리기 (60-180초)
2. 세션 간 대기 시간 늘리기 (10-30분)
3. IP 변경 횟수 줄이기 (20-30건마다)
```

---

## 📊 데이터 사용량

- 1회 세션: 약 5-10MB
- 10회 세션 (IP 변경 1회): 약 50-100MB
- 하루 100회: 약 500MB-1GB
- **월 예상**: 10-30GB (약 1-3만원)

---

## 💰 비용 비교

| 방법 | 월 비용 | 비고 |
|------|---------|------|
| 휴대폰 테더링 | 1-3만원 | 데이터 요금만 |
| Bright Data 프록시 | 70-270만원 | $500-2,000 |
| 네이버 광고 | 50만원~ | 클릭당 300-1,000원 |
| 구글 광고 | 100만원~ | 클릭당 500-2,000원 |

**절감액**: 월 50-270만원!

---

## 📚 상세 문서

- [전체 구현 계획서](./PLAN.md) - 상세한 기술 문서
- [합법적 SEO 대안](./PLAN.md#권장-대안) - 안전한 마케팅 방법
- [부정클릭 탐지 우회 전략](./PLAN.md#부정클릭-탐지-우회-전략)

---

## 🤝 기여

이 프로젝트는 교육 목적으로만 제공됩니다.
실제 검색 엔진 조작 목적의 사용은 권장하지 않습니다.

---

## ⚖️ 면책 조항

본 소프트웨어는 "있는 그대로" 제공되며, 어떠한 보증도 하지 않습니다.
사용에 따른 모든 법적 책임은 사용자에게 있습니다.

- 검색 엔진 정책 위반 가능성
- 부정경쟁방지법 위반 가능성
- 전자상거래법 위반 가능성

합법적인 SEO 및 마케팅 방법을 권장합니다.
