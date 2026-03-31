'use client';

import { useEffect, useState, useRef } from 'react';
import RiskBadge from './RiskBadge';

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => unknown;
        Marker: new (options: { map: unknown; position: unknown }) => unknown;
        CustomOverlay: new (options: { map: unknown; position: unknown; content: string; yAnchor: number }) => unknown;
      };
    };
  }
}

interface DetailData {
  id: string;
  fingerprint: string;
  ipAddress: string | null;
  deviceType: string | null;
  deviceVendor: string | null;
  deviceModel: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  country: string | null;
  city: string | null;
  isp: string | null;
  latitude: number | null;
  longitude: number | null;
  isVpn: boolean;
  isProxy: boolean;
  referrer: string | null;
  utmSource: string | null;
  riskScore: number;
  isBlocked: boolean;
  blockReason: string | null;
  visitCount: number;
  totalDwellTime: number;
  pageViews: Array<{
    id: string;
    path: string;
    fullUrl: string | null;
    title: string | null;
    enterTime: string;
    dwellTime: number | null;
    scrollDepth: number | null;
  }>;
  clickEvents: Array<{
    id: string;
    eventType: string;
    targetText: string | null;
    timestamp: string;
    isFraud: boolean;
    fraudScore: number;
    fraudReason: string | null;
    adKeyword: string | null;
  }>;
  sameIpSessions: Array<{
    id: string;
    fingerprint: string;
    lastVisit: string;
    riskScore: number;
    isBlocked: boolean;
    deviceType: string | null;
    browser: string | null;
    _count: { pageViews: number };
  }>;
  blacklistEntry: {
    id: string;
    reason: string;
    createdAt: string;
    expiresAt: string | null;
  } | null;
}

interface VisitorDetailPanelProps {
  sessionId: string;
}

const KAKAO_APP_KEY = '99928cf1f21dbccb73c00344b2bd66d3';

function KakaoMap({ latitude, longitude, city }: { latitude: number; longitude: number; city: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<boolean>(false);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    const loadMap = () => {
      if (!mapRef.current || !window.kakao?.maps) return;
      mapInstanceRef.current = true;

      window.kakao.maps.load(() => {
        const position = new window.kakao.maps.LatLng(latitude, longitude);
        const map = new window.kakao.maps.Map(mapRef.current!, {
          center: position,
          level: 5,
        });
        new window.kakao.maps.Marker({ map, position });
        if (city) {
          new window.kakao.maps.CustomOverlay({
            map,
            position,
            content: `<div style="padding:4px 8px;background:#1a1d27;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:11px;font-weight:600;white-space:nowrap;">${city}</div>`,
            yAnchor: 2.5,
          });
        }
      });
    };

    // 카카오맵 SDK 로드
    if (window.kakao?.maps) {
      loadMap();
    } else {
      const script = document.createElement('script');
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
      script.onload = loadMap;
      document.head.appendChild(script);
    }
  }, [latitude, longitude, city]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/30">
      <div ref={mapRef} style={{ width: '100%', height: '200px' }} />
      <div className="bg-slate-800/40 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">* 오차범위 0.5~1km (IP 기반 추정)</span>
        <span className="text-[10px] text-slate-400 tabular-nums">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
      </div>
    </div>
  );
}

export default function VisitorDetailPanel({ sessionId }: VisitorDetailPanelProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pages' | 'clicks' | 'sameIp'>('pages');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/visitors/${sessionId}`)
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}초`;
    return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  };

  return (
    <div className="bg-[#1e2130] border-t border-slate-700/30 p-5 space-y-4">
      {/* 상단 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">핑거프린트</p>
          <code className="text-xs text-slate-300 font-mono break-all">{data.fingerprint.slice(0, 16)}...</code>
        </div>
        <div className="bg-slate-800/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">ISP</p>
          <p className="text-xs text-slate-300">{data.isp || '-'}</p>
          {(data.isVpn || data.isProxy) && (
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-400">
              {data.isVpn ? 'VPN' : 'Proxy'}
            </span>
          )}
        </div>
        <div className="bg-slate-800/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">방문 횟수</p>
          <p className="text-xs text-slate-300">{data.visitCount}회 · {formatTime(data.totalDwellTime)}</p>
        </div>
        <div className="bg-slate-800/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">차단 상태</p>
          {data.blacklistEntry ? (
            <div>
              <p className="text-xs text-red-400">{data.blacklistEntry.reason}</p>
              <p className="text-[10px] text-slate-500">
                {data.blacklistEntry.expiresAt
                  ? `만료: ${new Date(data.blacklistEntry.expiresAt).toLocaleDateString('ko-KR')}`
                  : '영구 차단'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-emerald-400">차단 없음</p>
          )}
        </div>
      </div>

      {/* 위치 지도 */}
      {data.latitude && data.longitude && (
        <KakaoMap latitude={data.latitude} longitude={data.longitude} city={data.city} />
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-slate-700/30">
        {[
          { key: 'pages' as const, label: `페이지뷰 (${data.pageViews.length})` },
          { key: 'clicks' as const, label: `클릭 이벤트 (${data.clickEvents.length})` },
          { key: 'sameIp' as const, label: `같은 IP (${data.sameIpSessions.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              tab === t.key
                ? 'text-indigo-400 border-indigo-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="max-h-[300px] overflow-y-auto">
        {tab === 'pages' && (
          <div className="space-y-1">
            {data.pageViews.map((pv) => (
              <div key={pv.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/30 text-xs">
                <span className="text-slate-500 tabular-nums whitespace-nowrap">
                  {new Date(pv.enterTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-slate-300 truncate flex-1" title={pv.fullUrl || pv.path}>
                  {pv.path}
                </span>
                {pv.dwellTime != null && (
                  <span className="text-slate-500 tabular-nums">{formatTime(pv.dwellTime)}</span>
                )}
                {pv.scrollDepth != null && (
                  <span className="text-slate-600 tabular-nums">{pv.scrollDepth}%</span>
                )}
              </div>
            ))}
            {data.pageViews.length === 0 && (
              <p className="text-center text-slate-500 text-xs py-4">페이지뷰 기록 없음</p>
            )}
          </div>
        )}

        {tab === 'clicks' && (
          <div className="space-y-1">
            {data.clickEvents.map((ce) => (
              <div key={ce.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg text-xs ${ce.isFraud ? 'bg-red-500/5' : 'hover:bg-slate-800/30'}`}>
                <span className="text-slate-500 tabular-nums whitespace-nowrap">
                  {new Date(ce.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  ce.eventType === 'ad_click' ? 'bg-purple-500/10 text-purple-400' :
                  ce.eventType === 'phone_click' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-slate-700/50 text-slate-400'
                }`}>
                  {ce.eventType}
                </span>
                <span className="text-slate-300 truncate flex-1">{ce.targetText || '-'}</span>
                {ce.adKeyword && <span className="text-indigo-400">&quot;{ce.adKeyword}&quot;</span>}
                <RiskBadge score={ce.fraudScore} size="sm" />
              </div>
            ))}
            {data.clickEvents.length === 0 && (
              <p className="text-center text-slate-500 text-xs py-4">클릭 이벤트 없음</p>
            )}
          </div>
        )}

        {tab === 'sameIp' && (
          <div className="space-y-1">
            {data.sameIpSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/30 text-xs">
                <code className="text-slate-400 font-mono">{s.fingerprint.slice(0, 12)}...</code>
                <span className="text-slate-500">{s.deviceType} · {s.browser}</span>
                <span className="text-slate-500 tabular-nums">{s._count.pageViews}페이지</span>
                <span className="text-slate-500 tabular-nums">
                  {new Date(s.lastVisit).toLocaleDateString('ko-KR')}
                </span>
                <RiskBadge score={s.riskScore} isBlocked={s.isBlocked} size="sm" />
              </div>
            ))}
            {data.sameIpSessions.length === 0 && (
              <p className="text-center text-slate-500 text-xs py-4">같은 IP의 다른 세션 없음</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
