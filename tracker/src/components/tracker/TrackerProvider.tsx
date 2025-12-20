// components/tracker/TrackerProvider.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTracker } from '@/hooks/useTracker';

const TrackerContext = createContext<ReturnType<typeof useTracker> | null>(null);

export function TrackerProvider({
  children,
  siteId,
  debug,
  endpoint
}: {
  children: ReactNode;
  siteId: string;
  debug?: boolean;
  endpoint?: string;
}) {
  const tracker = useTracker({
    siteId,
    debug: debug ?? process.env.NODE_ENV === 'development',
    endpoint
  });

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
