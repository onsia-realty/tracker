'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface OverviewStats {
  realtime: { visitors: number; pageViews: number };
  traffic: {
    totalVisitors: number;
    newVisitors: number;
    returningVisitors: number;
    totalPageViews: number;
    avgDwellTime: number;
    bounceRate: number;
  };
  fraud: {
    totalClicks: number;
    fraudClicks: number;
    suspiciousClicks: number;
    fraudRate: number;
    blockedSessions: number;
    blacklistCount: number;
    estimatedSavedCost: number;
  };
  trafficSources: Array<{ source: string; count: number }>;
  devices: Array<{ type: string; vendor: string | null; model: string | null; count: number }>;
}

const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ef4444', '#a78bfa', '#34d399'];

interface OverviewTabProps {
  selectedSite: string;
  period: 'today' | 'week' | 'month';
}

export default function OverviewTab({ selectedSite, period }: OverviewTabProps) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const siteParam = selectedSite !== 'all' ? `&site=${selectedSite}` : '';
      const res = await fetch(`/api/analytics/stats?period=${period}&type=overview${siteParam}`);
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSite, period]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}초`;
    return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 실시간 스트립 */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-emerald-400 rounded-full" />
                <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-75" />
              </div>
              <div>
                <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">실시간 방문자</p>
                <p className="text-3xl font-extrabold text-white tabular-nums">
                  {stats.realtime.visitors}<span className="text-lg font-normal text-indigo-200 ml-1">명</span>
                </p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/20 hidden sm:block" />
            <div className="hidden sm:block">
              <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">실시간 페이지뷰</p>
              <p className="text-3xl font-extrabold text-white tabular-nums">{stats.realtime.pageViews}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="총 방문자" value={stats.traffic.totalVisitors.toLocaleString()} unit="명"
          sub={[{ l: '신규', v: String(stats.traffic.newVisitors) }, { l: '재방문', v: String(stats.traffic.returningVisitors) }]} />
        <KPICard title="페이지뷰" value={stats.traffic.totalPageViews.toLocaleString()} unit="회"
          sub={[{ l: '평균 체류', v: formatTime(stats.traffic.avgDwellTime) }, { l: '이탈률', v: `${stats.traffic.bounceRate}%` }]} />
        <KPICard title="부정클릭 차단" value={String(stats.fraud.fraudClicks)} unit="건"
          alert={stats.fraud.fraudRate > 5}
          sub={[{ l: '차단율', v: `${stats.fraud.fraudRate}%` }, { l: '의심', v: `${stats.fraud.suspiciousClicks}건` }]} />
        <KPICard title="절약된 광고비" value={`₩${stats.fraud.estimatedSavedCost.toLocaleString()}`}
          sub={[{ l: '블랙리스트', v: `${stats.fraud.blacklistCount}개` }, { l: '차단 세션', v: `${stats.fraud.blockedSessions}개` }]} />
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 유입 경로 */}
        <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
          <h3 className="text-base font-semibold text-white mb-6">유입 경로</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.trafficSources} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
              <XAxis dataKey="source" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#1e2130' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0', fontSize: '13px' }}
                formatter={(value: number) => [`${value}건`, '방문']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {stats.trafficSources.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 디바이스 분포 */}
        <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
          <h3 className="text-base font-semibold text-white mb-6">디바이스 분포</h3>
          {(() => {
            const devices = stats.devices.map((d) => ({
              ...d,
              name: d.vendor && d.model && d.model !== 'Unknown'
                ? (d.vendor === 'Apple' ? d.model : `${d.vendor} ${d.model}`)
                : d.type || 'Unknown',
            }));
            const total = devices.reduce((acc, d) => acc + d.count, 0);

            return (
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={devices} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        paddingAngle={3} dataKey="count" nameKey="name" stroke="none">
                        {devices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  {devices.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-sm text-slate-300 truncate flex-1">{d.name}</span>
                      <span className="text-sm font-mono text-slate-400 tabular-nums">
                        {total > 0 ? ((d.count / total) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 부정클릭 비율 게이지 */}
      <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6 max-w-xs mx-auto">
        <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">부정클릭 비율</h4>
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#1e2130" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none"
                stroke={stats.fraud.fraudRate > 10 ? '#ef4444' : stats.fraud.fraudRate > 5 ? '#f59e0b' : '#22c55e'}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(stats.fraud.fraudRate / 100) * 314} 314`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white tabular-nums">{stats.fraud.fraudRate}%</span>
              <span className="text-xs text-slate-500">차단율</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, unit, alert, sub }: {
  title: string; value: string; unit?: string; alert?: boolean;
  sub: Array<{ l: string; v: string }>;
}) {
  return (
    <div className={`rounded-2xl bg-[#1a1d27] border p-5 ${alert ? 'border-red-500/30' : 'border-slate-800/50'}`}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-bold text-white tabular-nums leading-none mb-3">
        {value}{unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
      </p>
      <div className="flex items-center gap-4 pt-3 border-t border-slate-800/50">
        {sub.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-600">{s.l}</span>
            <span className="text-xs font-semibold text-slate-300 tabular-nums">{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
