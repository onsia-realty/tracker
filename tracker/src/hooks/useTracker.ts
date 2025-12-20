// hooks/useTracker.ts
'use client';

import { useEffect, useRef } from 'react';
import OnsiaTracker from '@/lib/tracker';

interface UseTrackerOptions {
  siteId: string;
  debug?: boolean;
  endpoint?: string;
}

export function useTracker({ siteId, debug = false, endpoint }: UseTrackerOptions) {
  const trackerRef = useRef<OnsiaTracker | null>(null);

  useEffect(() => {
    // 클라이언트에서만 실행
    if (typeof window === 'undefined') return;

    const tracker = new OnsiaTracker({
      endpoint: endpoint || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      siteId,
      debug
    });

    tracker.init();
    trackerRef.current = tracker;

    return () => {
      // cleanup if needed
    };
  }, [siteId, debug, endpoint]);

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
