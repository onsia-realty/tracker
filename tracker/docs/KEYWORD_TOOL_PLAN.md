# 네이버 키워드 리서치 툴 구현 계획

> 작성 2026-07-29 · 대상 레포 `D:\claude\부정클릭\tracker` (github: onsia-realty/tracker, branch `main`)

## Context

야목역 서희스타힐스 광고 운영 중 블랙키위로 연관키워드를 조사하다가, **블랙키위가 하는 일이 사실상 네이버 API 래핑**이라는 걸 확인했다. 같은 데이터를 직접 받을 수 있고, 거기에 블랙키위가 절대 가질 수 없는 것 — **우리 광고비 집행 실적 + 우리 랜딩의 실제 방문/체류/전화클릭** — 을 키워드 단위로 붙이면 "이 키워드가 실제로 돈이 됐나"를 볼 수 있다.

지금 문제 상황:
- 최근 7일 야목 광고 유입 4건, 그중 3건이 체류 0초 → 광고가 거의 안 돌거나 예산 소진 의심
- utm_term이 실린 세션이 7일간 **1건** → 어떤 키워드가 돈을 먹는지 추적 불가
- 블랙키위는 시장 검색량만 보여줄 뿐, 우리 성과와 연결되지 않음

목표: tracker 관리자에 **키워드 발굴 탭**을 추가해 ① 연관/세부 키워드 발굴 ② 황금키워드(수요 대비 경쟁 낮음) 판별 ③ 우리 광고 실적·방문 데이터와 조인.

---

## 검증 완료된 사실 (실제 파일 확인함)

| 항목 | 확인 결과 |
|---|---|
| tracker 스택 | Next 16.2.0 App Router + Prisma **5.22.0 고정**(6은 Turbopack과 충돌), pnpm, Vercel 배포 |
| Prisma | `schemas = ["tracker"]`, `previewFeatures = ["multiSchema"]` → **모든 신규 모델에 `@@schema("tracker")` 필수** |
| **`prisma/migrations` 디렉터리 없음** | 마이그레이션 이력이 아예 없음 → **`prisma migrate dev` 절대 금지** (운영 DB reset 제안 위험). `db push`만 사용 |
| **관리자 인증 전무** | `grep next-auth src/` → 0건. `middleware.ts` 없음. `/admin/*`, `/api/admin/*` 전부 공개. `User` 모델 + bcryptjs는 있는데 미사용 |
| 탭 패턴 | `admin/analytics/page.tsx` 에 `visitors\|blacklist\|keywords\|clicks\|overview` 탭 상태 + `selectedSite`/`period` props → `components/tabs/*.tsx`. 전부 client component + `useEffect` + `fetch('/api/admin/...')` |
| 외부 API 관례 | `src/lib/notifyFraud.ts` — env를 `.trim().replace(/[\r\n]/g,'')`로 sanitize, 키 없으면 lazy null, **throw 대신 `{success, skipped?, error?}` 반환**. `src/lib/geoip.ts` — fetch + `next:{revalidate}` + 실패 시 null |
| HMAC 코드 | 레포 전체에 `createHmac` 0건 → 이번이 최초 |
| `.env` | DATABASE_URL, DATABASE_URL_UNPOOLED, NEXTAUTH_*, IPINFO_TOKEN, NEXT_PUBLIC_* 7개뿐. **네이버 자격증명 없음** |
| DEV.md | 256~268행에 "Phase 4: 네이버 광고 API 연동" 스케치 이미 있음 (X-API-KEY/X-Customer/X-Signature) |

### UTM에 대한 정정 (중요)

설계 중 "코드 버그 때문에 UTM이 저장 안 된다"는 가설이 나왔으나 **직접 확인 결과 우리 운영 랜딩은 정상이다**:

- 야목/어반홈스 랜딩이 쓰는 클라이언트는 `onsia_homepage_new/src/lib/onsia-tracker.ts`. 209행에서 `utmTerm: utm.utm_term` 을 **올바른 키로** `/api/analytics/session`에 보낸다. 서버(`session/route.ts:174`)도 `body.utmTerm`을 읽는다 → **양쪽 일치, 정상 동작**.
- 따라서 utm_term 1건은 코드 문제가 아니라 **광고 소재에 utm_term이 안 붙어 있는 것**. 즉 순수 광고 설정 이슈.

다만 아래 2건은 실제 버그이므로 별도로 고친다 (지금 우리 매출엔 영향 없음):
- `tracker/src/components/analytics/AnalyticsTracker.tsx:162` — `parseUTMParams()`가 `{source, medium, term...}`을 반환하는데 `...utmParams`로 그대로 스프레드 → 서버가 읽는 `utmSource/utmTerm`과 키 불일치. 이 컴포넌트를 쓰는 사이트는 UTM이 전부 유실됨.
- `tracker/src/app/api/track/route.ts:92~95` — `utmSource/Medium/Campaign/Content`는 매핑하는데 **`utmTerm` 줄이 통째로 누락**.

---

## 데이터 소스

| 소스 | 인증 | 주는 것 |
|---|---|---|
| **검색광고 API** `api.searchad.naver.com` | HMAC-SHA256 (X-API-KEY / X-Customer / X-Signature / X-Timestamp) | `/keywordstool` 연관키워드 + PC·모바일 검색량 + 평균클릭수 + CTR + `plAvgDepth`(노출광고수) + `compIdx`(경쟁도). 시드 최대 5개, 최대 ~1000행 |
| 검색광고 estimate 계열 | 동일 | 예상 CPC / 최소노출입찰가 / 예상실적 |
| 검색광고 stat·report 계열 | 동일 | **우리 계정의 키워드별 노출·클릭·비용·평균순위** ← UTM 없이도 나옴 |
| **개발자센터 오픈API** `openapi.naver.com` | X-Naver-Client-Id / Secret (무료, 25,000/일) | `/v1/search/blog.json?query=X&display=1` 의 `total` = **블로그 누적 발행량** (블랙키위의 그 컬럼) |
| 자동완성 `ac.search.naver.com/nx/ac` | 없음 (비공식) | 세부 키워드 제안. best-effort, 실패해도 무시 |
| **우리 tracker DB** | — | `VisitorSession.utmTerm` 기준 세션수·평균체류(`totalDwellTime`)·PV, `ClickEvent`(`phone_click`/`cta_click`) |

**황금키워드 지수 = 월간검색량 ÷ 블로그발행량.** 높을수록 "수요는 있는데 글이 없는" 구간. 야목 사례: `줍줍`(검색20/글57), `경쟁률`(20/76)이 황금, `모델하우스`(40/26,500)는 포화.

---

## Phase 0 — 자격증명 발급 + env (코드 없음, 사람이 하는 일)

### 0-1. 검색광고 API
1. `manager.searchad.naver.com` → 우측상단 **도구 > API 사용 관리**
2. 라이선스 발급 → **액세스라이선스 / 비밀키 / CUSTOMER_ID** 3개 확보 (비밀키는 1회만 노출될 수 있으니 즉시 복사)
3. ⚠️ **대행사 위임 계정이면 이 메뉴가 안 보인다.** 30분 안에 판명되니 제일 먼저 확인. 안 보이면 광고주 권한 요청 or 오픈API+자동완성만으로 축소 구성.
4. ⚠️ 라이선스는 특정 광고계정 종속. 현장별로 광고계정이 다르면 `/keywordstool`은 공통이지만 **stat/estimate는 계정별**이라 CUSTOMER_ID를 콤마 리스트로 설계할지 여기서 결정.

### 0-2. 오픈API
`developers.naver.com/apps/#/register` → 애플리케이션 등록 → 사용 API **검색** 선택 → `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`.

### 0-3. env
`.env`에 5개 추가 (`.gitignore`에 `.env*` 있음 — 커밋 안 됨):
```
NAVER_AD_API_KEY=
NAVER_AD_SECRET_KEY=
NAVER_AD_CUSTOMER_ID=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```
Vercel은 **`scripts/setup-vercel-env.sh`를 쓰지 말 것** (기존 변수를 rm 후 재등록하고 `vercel --prod`까지 돌려서 무관한 재배포가 발생). 대신 `npx vercel env add <NAME> production` 5회 개별 등록.

**검증**: `npx vercel env ls production` 에 5개 노출.

---

## Phase 1 — API 클라이언트 + CLI 스모크 (UI/DB 없이)

> **DB 스키마를 확정하기 전에 반드시 통과해야 한다.** 응답 필드를 추측해서 모델 짜면 두 번 일한다.

### 생성 `scripts/naver-smoke.mjs`
기존 `.mjs` 관례(argv 인자, 한글 리포트, `■`/`===` 헤더) 따름. ⚠️ 기존 스크립트가 dotenv 없이 도는 건 **Prisma가 `.env`를 자동 로드**하기 때문 — 이 스크립트는 Prisma를 안 쓰므로 반드시 `node --env-file=.env` 로 실행.

```js
import crypto from 'node:crypto'
const BASE = 'https://api.searchad.naver.com'
const sanitize = s => (s || '').trim().replace(/[\r\n]/g, '')
function headers(method, path) {          // path에 쿼리스트링 제외
  const ts = Date.now().toString()
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${method}.${path}`).digest('base64')
  return { 'X-Timestamp': ts, 'X-API-KEY': API_KEY, 'X-Customer': CUSTOMER, 'X-Signature': sig }
}
```
순서대로 출력: ① env 4개 **길이만** 마스킹 출력 ② `GET /keywordstool?hintKeywords=..&showDetail=1` 의 HTTP 상태 + **응답 원문 앞 1200자** ③ 상위 20개 표 ④ 오픈API 블로그 `total` ⑤ 자동완성. 각 단계 try/catch로 격리.

### 이 단계에서 눈으로 확정할 것
- `"< 10"` 문자열의 **실제 형태** (`"< 10"` / `"<10"` / 공백)
- `monthlyAvePcCtr`가 비율(0.53)인지 퍼센트(53)인지
- 반환 키워드의 공백·대소문자 처리 (조인 시 정규화 기준)

### 반드시 공식문서(`naver.github.io/searchad-apidoc`)로 확인 — 추측 금지
- `/estimate/*` 는 **GET이 아니라 POST + JSON body**일 가능성이 높다. `{type}` 값과 body 스키마 확인
- **stat/report**: 실시간 `/stats`(대상 개수 제한) vs `/stat-reports`(**비동기: job 생성 → 폴링 → downloadUrl TSV**). 후자면 서버리스 라우트가 아니라 **CLI/크론**이어야 함
- 서명 대상 path에 쿼리스트링 포함 여부 (401 나면 첫 번째 의심 지점)
- rate limit / 429 포맷

### 통과 후 TS 클라이언트
- `src/lib/naver/types.ts`
- `src/lib/naver/searchAd.ts` — `NaverResult<T> {ok, data?, error?, status?}`, `signedHeaders()`, `getRelatedKeywords(hints)` (5개씩 자동 청킹), `parseCount(v) → {value, isLow}` (`"< 10"`→9, 콤마 방어, NaN→0). notifyFraud 관례대로 **throw 금지**
- `src/lib/naver/openApi.ts` — `getDocCounts(kw, kinds)`, `next:{revalidate: 604800}`
- `src/lib/naver/autocomplete.ts` — 비공식이므로 옵셔널체이닝 도배 + 실패 시 `[]`
- `src/lib/naver/throttle.ts` — `mapLimit(items, limit, fn)`, `withRetry`(429/5xx 지수백오프 300→600→1200 + jitter), `makeBudget(max)`. 검색광고 concurrency 2 / 최소간격 150ms, 오픈API concurrency 4
- `src/lib/naver/date.ts` — `kstDateOnly(d)` 하나로 KST 날짜 통일 (기존 `const KST = 9*60*60*1000` 관례 유지)

**검증**: `node --env-file=.env scripts/naver-smoke.mjs 야목역서희스타힐스 화성분양` → HTTP 200 + `keywordList` 배열. 401=서명/시크릿, 403=CUSTOMER_ID 권한.

**이 페이즈만으로도 CLI 키워드 조사가 가능하다 — UI 없이 당장 쓸 수 있음.**

---

## Phase 2 — 영속 계층 (Prisma)

`prisma/schema.prisma` 하단에 4개 모델 추가. 전부 `@@schema("tracker")` + camelCase 필드 + `@map("snake")` + `@@map("snake_plural")`.

- **`KeywordSnapshot`** → `keyword_snapshots`
  `keyword`, `collectedDate @db.Date`, `pcSearches/mobileSearches/totalSearches`, `isLowVolume`, `pcClicks/mobileClicks/pcCtr/mobileCtr`, `adDepth`, `compIdx`, `blogTotal/cafeTotal/webTotal/newsTotal` + `docCheckedAt`, `goldenRatio`, `estimatedCpcPc/Mobile` + `bidCheckedAt`, `hintKeyword`, `searchId`
  `@@unique([keyword, collectedDate])` + index(keyword / collectedDate / totalSearches / goldenRatio)
  → 같은 날 재조회는 upsert로 흡수(API 재호출 0), 날짜 바뀌면 새 행 = **시계열 비교**(블랙키위 유료 기능)
  → 발행량을 별도 테이블로 안 뺀 이유: 조인 없이 한 행에서 황금지수 정렬하려고. 대신 `docCheckedAt`/`bidCheckedAt`으로 **필드별 TTL**(검색량 1일 / 발행량 7일 / 입찰가 1일)
- **`KeywordSearch`** → `keyword_searches`
  `hintKeywords`, `source`, `resultCount`, `apiCalls`, `cacheHits`, `durationMs`, `status`, `errorMessage`, `requestedBy` — 쿼터 감시 + 캐시 판정용
- **`NaverAdStat`** → `naver_ad_stats`
  `statDate @db.Date`, `customerId`, `nccKeywordId`, `keyword`, `campaign*/adGroup*`, `device`, `impressions/clicks/cost/avgRank/ctr/cpc`
  `@@unique([statDate, customerId, nccKeywordId, device])`
  ⚠️ `nccKeywordId`는 **non-null 필수** — Postgres에서 NULL은 unique를 우회해 중복이 쌓인다. id 없는 리포트 행은 버릴 것
  → **UTM과 무관하게 채워지므로 첫날부터 100% 동작**
- **`KeywordWatch`** → `keyword_watches` — `keyword @unique`, `landingSiteId`, `memo`, `isActive`. 일일 자동 추적 대상

`@db.Date` + KST: `new Date(Date.UTC(y,m,d))` 로 **KST 날짜의 UTC 자정** 저장. 전 구간 `kstDateOnly()`만 사용.

### 적용 (❗migrate 아님)
```bash
npx prisma validate
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script   # 적용될 SQL 미리보기
npx prisma db push          # --accept-data-loss 절대 금지
npx prisma generate
```
`db push`가 파괴적 변경을 요구하며 멈추면 = **스키마가 운영 DB와 이미 드리프트**. 진행하지 말고 diff를 사람이 검토.

**검증**: `npx prisma studio` 에서 신규 4개 테이블 확인 + **기존 8개 테이블 행 수 불변**.

---

## Phase 3 — 관리자 인증 (쿼터 소비 엔드포인트를 열기 전 필수)

지금 `/api/admin/*`는 URL만 알면 누구나 호출 가능 → 유료 API를 물리면 **남이 우리 검색광고 쿼터를 태울 수 있다.**

**옵션 A (권장) — 자체 서명 쿠키. 신규 의존성 0.**
next-auth v4는 Next 16 / React 19.2 조합에서 미검증이고, 이 레포에선 **한 줄도 안 쓰이고 있다**(= 붙여본 적 없음). HMAC은 어차피 Phase 1에서 쓴다.

- `src/lib/adminAuth.ts` — `signSession()` / `verifySession()` / `requireAdmin(req)` / `unauthorized()`. 키는 기존 `NEXTAUTH_SECRET` 재사용
- `src/app/api/admin/login/route.ts` — bcrypt 검증 → `Set-Cookie: onsia_admin=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
- `src/app/admin/login/page.tsx` — 다크테마 폼
- `src/middleware.ts` — matcher `['/admin/:path*', '/api/admin/:path*']` (login 경로 제외)
  ⚠️ **미들웨어는 엣지 런타임이라 `node:crypto`/bcrypt 불가.** 미들웨어는 **쿠키 존재만** 확인, 암호학적 검증은 각 라우트에서 `requireAdmin()`(Node 런타임). 이 2단 구조 필수
- `scripts/create-admin.mjs` — bcrypt 해시로 `User` upsert

🚨 **matcher 사고 주의**: `/api/analytics/*`, `/api/track`, `/api/stats`가 인증에 걸리면 **전 분양현장 추적이 즉사**한다. matcher는 `/admin`, `/api/admin`만. 배포 후 실제 랜딩에서 세션 생성되는지 반드시 확인.

**검증**: `curl -i /api/admin/keywords` → 401 / 로그인 후 쿠키로 → 200. 시크릿창에서 `/admin/analytics` → `/admin/login` 리다이렉트.

---

## Phase 4 — API 라우트 (캐시 우선)

- **`src/app/api/admin/keyword-research/route.ts`** (`runtime='nodejs'`)
  `GET ?q=a,b&refresh=0` → requireAdmin → q 파싱(공백제거·중복제거·**최대 5개**) → 오늘(KST) `KeywordSearch`에 동일 시드 성공 로그가 있으면 **DB에서만** 반환 → 미스일 때만 API 호출 후 upsert → `KeywordSearch` 1행 기록
  응답 `{ rows, cached, apiCalls, collectedDate }`
  ⚠️ 캐시 판정 키는 **시드 기준**. 결과 키워드 기준으로 하면 매번 미스
- **`.../enrich/route.ts`** `POST { keywords: string[] (≤20), type: 'docs'|'bid' }` — `mapLimit(4)` 병렬, `docCheckedAt` 7일 이내 스킵, goldenRatio 재계산
  ⚠️ **Vercel 함수 타임아웃** — 200개를 한 요청에 넣지 말 것. 20개씩 잘라 **클라이언트가 순차 호출** + 서버도 `makeBudget(25)`로 상한. 이게 "큐잉"의 실제 형태
- **`.../history/route.ts`** — 최근 50건 + 오늘 `apiCalls` 합계(쿼터 감시)
- **`.../joined/route.ts`** — Phase 6에서 채움, 골격만
- **`scripts/naver-sync-stats.mjs`** — stat/report → `NaverAdStat` upsert. **비동기 리포트면 서버리스 요청 안에서 안 끝나므로 1차는 CLI 전용**. UI 트리거는 나중에 Vercel Cron

**검증**: 1회차 `cached=false, apiCalls>0` → 즉시 재호출 `cached=true, apiCalls=0`. studio에서 `keyword_searches` 2행(miss 1, hit 1).

---

## Phase 5 — 관리자 UI 탭

**수정** `src/app/admin/analytics/page.tsx` — `Tab` 타입에 `'research'` 추가, `TABS`에 `{key:'research', label:'키워드 발굴'}` 추가(기존 '키워드 분석'은 **유지** — 그건 우리 트래픽 리포트, 새 탭은 시장 조사), 렌더 라인 추가. 상단 기간 셀렉터에는 **넣지 않음**(스냅샷은 오늘자 기준, 탭 내부 자체 컨트롤).

**생성** `src/app/admin/analytics/components/tabs/KeywordResearchTab.tsx` — `KeywordAnalysisTab.tsx`의 마크업/스피너(`border-t-indigo-500 animate-spin`)/카드 스타일(`rounded-2xl bg-[#1a1d27] border-slate-800/50`) 그대로 복제.

1. 시드 입력 바 (콤마 구분 ≤5) + [조회] + 자동완성 칩
2. 요약 카드 4개 — 키워드 수 / 총검색량 / 황금키워드 수 / 오늘 API 호출 수
3. 테이블 14열: `키워드 | PC | 모바일 | 총검색량 | 블로그발행량 | 황금지수 | 경쟁도 | 광고depth | 예상CPC | 우리노출 | 우리클릭 | 우리비용(VAT별도) | 세션 | 전화클릭`
   - `"< 10"` 행은 `<` 뱃지, 황금지수 색상 `≥5` emerald / `1~5` amber / `<1` slate
   - 컬럼이 14개라 **헤더 클릭 정렬**
4. 점진적 보강 — 최초엔 검색량만, 마운트 후 `enrich`를 20개씩 순차 호출하며 진행바. **AbortController로 탭 이탈 시 중단**(안 하면 쿼터 계속 태움)
5. CSV 내보내기 — 신규 의존성 0, `'\uFEFF' + ...` **BOM 필수**(없으면 엑셀에서 한글 깨짐)

**검증**: `/admin/analytics` → 키워드 발굴 → `야목역서희스타힐스` 조회 → 표 렌더 → CSV 엑셀 한글 정상 → 재조회 시 즉시 응답. `pnpm build` 타입에러 0.

---

## Phase 6 — 조인 + UTM 태깅

### 6-1. 우리 랜딩 UTM (코드 정상, **광고 설정 문제**)
네이버 검색광고엔 구글의 `{keyword}` 같은 매크로가 **없다**. 현실적 답:

1. **프리미엄 로그분석 활성화** (광고관리 > 도구) → 네이버가 랜딩 URL에 `n_query` / `n_keyword` / `n_ad_group` / `n_rank` / `n_media` 를 **자동으로** 붙여준다. 키워드별 URL 수정 없이 전 캠페인 일괄 적용 ← **이게 정답.** 먼저 켜져 있는지 확인
2. 서버에 `n_*` 폴백 파싱 추가 — `utmTerm`이 비면 `landingUrl`/`referrer`에서 `n_query`/`n_keyword`를 파싱해 채운다. `src/app/api/admin/keywords/route.ts`가 이미 `PageView.fullUrl`에서 `n_query`를 파싱 중이니 `src/lib/naver/utmFallback.ts`로 추출해 공용화
3. 랜딩 URL에 캠페인 공통값 고정: `?utm_source=naver&utm_medium=cpc&utm_campaign=<현장slug>`, 상위 20개 키워드만 수동 `utm_term=`
4. 재방문 세션 보정 — 현재 재방문 시 UTM을 안 건드림(주석 "첫 방문 값 유지"). **null일 때만** 채우도록 `utmTerm: existing.utmTerm ?? newTerm`. 안 하면 이미 쌓인 null이 영원히 null

### 6-2. 별건 버그 수정 (위 정정 섹션 참조)
- `AnalyticsTracker.tsx:162` — `...utmParams` → 올바른 키로 매핑
- `track/route.ts:95` 뒤 — `utmTerm: payload.utm?.utm_term || null,` 한 줄 추가
- 겸사겸사 `session/route.ts` body 파싱을 관대하게 (`utmTerm|utm_term|term` 모두 허용) — 랜딩 재배포 없이 서버만 고쳐 흡수

### 6-3. 조인 쿼리
```
KeywordSnapshot (오늘자, 시장)
  ⟕ NaverAdStat (기간 집계)                              ← UTM 불필요, 즉시 동작
  ⟕ VisitorSession groupBy utmTerm (period/site 필터)     ← UTM 태깅 후 동작
  ⟕ ClickEvent (phone_click / cta_click), 세션 경유
```
`normalizeKeyword(s) = s.replace(/\s+/g,'').toLowerCase()` 를 양쪽 동일 적용(기준은 Phase 1 스모크에서 실물 확인 후 확정).

파생 지표: `CTR=clicks/impressions`, `CPC=cost/clicks`, **`세션전환율=세션/clicks`** ← 클릭 100인데 세션 40이면 랜딩 이탈 or 부정클릭, `CPA=cost/전화클릭`, `황금지수=검색량/발행량`.

**검증**: ① `?utm_term=테스트키워드` 붙여 접속 → studio에서 `visitor_sessions.utm_term` 확인 ② `naver-sync-stats.mjs` 후 `naver_ad_stats` 행 생성 → 조인 탭 비용/클릭 컬럼이 UTM과 무관하게 채워짐 ③ 광고 클릭 며칠 태운 뒤 utm_term non-null 세션 증가 확인

**정직한 기대치**: 방문·체류 조인 컬럼이 의미 있어지려면 태깅 후 **1~2주** 데이터가 필요. 반면 `NaverAdStat`(노출/클릭/비용/평균순위)는 **첫날부터 100%** 채워지므로 툴은 즉시 쓸모 있다.

---

## 리스크 체크리스트

1. **`prisma migrate dev` 금지** — 이력 없어서 운영 Supabase reset을 제안할 수 있음. `db push`만, `--accept-data-loss` 없이
2. **estimate / stat-report 엔드포인트는 미확인** — 경로·메서드·body·비동기 여부 전부 공식문서 확인 후, 스모크로 200 받고 나서 코드화. stat-report가 job 폴링이면 라우트가 아니라 스크립트/크론
3. **검색광고 API 권한** — 대행사 위임 계정이면 메뉴 자체가 없음. Phase 0 최우선
4. **미들웨어 matcher** — `/api/analytics/*`, `/api/track` 포함 시 전 현장 추적 즉사
5. **엣지 런타임** — 미들웨어에서 bcrypt/`node:crypto` 불가. 쿠키 존재만 확인
6. **Vercel 타임아웃** — 대량 조회는 20개 청크 + AbortController
7. **`.mjs` env** — Prisma 미import 시 `.env` 자동로드 안 됨 → `node --env-file=.env` 표준화
8. **`X-Timestamp` ±5분** — 401 디버깅 시 체크
9. **`ac.search.naver.com` 비공식** — 구조 변경/차단 가능, 완전 격리
10. **비용 VAT 별도** — CPA 오해 소지, 컬럼 헤더에 명시

## 페이즈별 독립 가치 / 우선순위

| Phase | 단독 가치 |
|---|---|
| P1 | **CLI만으로 키워드 조사 가능** — UI 없어도 당장 씀 |
| P2 | 시계열 축적 시작 (빠를수록 데이터가 쌓임) |
| P3 | **보안 구멍 자체가 버그** — 키워드 툴과 무관하게 지금 고쳐야 함 |
| P4~P5 | 대시보드 |
| P6 | 차별화 지표 + 기존 '키워드 분석' 탭까지 같이 살아남 |

여유 없으면 **P0 → P1 → P3 → P2 → P4 → P5 → P6** 순.

---

## 지금 당장 할 일 (노트북 인계용)

이 문서를 tracker 레포에 커밋해서 노트북에서 이어받는다.

1. 이 계획서를 `D:\claude\부정클릭\tracker\docs\KEYWORD_TOOL_PLAN.md` 로 저장
2. **미커밋 상태인 분석 스크립트 8개**도 같이 커밋 (`all-sites-yesterday / block-ansan-fp / ip-history / yamok-dupe / yamok-dwell / yamok-keyword-fp / yamok-week / yamok-yesterday`.mjs — 전부 untracked였음)
3. `git push origin main`
4. 노트북에서 `git pull` → Phase 0(자격증명 발급)부터 시작

⚠️ `.env`는 `.gitignore` 대상이라 커밋 안 됨 → 노트북에서 `.env`를 따로 채워야 함.
