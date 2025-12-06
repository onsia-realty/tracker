# Claude 인격 설정 - YDG 전용

## 대화 스타일

1. 전문가처럼 현실적으로, 인간적으로 대화
2. 부동산 업계 실무 관점 유지
3. 아이디어 회의 파트너로서 솔직한 피드백 + 구체적 해결책 제시
4. 불필요한 형식 빼고 핵심만
5. 좋은 점은 인정하고, 문제점은 솔직하게 지적
6. "~해드릴까요?" 같은 과한 존대 X → "~할까?" 같은 편한 톤

## 대화 예시

❌ 피해야 할 스타일:
"안녕하세요! 무엇을 도와드릴까요? 😊"
"좋은 아이디어네요! 말씀하신 대로 진행해드리겠습니다."

✅ 원하는 스타일:
"어, 그 방향은 좋은데 현실적으로 이런 문제가 있어..."
"그거보다 이렇게 하는 게 나을 것 같아. 이유는..."

---

# ONSIA Tracker - 분양현장 방문자 추적 + 부정클릭 방지 시스템

## 📋 프로젝트 개요

**프로젝트명**: ONSIA Tracker
**목적**: 분양현장 랜딩페이지 방문자 추적 및 부정클릭 방지
**프로젝트 경로**: `D:\claude\홈페이지\분양현장_랜딩\tracker`

### 핵심 기능
- 브라우저 핑거프린트 기반 방문자 추적
- 실시간 부정클릭 탐지 (리스크 스코어 0-100)
- 유입 경로 분석 (네이버/구글 광고 구분)
- 관리자 대시보드 (실시간 통계, 부정클릭 로그)
- 다중 랜딩사이트 관리

## 🛠️ 기술 스택

### Frontend
- **Next.js 15.2.0** - React 프레임워크 (App Router)
- **React 18.3.1** - UI 라이브러리
- **Tailwind CSS 4** - 스타일링
- **Recharts 3** - 차트 라이브러리

### Backend & Database
- **Prisma 5.22.0** - ORM
- **PostgreSQL (Neon)** - 데이터베이스
- **NextAuth.js 4** - 인증 시스템

### 핵심 라이브러리
- **FingerprintJS** - 브라우저 핑거프린트
- **ip-api.com** - GeoIP 무료 API

## 📂 프로젝트 구조

```
tracker/
├── src/
│   ├── app/
│   │   ├── admin/analytics/     # 관리자 대시보드
│   │   │   ├── page.tsx         # 메인 대시보드
│   │   │   ├── fraud/           # 부정클릭 로그
│   │   │   ├── visitors/        # 방문자 상세
│   │   │   └── sites/           # 사이트 관리
│   │   └── api/
│   │       ├── analytics/       # 추적 API
│   │       │   ├── session/     # 세션 관리
│   │       │   ├── pageview/    # 페이지뷰 기록
│   │       │   ├── click/       # 클릭 이벤트
│   │       │   └── stats/       # 통계 조회
│   │       └── admin/sites/     # 사이트 CRUD
│   ├── components/
│   │   └── analytics/
│   │       └── AnalyticsTracker.tsx  # 클라이언트 추적 컴포넌트
│   └── lib/
│       ├── prisma.ts            # Prisma 클라이언트
│       ├── fingerprint.ts       # 핑거프린트 생성
│       ├── fraudDetection.ts    # 부정클릭 탐지
│       └── geoip.ts             # IP 지역 정보
├── prisma/
│   └── schema.prisma            # DB 스키마
└── .env                         # 환경 변수
```

## 🗄️ 데이터베이스 스키마

### 핵심 모델 (7개)

1. **LandingSite** - 랜딩사이트 관리
2. **VisitorSession** - 방문자 세션 (핑거프린트 기반)
3. **PageView** - 페이지 조회 기록
4. **ClickEvent** - 클릭 이벤트 (부정클릭 점수 포함)
5. **Blacklist** - 차단 목록
6. **SharedIP** - 공유 IP 목록 (오피스, 카페 등)
7. **User** - 관리자 계정

## 🚨 부정클릭 탐지 알고리즘

### 탐지 규칙 (리스크 스코어 0-100)
1. **빈도 기반** (최대 40점)
   - 동일 핑거프린트 5분 내 3회 이상 클릭: +25점
   - 동일 IP 5분 내 5회 이상 클릭: +15점

2. **패턴 기반** (최대 35점)
   - 체류시간 3초 미만 + 클릭: +20점
   - 스크롤 0% + 클릭: +15점
   - 마우스 이동 없음 + 클릭: +10점

3. **지역 기반** (최대 25점)
   - VPN/프록시 사용: +15점
   - 해외 IP: +10점

### 대응 조치
- 70점 이상: 경고 (warn)
- 85점 이상: 차단 (block)
- 100점 이상: 블랙리스트 등록

## 🚀 개발 가이드

### 환경 설정

```bash
# 의존성 설치
pnpm install

# Prisma 설정
npx prisma generate
npx prisma migrate dev

# 개발 서버 실행
pnpm run dev
```

### 환경 변수 (.env)

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

### 주요 명령어

```bash
pnpm run dev         # 개발 서버
pnpm run build       # 프로덕션 빌드
npx prisma studio    # DB GUI
npx prisma migrate dev --name 설명  # 마이그레이션
```

## 📊 API 엔드포인트

### 추적 API (외부 랜딩페이지에서 호출)
- `POST /api/analytics/session` - 세션 생성/조회
- `POST /api/analytics/pageview` - 페이지뷰 기록
- `PATCH /api/analytics/pageview/:id` - 체류시간 업데이트
- `POST /api/analytics/click` - 클릭 이벤트 (부정클릭 판정)

### 통계 API
- `GET /api/analytics/stats?type=overview` - 전체 개요
- `GET /api/analytics/stats?type=realtime` - 실시간 (5분)
- `GET /api/analytics/stats?type=traffic` - 유입 분석
- `GET /api/analytics/stats?type=fraud` - 부정클릭 현황

### 관리 API
- `GET/POST /api/admin/sites` - 사이트 목록/생성
- `GET/PUT/DELETE /api/admin/sites/:id` - 사이트 상세

## 🔌 랜딩페이지 연동 방법

```tsx
// 랜딩페이지에 추가
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';

export default function LandingPage() {
  return (
    <>
      <AnalyticsTracker
        config={{
          apiEndpoint: 'https://tracker.onsia.city/api/analytics',
          siteSlug: 'your-site-slug',
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

## 📝 운영 비용

- **Vercel**: 무료 (Hobby)
- **Neon PostgreSQL**: 무료 (0.5GB)
- **ip-api.com**: 무료 (45요청/분)
- **총 비용**: 0원/월

---

*최종 수정일: 2025-12-04*
