'use client';

import { useEffect, useState } from 'react';

interface EventTypeStat {
  [key: string]: unknown;
  type?: string;
  source?: string;
  total?: number;
  count?: number;
  fraud?: number;
  fraudRate?: number;
}

interface TargetStat {
  [key: string]: unknown;
  text?: string;
  reason?: string;
  count?: number;
  fraudCount?: number;
}

interface ClickStats {
  eventTypes: EventTypeStat[];
  topTargets: TargetStat[];
}

interface ClickAnalysisTabProps {
  selectedSite: string;
  period: string;
}

export default function ClickAnalysisTab({ selectedSite, period }: ClickAnalysisTabProps) {
  const [data, setData] = useState<ClickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period, type: 'fraud' });
    if (selectedSite !== 'all') params.set('site', selectedSite);

    fetch(`/api/analytics/stats?${params}`)
      .then((res) => res.json())
      .then((stats) => {
        // 기존 fraud API에서 데이터를 클릭 분석 형태로 변환
        setData({
          eventTypes: stats.bySource || [],
          topTargets: stats.topReasons || [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedSite, period]);

  const eventTypeLabels: Record<string, string> = {
    ad_click: '광고 클릭',
    cta_click: 'CTA 클릭',
    phone_click: '전화 클릭',
    inquiry_submit: '문의 제출',
    external_link: '외부 링크',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 이벤트 타입별 분포 */}
      <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
        <h3 className="text-base font-semibold text-white mb-4">클릭 이벤트 타입</h3>
        <div className="space-y-3">
          {data?.eventTypes && data.eventTypes.length > 0 ? (
            data.eventTypes.map((et, i) => {
              const maxCount = Math.max(...data.eventTypes.map((e) => Number(e.total || e.count || 0)));
              const count = Number(et.total || et.count || 0);
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const label = (et.type && eventTypeLabels[et.type]) || String(et.source || et.type || '-');
              const fraud = Number(et.fraud || 0);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 tabular-nums">{count}건</span>
                      {fraud > 0 && (
                        <span className="text-xs text-red-400 tabular-nums">부정 {fraud}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-800/50 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-slate-500 text-sm py-8">클릭 데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 부정클릭 사유 분포 */}
      <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
        <h3 className="text-base font-semibold text-white mb-4">부정클릭 사유</h3>
        <div className="space-y-2">
          {data?.topTargets && data.topTargets.length > 0 ? (
            data.topTargets.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/30 last:border-0">
                <span className="text-sm text-slate-300 truncate max-w-[250px]">
                  {String(t.reason || t.text || '-')}
                </span>
                <span className="text-xs text-slate-400 tabular-nums ml-4 whitespace-nowrap">
                  {Number(t.count || 0)}건
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-500 text-sm py-8">부정클릭이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
