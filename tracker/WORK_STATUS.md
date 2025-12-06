# ONSIA Tracker 작업 상태 저장
**저장일**: 2025-12-04

---

## 완료된 작업

### 1. Prisma 버전 문제 해결
- **문제**: Prisma 6 + Turbopack 호환성 오류 (`#main-entry-point` 모듈 에러)
- **해결**: Prisma 5.22.0으로 다운그레이드
```bash
npm install prisma@5.22.0 @prisma/client@5.22.0 --save-exact
```

### 2. 빌드 오류 해결
- `getDeviceInfo` 함수 누락 → `src/lib/fingerprint.ts`에 alias 추가
- `utmParams.utmSource` → `utmParams.source`로 수정 (AnalyticsTracker.tsx)
- `OR2` 잘못된 Prisma 쿼리 → 제거 (fraudDetection.ts)
- `blacklistEntry` 미정의 변수 → `return false`로 수정

### 3. ESLint 설정 수정
- `eslint.config.mjs` - FlatCompat 사용하도록 수정

### 4. SQLite 호환성 수정
- PostgreSQL → SQLite로 변경 (로컬 개발용)
- `enum UserRole` → `String @default("ADMIN")`로 변경 (SQLite는 enum 미지원)
- `@db.Date` 어노테이션 제거

### 5. 프로젝트 설정 파일 생성
- `.claude/settings.local.json` - MCP 권한 설정
- `CLAUDE.md` - 프로젝트 가이드 문서

---

## 현재 상태

### 파일 수정 목록
| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | PostgreSQL→SQLite, enum→String |
| `src/lib/fingerprint.ts` | getDeviceInfo alias 추가 |
| `src/lib/fraudDetection.ts` | OR2 쿼리 제거, isBlacklisted 수정 |
| `src/components/analytics/AnalyticsTracker.tsx` | UTM 속성명 수정 |
| `eslint.config.mjs` | FlatCompat 설정 |
| `package.json` | Prisma 5.22.0 |

### 에러 상황
- 대시보드 접속 시 **"Failed to fetch stats"** 에러
- **원인**: SQLite DB 파일(`dev.db`)이 아직 생성되지 않음

---

## 다음에 할 작업

### 1. DB 초기화 (최우선)
```bash
cd D:\claude\홈페이지\분양현장_랜딩\tracker

# Prisma 클라이언트 재생성
npx prisma generate

# SQLite DB 생성
npx prisma db push

# (선택) 시드 데이터 추가
npx prisma db seed
```

### 2. 개발 서버 재시작
```bash
pnpm run dev
```

### 3. 대시보드 테스트
- http://localhost:3002/admin/analytics 접속
- 통계 API 정상 작동 확인

### 4. 관리자 대시보드 완성
- 실시간 방문자 차트
- 부정클릭 로그 페이지
- 방문자 상세 페이지
- 사이트 관리 CRUD

### 5. 랜딩페이지 연동 테스트
- AnalyticsTracker 컴포넌트 테스트
- 세션/페이지뷰/클릭 이벤트 수집 확인

---

## 프로젝트 구조 요약

```
tracker/
├── prisma/
│   └── schema.prisma      # SQLite, 7개 모델
├── src/
│   ├── app/
│   │   ├── admin/analytics/  # 관리자 대시보드
│   │   └── api/analytics/    # 추적 API
│   ├── components/
│   │   └── analytics/
│   │       └── AnalyticsTracker.tsx  # 클라이언트 추적
│   └── lib/
│       ├── fingerprint.ts    # 브라우저 핑거프린트
│       ├── fraudDetection.ts # 부정클릭 탐지
│       ├── geoip.ts          # IP 지역 정보
│       └── prisma.ts         # Prisma 클라이언트
├── .claude/
│   └── settings.local.json   # MCP 권한
├── CLAUDE.md                 # 프로젝트 가이드
└── package.json              # Prisma 5.22.0
```

---

## 핵심 명령어

```bash
# 개발 서버
pnpm run dev

# DB 관리
npx prisma generate
npx prisma db push
npx prisma studio

# 빌드
pnpm run build
```

---

## 주의사항

1. **Prisma 버전**: 5.22.0 유지 (6.x는 Turbopack과 호환 안됨)
2. **SQLite**: 개발용, 프로덕션은 PostgreSQL(Neon) 사용
3. **포트**: 기본 3000, 충돌 시 3001 또는 3002 사용
