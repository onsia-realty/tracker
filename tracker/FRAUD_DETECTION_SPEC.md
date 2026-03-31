# ONSIA Tracker - 부정클릭 탐지 시스템 현황 및 개선 제안

> 현재 구현된 코드 기반 분석 (2026-03-21 기준)

---

## 1. 시스템 아키텍처 개요

```
[랜딩페이지]
    │
    ▼
AnalyticsTracker (클라이언트 컴포넌트)
    │  ┌─ 핑거프린트 생성 (Canvas/WebGL/Audio/Font)
    │  ├─ 세션 초기화 (쿠키 + 핑거프린트)
    │  ├─ 행동 데이터 수집 (스크롤, 마우스, 체류시간)
    │  └─ 클릭 이벤트 전송
    │
    ▼
POST /api/analytics/click
    │
    ▼
smartFraudCheck() ─── 통합 판정 함수
    │  ┌─ 1. 블랙리스트 체크
    │  ├─ 2. checkForFraud() ─── 기본 탐지
    │  │     ├─ checkFrequency()    (빈도 기반, DB 조회)
    │  │     ├─ checkBehavior()     (행동 패턴, 클라이언트 데이터)
    │  │     ├─ checkGeoTime()      (지역/시간)
    │  │     └─ checkCoordinates()  (좌표 패턴, DB 조회)
    │  └─ 3. 공유 IP 보정 (스마트로그)
    │
    ▼
판정 결과 → ClickEvent 저장 + 세션 리스크 업데이트
    │
    ├─ riskScore ≥ 100 → 블랙리스트 자동 등록 (30일)
    ├─ riskScore ≥ 80  → block (isFraud: true)
    ├─ riskScore ≥ 50  → warn
    └─ riskScore < 50  → allow
```

---

## 2. 현재 구현된 탐지 규칙 상세

### 2-1. 빈도 기반 (checkFrequency)

| 규칙 | 시간 윈도우 | 임계값 | 점수 | 대상 이벤트 |
|------|------------|--------|------|-------------|
| 동일 핑거프린트 반복 | 5분 | 3회 이상 | +30 | ad_click, cta_click |
| 동일 핑거프린트 반복 | 1시간 | 5회 이상 | +50 | ad_click, cta_click |
| 동일 IP 반복 | 10분 | 5회 이상 | +25 | ad_click, cta_click |

**현재 코드** (`fraudDetection.ts:130-180`):
- Prisma `count()` 쿼리로 DB에서 직접 조회
- `ad_click`, `cta_click` 타입만 부정클릭 검사 대상
- 핑거프린트는 세션 → 핑거프린트 관계를 통해 조회

### 2-2. 행동 패턴 (checkBehavior)

| 규칙 | 조건 | 점수 | 의미 |
|------|------|------|------|
| 짧은 체류시간 | < 3초 | +25 | 페이지 안 읽고 바로 클릭 |
| 스크롤 없음 | < 10% | +20 | 페이지 탐색 안 함 |
| 마우스 움직임 없음 | < 5회 | +35 | 봇/자동화 도구 의심 |

**현재 코드** (`fraudDetection.ts:186-209`):
- 클라이언트에서 전송한 `dwellTimeBeforeClick`, `scrollDepthBeforeClick`, `mouseMovementsBeforeClick` 값 사용
- `undefined` 체크로 데이터 없으면 패스 (페널티 없음)

### 2-3. 지역/시간 (checkGeoTime)

| 규칙 | 조건 | 점수 | 비고 |
|------|------|------|------|
| VPN/프록시 | isVpn \|\| isProxy | +30 | 세션 생성 시 GeoIP에서 감지 |
| 해외 IP | countryCode ≠ 'KR' | +25 | ad_click일 때만 적용 |
| 새벽 시간대 | 2~5시 | +15 | 서버 시간 기준 |

**현재 코드** (`fraudDetection.ts:215-242`):
- VPN 감지: ip-api.com 무료 버전은 VPN 감지 불가 (항상 false)
- 프록시만 감지 가능

### 2-4. 좌표 패턴 (checkCoordinates)

| 규칙 | 조건 | 점수 |
|------|------|------|
| 동일 좌표 반복 클릭 | 10분 내 ±5px 이내 3회 이상 | +40 |

**현재 코드** (`fraudDetection.ts:248-287`):
- 동일 세션의 최근 10분 클릭 좌표와 비교
- X, Y 좌표 각각 ±5px tolerance

### 2-5. 보정 로직

#### 블랙리스트 즉시 차단
- 핑거프린트 또는 IP가 블랙리스트에 등록되어 있으면 → 즉시 100점, block

#### 공유 IP 스마트 보정
- **공유 IP 판정**: 24시간 내 동일 IP에서 3개 이상 다른 핑거프린트 접속 시
- **정상 행동 판정**: 체류 10초↑ + 스크롤 30%↑ + 마우스 10회↑
- **보정**: 공유 IP + 정상 행동이면 리스크 점수 **50% 감소**

---

## 3. 핑거프린트 수집 현황

### 수집 데이터 (`fingerprint.ts`)

| 레이어 | 수집 항목 | 용도 |
|--------|----------|------|
| Canvas | 2D 렌더링 결과 해시 | GPU/드라이버별 고유값 |
| WebGL | GPU 벤더 + 렌더러 | 하드웨어 식별 |
| Audio | AudioContext 출력 해시 | 오디오 스택 고유값 |
| Font | 13개 폰트 감지 | 설치 폰트 조합 |
| 환경 | timezone, language, colorDepth, pixelRatio 등 | 소프트웨어 환경 |
| 하드웨어 | hardwareConcurrency, deviceMemory, screen | 기기 스펙 |

**최종 해시**: 위 모든 값을 `|`로 연결 → SHA-256 → 앞 32자 사용 (`fp_xxxxx...`)

### 디바이스 감지 (`fingerprint.ts`)
- **1순위**: User-Agent Client Hints (Chrome/Edge)
- **2순위**: ua-parser-js 폴백

---

## 4. GeoIP 현황 (`geoip.ts`)

| API | 제한 | VPN 감지 | 비용 |
|-----|------|----------|------|
| ip-api.com | 45req/min | ❌ 불가 | 무료 |
| ipinfo.io | 50K/월 | ✅ (토큰 필요) | 무료~유료 |

- 현재 기본: ip-api.com (VPN 감지 불가)
- 24시간 캐시 적용 (`next: { revalidate: 86400 }`)

---

## 5. 대시보드 표시 (`analytics/page.tsx`, `stats/route.ts`)

### 메인 대시보드 카드
- **부정클릭 차단**: `isFraud: true` 건수 / 전체 클릭 대비 차단율
- **예상 절감 비용**: 부정클릭 수 × 400원 (평균 CPC)

### 최근 부정클릭 감지 섹션
- `isFraud: true`인 최근 5건 표시
- IP, 디바이스, 브라우저, 지역, fraudScore, fraudReason 표시
- 100점 이상: 빨간색 / 70점 이상: 노란색 / 그 외: 회색

### 부정클릭 상세 페이지 (`/admin/analytics/fraud`)
- 사유별 통계 (groupBy fraudReason)
- 광고 소스별 부정클릭 (groupBy adSource)
- 의심 IP 목록 (최근 부정클릭 로그 20건)

---

## 6. 현재 한계점 및 개선 제안

### 🔴 심각한 한계

#### 6-1. VPN 감지 불가
**현황**: ip-api.com 무료 버전은 VPN 탐지 미지원 → `isVpn` 항상 `false`
**영향**: VPN으로 IP 바꿔가며 클릭하면 빈도 기반 탐지 회피 가능

**개선안**:
- ipinfo.io Privacy Detection API 도입 (VPN/Tor/Relay 감지)
- 또는 ip-api Pro ($15/월, VPN/Tor/프록시 감지)
- 데이터센터 IP 대역 리스트 자체 관리 (ASN 기반)

#### 6-2. 핑거프린트 조작 가능
**현황**: 브라우저 확장 프로그램(Canvas Blocker 등)으로 핑거프린트 변조 가능
**영향**: 매번 다른 핑거프린트로 빈도 기반 탐지 완전 회피

**개선안**:
- 핑거프린트 변조 감지 로직 추가 (Canvas API 비활성화 감지 → 의심 점수 +20)
- 핑거프린트 엔트로피 분석 (너무 고유하거나 너무 일반적인 값 의심)
- FingerprintJS Pro 도입 (유료, 99.5% 정확도, 변조 감지 내장)

#### 6-3. 클라이언트 데이터 신뢰성
**현황**: `dwellTimeBeforeClick`, `scrollDepthBeforeClick`, `mouseMovementsBeforeClick`이 클라이언트에서 전송됨
**영향**: 조작된 값을 보내면 행동 패턴 검사 무력화

**개선안**:
- 서버 사이드 세션 시간 검증 (세션 생성 시간 vs 클릭 시간)
- 클라이언트 값과 서버 타임스탬프 차이 교차 검증
- PageView의 `enterTime`과 click `timestamp` 비교로 서버 측 체류시간 산출

#### 6-4. 점수 합산 방식의 한계
**현황**: 각 규칙 점수가 단순 합산, 최대 100점으로 캡
**영향**: 이론적 최대점수 = 30+50+25+25+20+35+30+25+15+40 = **295점**이지만 100점으로 잘림

**개선안**:
- 가중 평균 방식으로 변경 (카테고리별 최대점수 제한)
- 또는 카테고리별 비율 방식: 빈도(40%) + 행동(30%) + 지역(15%) + 좌표(15%)
- ML 기반 앙상블 스코어링 (장기)

---

### 🟡 중요한 개선점

#### 6-5. 시간 윈도우 고정값 문제
**현황**: 5분, 10분, 1시간 등 고정 윈도우
**문제**: 5분 1초 간격으로 클릭하면 탐지 불가

**개선안**:
- 슬라이딩 윈도우 방식 적용
- 일일 누적 클릭 수 기반 규칙 추가 (예: 하루 10회 이상 → +40)
- 세션 간 패턴 분석 (같은 핑거프린트가 매일 반복 방문)

#### 6-6. 광고 소스별 차별 탐지 없음
**현황**: 네이버 SA, 구글 Ads, 카카오 등 광고 소스 구분 없이 동일 규칙
**문제**: 각 광고 플랫폼별 CPC가 다르고, 공격 패턴도 다름

**개선안**:
- 광고 소스별 임계값 차등 적용 (CPC 높은 플랫폼 → 더 엄격)
- 네이버 SA: 동일 검색어로 반복 유입 패턴 탐지
- 경쟁사 IP 대역 감시 (부동산 업계 특화)

#### 6-7. 실시간 알림 없음
**현황**: 대시보드에서 수동 확인만 가능
**문제**: 대규모 부정클릭 공격 시 실시간 대응 불가

**개선안**:
- 슬랙/텔레그램 웹훅 알림 (1시간 내 부정클릭 N건 이상 시)
- 이메일 일일 리포트
- 자동 방어 모드: 특정 IP 대역에서 급증 시 자동 차단

#### 6-8. 블랙리스트 관리 UI 없음
**현황**: 블랙리스트 자동 등록만 됨, 해제/관리 UI 없음

**개선안**:
- 블랙리스트 목록 조회/해제 관리 페이지
- 화이트리스트 기능 (특정 IP/핑거프린트 예외 처리)
- 블랙리스트 사유 및 증거 상세 보기

#### 6-9. 새벽 시간대 규칙 부정확
**현황**: 서버 시간(`new Date().getHours()`) 기준
**문제**: Vercel 서버는 UTC 기준 → 한국 시간과 9시간 차이

**개선안**:
- `new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })` 사용
- 또는 클라이언트 로컬 시간도 함께 전송받아 교차 확인

---

### 🟢 추가 개선 아이디어

#### 6-10. 세션 간 연결 분석
- 같은 핑거프린트가 다른 IP로 반복 접속하는 패턴 (IP 로테이션 공격)
- 같은 IP에서 다른 핑거프린트로 반복 접속하는 패턴 (핑거프린트 변조 공격)

#### 6-11. 클릭 속도 분석
- 클릭 간 간격(inter-click interval) 분석
- 인간의 평균 클릭 간격: 300ms~2s → 이보다 일정하거나 빠르면 봇

#### 6-12. 레퍼러 검증
- UTM 파라미터는 있지만 실제 레퍼러가 없는 경우 (직접 URL 입력 의심)
- 광고 랜딩인데 레퍼러가 광고 플랫폼이 아닌 경우

#### 6-13. JavaScript 실행 환경 검증
- `navigator.webdriver` 체크 (Selenium/Puppeteer 감지)
- `window.chrome` 존재 여부
- `navigator.plugins` 개수 (헤드리스 브라우저는 0개)

#### 6-14. 머신러닝 기반 이상 탐지 (장기)
- 정상 방문자 행동 프로필 학습
- 이상치 탐지 (Isolation Forest, Autoencoder)
- 클릭 시계열 패턴 분석

#### 6-15. 경쟁사 모니터링 (부동산 특화)
- 경쟁 분양현장 관련 IP 대역 모니터링
- 부동산 광고 대행사 IP 필터링
- 분양 시즌별 부정클릭 패턴 분석

---

## 7. 현재 DB 스키마 관련

### ClickEvent 모델 (핵심)
```prisma
model ClickEvent {
  id            String   @id @default(cuid())
  sessionId     String
  landingSiteId String?
  eventType     String   // ad_click, cta_click, phone_click, inquiry_submit, external_link
  targetUrl     String?
  targetElement String?
  targetText    String?
  clickX        Float?
  clickY        Float?
  viewportWidth  Int?
  viewportHeight Int?
  adSource      String?
  adCampaign    String?
  adGroup       String?
  adKeyword     String?
  adCreative    String?
  pageUrl       String?
  dwellTimeBeforeClick       Float?
  scrollDepthBeforeClick     Float?
  mouseMovementsBeforeClick  Int?
  timestamp     DateTime @default(now())
  isFraud       Boolean  @default(false)
  fraudReason   String?
  fraudScore    Int      @default(0) // 0-100
}
```

### 누락된 필드 제안
```prisma
// 추가 권장 필드
interClickInterval  Float?   // 이전 클릭과의 시간 간격 (ms)
isWebdriver         Boolean? // navigator.webdriver 값
pluginCount         Int?     // navigator.plugins 개수
clientTimestamp     DateTime? // 클라이언트 로컬 시간 (서버 시간과 교차 검증)
fraudCategory       String?  // frequency, behavior, geo, coordinate (탐지 카테고리)
```

---

## 8. 파일 구조 요약

| 파일 | 역할 | 라인수 |
|------|------|--------|
| `src/lib/fraudDetection.ts` | 부정클릭 탐지 알고리즘 전체 | ~449줄 |
| `src/lib/fingerprint.ts` | 브라우저 핑거프린트 생성 | ~486줄 |
| `src/lib/geoip.ts` | IP 지역 정보 조회 | ~255줄 |
| `src/app/api/analytics/click/route.ts` | 클릭 이벤트 API | ~224줄 |
| `src/components/analytics/AnalyticsTracker.tsx` | 클라이언트 추적 컴포넌트 | ~423줄 |
| `src/app/api/analytics/stats/route.ts` | 통계 조회 API | ~474줄 |
| `src/app/admin/analytics/page.tsx` | 관리자 대시보드 | ~340줄 |
| `prisma/schema.prisma` | DB 스키마 | ~280줄 |

---

## 9. 우선순위별 개선 로드맵 제안

### Phase 1: 즉시 수정 (1~2일)
1. ✅ 새벽 시간대 판정 → 한국 시간 기준으로 수정
2. ✅ 서버 측 체류시간 교차 검증 추가
3. ✅ `navigator.webdriver` 봇 감지 추가 (클라이언트)

### Phase 2: 단기 개선 (1~2주)
4. 일일 누적 클릭 수 규칙 추가
5. 클릭 간 간격(inter-click interval) 분석
6. 블랙리스트 관리 UI
7. 슬랙 알림 연동

### Phase 3: 중기 개선 (1~2달)
8. ipinfo.io 또는 ip-api Pro 도입 (VPN 감지)
9. 핑거프린트 변조 감지 로직
10. 광고 소스별 차등 탐지
11. 점수 산정 방식 개선 (카테고리별 가중치)

### Phase 4: 장기 (3달+)
12. 세션 간 연결 분석 (IP 로테이션 탐지)
13. ML 기반 이상 탐지
14. 경쟁사 패턴 분석 (부동산 특화)
