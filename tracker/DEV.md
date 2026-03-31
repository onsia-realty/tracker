# ONSIA Tracker - 개발 문서

**최종 업데이트**: 2026-03-19
**프로젝트 경로**: `D:\claude\Traker\tracker`
**목표**: 스마트로그(smlog.co.kr) 수준의 부정클릭 방지 + 방문자 추적 시스템

---

## 1. 프로젝트 현황

### 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 16.2.0 |
| UI | React + Tailwind CSS | 18.3.1 / 4 |
| ORM | Prisma | 5.22.0 (6.x 호환 안됨) |
| DB | PostgreSQL (Neon) | - |
| 인증 | NextAuth.js | 4.x |
| 핑거프린트 | FingerprintJS | 5.x |
| 차트 | Recharts | 3.x |
| GeoIP | ip-api.com | 무료 (45req/min) |

### 프로젝트 구조

```
tracker/
├── prisma/
│   └── schema.prisma           # DB 스키마 (7 모델)
├── src/
│   ├── app/
│   │   ├── admin/analytics/    # 관리자 대시보드
│   │   │   ├── page.tsx        # 메인 개요 (30초 폴링)
│   │   │   ├── fraud/page.tsx  # 부정클릭 상세 (30초 폴링)
│   │   │   ├── visitors/page.tsx # 방문자 상세 (15초 폴링)
│   │   │   └── sites/page.tsx  # 사이트 관리 CRUD
│   │   └── api/
│   │       ├── analytics/
│   │       │   ├── session/route.ts   # 세션 생성/조회
│   │       │   ├── pageview/route.ts  # 페이지뷰 기록
│   │       │   ├── click/route.ts     # 클릭 + 부정클릭 판정
│   │       │   └── stats/route.ts     # 통계 조회
│   │       └── admin/sites/          # 사이트 CRUD API
│   ├── components/analytics/
│   │   └── AnalyticsTracker.tsx      # 랜딩페이지용 추적 컴포넌트
│   └── lib/
│       ├── fingerprint.ts     # 8컴포넌트 브라우저 핑거프린트 (SHA-256)
│       ├── fraudDetection.ts  # 4단계 부정클릭 탐지 (100점 스코어링)
│       ├── geoip.ts           # IP → 지역/VPN/ISP 정보
│       ├── tracker.ts         # 클라이언트 SDK
│       └── prisma.ts          # Prisma 클라이언트
└── .env                       # DATABASE_URL, NEXTAUTH_SECRET
```

### DB 스키마 (7 모델)

| 모델 | 역할 | 핵심 필드 |
|------|------|----------|
| **User** | 관리자 계정 | email, password, role |
| **LandingSite** | 분양현장별 사이트 | slug, name, cheongyakId |
| **VisitorSession** | 방문자 세션 | fingerprint, ipAddress, device*, riskScore, isBlocked |
| **PageView** | 페이지 조회 | path, dwellTime, scrollDepth, mouseMovements |
| **ClickEvent** | 클릭 이벤트 | eventType, fraudScore, isFraud, adSource |
| **Blacklist** | 차단 목록 | fingerprint, ipAddress, expiresAt |
| **DailyStats** | 일별 집계 | 방문/유입/부정클릭/디바이스 통계 |

---

## 2. 현재 구현 완료된 기능

### 부정클릭 탐지 알고리즘 (fraudDetection.ts)

**4단계 탐지 → 최대 140점 (100점 이상 = 블랙리스트)**

| 단계 | 탐지 항목 | 최대 점수 |
|------|----------|----------|
| 1. 빈도 기반 | 5분 내 3회 클릭 (+25), 1시간 내 5회 (+50), 동일IP 10분 내 5회 (+25) | 40점 |
| 2. 행동 패턴 | 체류 3초 미만 (+25), 스크롤 0-10% (+20), 마우스 이동 0 (+35) | 35점 |
| 3. 지역/시간 | VPN/프록시 (+30), 해외IP 광고클릭 (+25), 새벽 2-6시 (+15) | 25점 |
| 4. 좌표 패턴 | 동일 좌표 3회 이상 10분 내 (+40) - 자동화 도구 탐지 | 40점 |

**조치 기준:**
- 0-49점: 허용 (allow)
- 50-79점: 경고 (warn)
- 80-99점: 차단 (block)
- 100점+: 블랙리스트 영구 등록

**특수 로직:**
- 공유 IP 감지: 같은 IP에서 3개+ 다른 핑거프린트 → 점수 50% 감소
- 정상 행동 판정: 체류 10초+ & 스크롤 30%+ & 마우스 10회+

### 핑거프린트 (fingerprint.ts)

8개 컴포넌트 → SHA-256 해시 (fp_ 접두어):
1. Canvas 렌더링 (GPU/드라이버 고유)
2. WebGL (GPU vendor + renderer)
3. Audio Context (주파수 데이터)
4. 설치된 폰트
5. 화면 해상도 + 색상 깊이
6. 하드웨어 (CPU 코어, 메모리)
7. User-Agent + Client Hints
8. 로케일 (타임존, 언어)

보조 식별: `_onsia_cid` 쿠키 (1년 만료)

### 대시보드 (admin/analytics/)

- **메인 개요**: 실시간 방문자, 트래픽, 부정클릭, 절약 비용, 유입 경로 차트, 디바이스 분포
- **부정클릭**: 상세 로그 20건, 의심 IP 목록, 사유별 통계, 소스별 통계
- **방문자**: 실시간 + 트래픽 상세, 최근 방문자 목록
- **사이트 관리**: CRUD

### API 엔드포인트

| 엔드포인트 | 메소드 | 용도 |
|-----------|--------|------|
| `/api/analytics/session` | POST | 세션 생성, 블랙리스트 체크 |
| `/api/analytics/pageview` | POST/PATCH | 페이지뷰 기록, 체류시간 업데이트 |
| `/api/analytics/click` | POST | 클릭 기록 + 부정클릭 판정 |
| `/api/analytics/stats` | GET | 통계 (overview/traffic/fraud/realtime) |
| `/api/admin/sites` | GET/POST | 사이트 목록/생성 |
| `/api/admin/sites/[id]` | GET/PUT/DELETE | 사이트 상세 |

---

## 3. 스마트로그 대비 갭 분석

### 스마트로그 핵심 기능 vs 현재

| 기능 | 스마트로그 | ONSIA 현재 | 상태 |
|------|-----------|-----------|------|
| 부정클릭 탐지 (스코어링) | 임계값 기반 | 4단계 100점 스코어링 | ✅ 구현됨 (더 정교) |
| 브라우저 핑거프린트 | 기본 | 8컴포넌트 SHA-256 | ✅ 구현됨 |
| IP 블랙리스트 | ✅ | ✅ (30일/영구) | ✅ 구현됨 |
| 실시간 대시보드 | ✅ | ✅ (15-30초 폴링) | ✅ 구현됨 |
| GeoIP + VPN 탐지 | ✅ | ✅ (ip-api.com) | ✅ 구현됨 |
| **Google Ads API 연동** | OAuth → 1-click IP 차단 | ❌ 없음 | 🔴 미구현 |
| **네이버 광고 API 연동** | ✅ | ❌ 없음 | 🔴 미구현 |
| **대시보드 1-click 차단 버튼** | ✅ | ❌ 로그만 표시 | 🟡 미구현 |
| **휴대폰 기기 차단** | IP 기반 | ❌ 없음 | 🟡 미구현 |
| **알림 시스템** (이메일/슬랙) | ✅ | ❌ | 🟢 미구현 |
| **임계값 UI 설정** | UI에서 조절 | 코드 하드코딩 | 🟡 미구현 |
| **차단 이력/해제 관리** | ✅ | ❌ (등록만 가능) | 🟡 미구현 |

### 스마트로그 핵심 아키텍처

```
[랜딩페이지] → [ONSIA Tracker 서버] → [탐지 엔진]
                                          ↓
                              [관리자 대시보드]
                                   ↓ (1-click)
                        ┌─────────────────────────────┐
                        │  Google Ads API (OAuth 2.0)  │
                        │  → IP Exclusion Mutation     │
                        │  → Campaign Criterion API    │
                        ├─────────────────────────────┤
                        │  네이버 광고 API              │
                        │  → IP 제외 설정               │
                        └─────────────────────────────┘
```

**스마트로그의 핵심 차별점**: 탐지 → 차단까지 자동화 파이프라인
- 기존: 로그 확인 → 구글 애즈 콘솔 접속 → 수동 IP 등록 (5-10분)
- 스마트로그: 대시보드에서 버튼 1번 클릭 (3초)

---

## 4. 개발 로드맵

### Phase 1: 대시보드 차단 기능 (바로 시작 가능)

> 대시보드에서 의심 IP/기기를 즉시 차단할 수 있는 UI + API

**할 일:**
- [ ] `POST /api/admin/block` - 차단 API (IP, 핑거프린트, 기기 모델별)
- [ ] `GET /api/admin/blocklist` - 차단 목록 조회/해제
- [ ] `DELETE /api/admin/block/:id` - 차단 해제
- [ ] fraud 대시보드에 "차단" 버튼 추가
- [ ] 차단 관리 페이지 (`/admin/analytics/blocklist`)
- [ ] 차단 이력 로그 (누가, 언제, 왜 차단했는지)

**스키마 변경:**
```prisma
model BlockAction {
  id          String   @id @default(cuid())
  type        String   // ip, fingerprint, device_model
  value       String   // 차단 대상 값
  reason      String
  blockedBy   String   // 관리자 ID
  platform    String?  // google_ads, naver_ads, internal
  status      String   @default("active") // active, expired, revoked
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
  revokedAt   DateTime?
}
```

### Phase 2: 휴대폰 기기 차단 강화

> 모바일은 IP가 계속 바뀌므로 핑거프린트 + 디바이스 모델 기반 차단

**방법:**

| 차단 방식 | 설명 | 장단점 |
|----------|------|--------|
| 핑거프린트 차단 | 기기 고유 해시로 차단 | ✅ 가장 정확 / ❌ 브라우저 변경 시 우회 |
| 디바이스 모델 차단 | "SM-S911N" 같은 모델명 | ✅ 쉬움 / ❌ 같은 기기 전부 차단 |
| 쿠키 + 핑거프린트 | 복합 식별 | ✅ 우회 어려움 / ❌ 시크릿 모드 무력화 |
| Canvas+WebGL 해시 | GPU 기반 | ✅ 시크릿 모드에도 동작 / ❌ 같은 기기 그룹 |

**할 일:**
- [ ] 디바이스 모델별 차단 기능 (deviceVendor + deviceModel 조합)
- [ ] 차단 시 해당 핑거프린트 + IP + 쿠키 모두 차단 (복합 차단)
- [ ] 대시보드에 기기 정보 상세 표시 강화
- [ ] 모바일 전용 탐지 규칙 추가 (통신사 IP 대역 감지 등)

### Phase 3: Google Ads API 연동

> 대시보드에서 1-click으로 Google Ads IP 제외

**사전 준비 (필수):**
1. Google Ads 개발자 토큰 신청 → 승인 (수일~수주)
2. Google Cloud Console에서 OAuth 2.0 클라이언트 생성
3. Google Ads API 활성화

**구현:**
- [ ] OAuth 2.0 인증 플로우 (`/api/auth/google-ads`)
- [ ] Google Ads Customer ID 연결 UI
- [ ] `googleapis` 패키지 설치
- [ ] CampaignCriterion API로 IP 제외 뮤테이션
- [ ] 1-click 차단 버튼 → Google Ads IP Exclusion 자동 등록
- [ ] 연동 상태 표시 (연결됨/연결 안됨)

**핵심 API 흐름:**
```
[차단 버튼 클릭]
  → POST /api/admin/block { ip, platform: "google_ads" }
    → Google Ads API: CampaignCriterionService.mutate({
        customerId: "xxx-xxx-xxxx",
        operations: [{
          create: {
            campaign: "customers/{id}/campaigns/{campaignId}",
            criterion: { ipBlock: { ipAddress: "1.2.3.4/32" } }
          }
        }]
      })
    → DB에 차단 이력 저장
  → 응답: { success: true, platform: "google_ads" }
```

**제약사항:**
- Customer ID 직접 연동만 가능 (MCC 관리자 계정 불가)
- IP Exclusion은 캠페인 단위 (계정 단위는 별도 API)
- 최대 500개 IP 제외 가능 (Google Ads 제한)

### Phase 4: 네이버 광고 API 연동

> 네이버 검색광고 API로 IP 제외

**사전 준비:**
1. 네이버 검색광고 API 키 발급
2. API 라이센스 키, 시크릿 키, 고객 ID 확보

**할 일:**
- [ ] 네이버 API 인증 (`X-API-KEY`, `X-Customer`, `X-Signature`)
- [ ] IP 제외 설정 API 호출
- [ ] 대시보드에 네이버 차단 버튼 추가
- [ ] Google/네이버 동시 차단 옵션

### Phase 5: 고도화

- [ ] 알림 시스템 (이메일/슬랙 웹훅 — 부정클릭 급증 시)
- [ ] 임계값 UI 설정 (관리자가 점수 기준 조정)
- [ ] 일간/주간 리포트 자동 생성
- [ ] ML 기반 이상탐지 (클러스터링, 시계열 분석)
- [ ] 차단 자동화 규칙 (100점 이상 자동 Google Ads 차단)

---

## 5. 개발 환경 세팅

### 필수 명령어

```bash
cd D:\claude\Traker\tracker

# 의존성 설치
pnpm install

# Prisma 클라이언트 생성
npx prisma generate

# DB 마이그레이션 (PostgreSQL)
npx prisma migrate dev

# 개발 서버
pnpm run dev

# DB GUI
npx prisma studio
```

### 환경 변수 (.env)

```env
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### 주의사항

- **Prisma 5.22.0 유지** — 6.x는 Next.js Turbopack과 호환 안됨
- **PostgreSQL(Neon) 사용** — 프로덕션 DB
- dev 서버 기본 포트 3000, 충돌 시 3001/3002
- 모든 API에 CORS 헤더 적용됨 (외부 랜딩페이지 연동용)

---

## 6. 과거 해결한 이슈

| 이슈 | 해결 |
|------|------|
| Prisma 6 + Turbopack 모듈 에러 | Prisma 5.22.0 다운그레이드 |
| `getDeviceInfo` 함수 누락 | fingerprint.ts에 alias 추가 |
| `utmParams.utmSource` 타입 에러 | `utmParams.source`로 수정 |
| `OR2` 잘못된 Prisma 쿼리 | fraudDetection.ts에서 제거 |
| ESLint FlatCompat 설정 | eslint.config.mjs 수정 |
| `isolatedModules` export 에러 | tracker.ts export type 수정 |
| `deviceModel null` 타입 에러 | fingerprint.ts null 체크 추가 |
| Next.js 15.2.0 CVE 취약점 | 16.2.0으로 업데이트 |

---

## 7. 랜딩페이지 연동

```tsx
// 분양현장 랜딩페이지에 추가
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';

export default function LandingPage() {
  return (
    <>
      <AnalyticsTracker
        config={{
          apiEndpoint: 'https://tracker.onsia.city/api/analytics',
          siteSlug: 'hillstate-xx',  // 사이트 slug
          trackClicks: true,
          trackScroll: true,
          trackMouse: true,
        }}
      />
      {/* 페이지 컨텐츠 */}
    </>
  );
}
```

---

## 8. 운영 비용

| 서비스 | 비용 | 비고 |
|--------|------|------|
| Vercel | 무료 (Hobby) | Next.js 호스팅 |
| Neon PostgreSQL | 무료 | 0.5GB |
| ip-api.com | 무료 | 45req/min |
| Google Ads API | 무료 | 개발자 토큰 필요 |
| 네이버 광고 API | 무료 | API 키 필요 |
| **합계** | **₩0/월** | |
