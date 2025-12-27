# 빠른 시작 가이드

## 1단계: 설치

```bash
# setup.bat 실행 (Windows)
setup.bat
```

**설치되는 것들:**
- Python 가상환경
- 필요한 패키지 (Playwright, Flask 등)
- Playwright 브라우저 (Chromium)
- ADB 확인

## 2단계: 휴대폰 설정

### Android 휴대폰 설정

1. **개발자 옵션 활성화**
   ```
   설정 → 휴대폰 정보 → 빌드번호 7번 연속 탭
   ```

2. **USB 디버깅 활성화**
   ```
   설정 → 개발자 옵션 → USB 디버깅 ON
   ```

3. **USB 케이블로 PC 연결**
   - USB 케이블로 휴대폰과 PC 연결
   - 휴대폰 화면에 "USB 디버깅 허용" 팝업 → 확인

4. **USB 테더링 활성화**
   ```
   설정 → 네트워크 및 인터넷 → 핫스팟 및 테더링 → USB 테더링 ON
   ```

5. **ADB 연결 확인**
   ```bash
   adb devices
   # 출력: ABC123DEF456    device
   ```

## 3단계: 실행

### 방법 1: 배치 파일 사용 (권장)

**시뮬레이터 실행:**
```bash
start_simulator.bat
```

**대시보드 실행 (별도 터미널):**
```bash
start_dashboard.bat
```

### 방법 2: 수동 실행

**시뮬레이터:**
```bash
venv\Scripts\activate
python main.py
```

**대시보드:**
```bash
venv\Scripts\activate
cd dashboard
python app.py
```

## 4단계: 모니터링

**대시보드 접속:**
```
http://localhost:5000
```

대시보드에서 확인 가능한 것:
- 실시간 세션 통계
- 성공/실패율
- 평균 체류시간
- 부정클릭 점수
- 검색 순위 변동
- 최근 세션 로그

## 작동 방식

1. **휴대폰 연결 감지**
   - 프로그램이 자동으로 휴대폰 연결 확인
   - 연결되면 시작, 연결 끊기면 대기

2. **세션 실행 (10회)**
   - 무작위 디바이스 선택 (모바일 60%, PC 40%)
   - 네이버/구글/소셜/직접 유입 시뮬레이션
   - 자연스러운 마우스 움직임 (100-200회)
   - 스크롤 (60-100% 깊이)
   - 무작위 클릭 (0-3회)
   - 체류 시간 (30-120초)

3. **IP 자동 변경**
   - 10회 세션 후 자동으로 비행기 모드 ON (5초)
   - 비행기 모드 OFF (10초 대기)
   - 새 IP로 변경 확인

4. **반복**
   - 5-10분 대기 후 다시 세션 시작
   - 휴대폰 연결되어 있는 동안 계속 실행

## 문제 해결

### ADB 연결 안 됨
```bash
# ADB 재시작
adb kill-server
adb start-server

# 다시 확인
adb devices
```

### 비행기 모드 권한 오류
- 일부 Android 버전에서는 ADB로 비행기 모드 제어 불가
- 프로그램이 수동으로 전환하라는 메시지 표시
- 휴대폰에서 직접 비행기 모드 ON/OFF 후 Enter 누르기

### IP가 변경되지 않음
- 통신사에 따라 IP 변경 시간이 더 필요할 수 있음
- `modules/phone_tethering.py`에서 대기 시간 늘리기:
  ```python
  time.sleep(5)  → time.sleep(10)
  time.sleep(10) → time.sleep(20)
  ```

## 데이터 사용량

- 1회 세션: 약 5-10MB
- 10회 세션 (IP 변경 1회): 약 50-100MB
- 하루 100회: 약 500MB-1GB
- **월 예상**: 10-30GB

## 비용 절감

| 방법 | 월 비용 |
|------|---------|
| 휴대폰 테더링 | 1-3만원 (데이터 요금만) |
| Bright Data | 70-270만원 ($500-2,000) |

**절감액: 월 50-270만원!**

## 설정 변경

### IP 변경 주기 변경
`main.py`에서:
```python
simulator = TrafficSimulator(
    mode='tethering',
    max_sessions_per_ip=20  # 10 → 20으로 변경
)
```

### 대기 시간 조정
`main.py`의 `run_session()`에서:
```python
next_delay = random.randint(300, 600)  # 5-10분
# → next_delay = random.randint(600, 1200)  # 10-20분
```

### 타겟 웹사이트 변경
`main.py`에서:
```python
self.referrer = ReferrerHandler(target_url='your-website.com')
self.rank_tracker = RankTracker(target_url='your-website.com')
```

## 주의사항

⚠️ **이 도구는 교육 및 자체 웹사이트 테스트 목적으로만 사용하세요**

- 검색 엔진 조작 목적 사용 금지
- 부정클릭 탐지 시스템 우회 시도는 법적 문제 발생 가능
- 사용에 따른 모든 책임은 사용자에게 있음

## 도움이 필요하신가요?

- `README.md`: 전체 문서
- `PLAN.md`: 상세 기술 문서
- GitHub Issues: 문제 보고
