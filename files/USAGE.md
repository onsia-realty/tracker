# ONSIA Tracker SDK 사용 가이드

## 1. 기본 HTML 사이트에서 사용

```html
<!DOCTYPE html>
<html>
<head>
  <title>분양현장 랜딩페이지</title>
</head>
<body>
  <h1>힐스테이트 XX</h1>
  
  <button class="cta-button" onclick="requestConsultation()">
    상담 신청하기
  </button>
  
  <a href="tel:010-1234-5678" class="phone-button">
    전화 상담
  </a>

  <!-- 추적 SDK 삽입 (페이지 하단) -->
  <script src="https://tracking.onsia.city/sdk/tracker.min.js"></script>
  <script>
    // 트래커 초기화
    const tracker = new OnsiaTracker({
      endpoint: 'https://tracking.onsia.city',
      siteId: 'hillstate-yongin',  // 분양현장 식별자
      debug: true  // 개발 시 true, 운영 시 false
    });
    
    tracker.init();
    
    // 글로벌 접근용
    window.onsiaTracker = tracker;
    
    // 전환 이벤트 예시
    function requestConsultation() {
      tracker.trackConversion('consultation_request');
      // 실제 상담 신청 로직...
    }
  </script>
</body>
</html>
```

---

## 2. Next.js/React에서 사용

### 2-1. SDK 패키지 설치 구조

```
packages/
  tracker-sdk/
    src/
      index.ts      # 메인 export
      tracker.ts    # 트래커 클래스
    package.json
    tsconfig.json
```

### 2-2. React Hook으로 래핑

```tsx
// hooks/useTracker.ts
'use client';

import { useEffect, useRef } from 'react';
import OnsiaTracker from '@onsia/tracker-sdk';

interface UseTrackerOptions {
  siteId: string;
  debug?: boolean;
}

export function useTracker({ siteId, debug = false }: UseTrackerOptions) {
  const trackerRef = useRef<OnsiaTracker | null>(null);

  useEffect(() => {
    // 클라이언트에서만 실행
    if (typeof window === 'undefined') return;

    const tracker = new OnsiaTracker({
      endpoint: process.env.NEXT_PUBLIC_TRACKER_ENDPOINT || 'https://tracking.onsia.city',
      siteId,
      debug
    });

    tracker.init();
    trackerRef.current = tracker;

    return () => {
      // cleanup if needed
    };
  }, [siteId, debug]);

  return {
    track: (eventName: string, properties?: Record<string, any>) => {
      trackerRef.current?.track(eventName, properties);
    },
    trackConversion: (type: string, value?: number) => {
      trackerRef.current?.trackConversion(type, value);
    },
    getStats: () => trackerRef.current?.getCurrentStats()
  };
}
```

### 2-3. Layout에서 전역 초기화

```tsx
// app/layout.tsx
import { TrackerProvider } from '@/components/TrackerProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <TrackerProvider siteId="hillstate-yongin">
          {children}
        </TrackerProvider>
      </body>
    </html>
  );
}
```

```tsx
// components/TrackerProvider.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTracker } from '@/hooks/useTracker';

const TrackerContext = createContext<ReturnType<typeof useTracker> | null>(null);

export function TrackerProvider({ 
  children, 
  siteId 
}: { 
  children: ReactNode; 
  siteId: string;
}) {
  const tracker = useTracker({ siteId, debug: process.env.NODE_ENV === 'development' });

  return (
    <TrackerContext.Provider value={tracker}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTrackerContext() {
  const context = useContext(TrackerContext);
  if (!context) throw new Error('useTrackerContext must be within TrackerProvider');
  return context;
}
```

### 2-4. 컴포넌트에서 사용

```tsx
// components/ConsultationForm.tsx
'use client';

import { useTrackerContext } from './TrackerProvider';

export function ConsultationForm() {
  const { trackConversion, track } = useTrackerContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 전환 이벤트 기록
    trackConversion('form_submit');
    
    // 실제 폼 제출 로직...
  };

  const handlePhoneClick = () => {
    track('phone_click', { phone: '010-1234-5678' });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" placeholder="이름" required />
      <input type="tel" name="phone" placeholder="연락처" required />
      
      <button type="submit" className="cta">
        상담 신청
      </button>
      
      <a href="tel:010-1234-5678" onClick={handlePhoneClick}>
        📞 전화 상담
      </a>
    </form>
  );
}
```

---

## 3. 추적되는 데이터

### 자동 수집 (설정만 하면 됨)
| 데이터 | 설명 |
|--------|------|
| 체류시간 | 페이지 진입~이탈 시간 (탭 비활성 시간 제외) |
| 스크롤 깊이 | 최대 스크롤 %, 25/50/75/100 마일스톤 |
| 마우스 움직임 | 이동 횟수 (봇 탐지용) |
| 클릭 이벤트 | 위치, 대상 요소, 분류(CTA/전화/광고) |
| 핑거프린트 | IP 변경/쿠키 삭제해도 추적 |
| UTM 파라미터 | 광고 캠페인 유입 분석 |
| 디바이스 정보 | 브라우저, OS, 기기 타입 |

### 수동 호출
```js
// 커스텀 이벤트
tracker.track('gallery_view', { imageIndex: 3 });

// 전환 이벤트
tracker.trackConversion('consultation_complete', 0); // value는 선택

// 현재 상태 확인 (디버깅용)
console.log(tracker.getCurrentStats());
```

---

## 4. 디버그 모드

개발 환경에서 `debug: true` 설정하면 콘솔에 모든 이벤트 로그 출력:

```
[ONSIA Tracker] Tracker initialized { fingerprint: "fp_a8c9d2e4..." }
[ONSIA Tracker] Event: pageview_start { pageviewId: "xxxx-xxxx", path: "/" }
[ONSIA Tracker] Scroll milestone: 25%
[ONSIA Tracker] Click tracked { target: "button.cta", eventType: "cta_click" }
[ONSIA Tracker] Event: heartbeat { dwellTime: 15, maxScrollDepth: 50 }
```

---

## 5. 대시보드에서 확인할 수 있는 것

| 지표 | 용도 |
|------|------|
| **평균 체류시간** | 페이지 품질, 관심도 측정 |
| **스크롤 깊이 분포** | 콘텐츠 어디까지 보는지 |
| **클릭 히트맵** | 어디를 많이 클릭하는지 |
| **전환율** | 방문자 중 상담신청 비율 |
| **유입 경로별 성과** | 네이버 vs 구글 광고 ROI |
| **부정클릭 로그** | 의심스러운 클릭 패턴 |
| **현장별 비교** | 50개 분양현장 성과 비교 |

---

## 6. 주의사항

### 개인정보보호
- 핑거프린트는 해시값만 저장 (원본 복원 불가)
- 90일 후 자동 삭제
- 개인정보처리방침에 명시 필요

### 성능
- SDK 용량: ~15KB (gzip)
- API 호출: 5초마다 heartbeat + 이탈 시 beacon
- 서버 부하: 무료 플랜(Vercel+Neon)으로 충분

### CORS
- API 서버에서 랜딩페이지 도메인 허용 필요
- 위 api-route.ts의 OPTIONS 핸들러 참고
