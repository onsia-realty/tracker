'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// ===========================================
// 타입 정의
// ===========================================

interface OverviewStats {
  realtime: {
    visitors: number;
    pageViews: number;
    timestamp: string;
  };
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
  recentFraudClicks: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    fraudScore: number;
    fraudReason: string;
    session: {
      fingerprint: string;
      ipAddress: string;
      deviceType: string;
      deviceVendor: string | null;
      deviceModel: string | null;
      browser: string;
      city: string;
    };
  }>;
}

interface LandingSite {
  id: string;
  name: string;
  slug: string;
}

// ===========================================
// 아이콘 컴포넌트 (Lucide 스타일 인라인 SVG)
// ===========================================

function IconUsers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconEye({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconShield({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function IconWallet({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function IconAlert({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconActivity({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

function IconBan({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function IconChevronRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconRefresh({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function IconGlobe({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconMonitor({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

// ===========================================
// 메인 컴포넌트
// ===========================================

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetch('/api/admin/sites')
      .then(res => res.json())
      .then(data => setSites(data))
      .catch(console.error);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const siteParam = selectedSite !== 'all' ? `&site=${selectedSite}` : '';
      const response = await fetch(`/api/analytics/stats?period=${period}&type=overview${siteParam}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError('통계를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedSite]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ef4444', '#a78bfa', '#34d399'];
  const FRAUD_COLORS = {
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
    low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin"></div>
          </div>
          <p className="text-sm text-slate-400 tracking-wide">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl max-w-md text-center">
          <IconAlert className="w-8 h-8 mx-auto mb-3" />
          <p className="font-medium">{error || '데이터를 불러올 수 없습니다.'}</p>
          <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const getFraudLevel = (score: number) => {
    if (score >= 100) return FRAUD_COLORS.critical;
    if (score >= 70) return FRAUD_COLORS.high;
    if (score >= 50) return FRAUD_COLORS.medium;
    return FRAUD_COLORS.low;
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ===== 헤더 영역 ===== */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              ONSIA <span className="text-indigo-400">Analytics</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* 사이트 선택 */}
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '36px' }}
            >
              <option value="all">전체 사이트</option>
              {sites.map((site) => (
                <option key={site.id} value={site.slug}>{site.name}</option>
              ))}
            </select>

            {/* 기간 선택 */}
            <div className="flex rounded-xl bg-[#1a1d27] border border-slate-700/50 p-1">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    period === p
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {p === 'today' ? '오늘' : p === 'week' ? '7일' : '30일'}
                </button>
              ))}
            </div>

            {/* 새로고침 */}
            <button
              onClick={fetchStats}
              className="p-2.5 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all"
              title="새로고침"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ===== 실시간 스트립 ===== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/90 via-indigo-500/80 to-violet-600/90 p-[1px]">
          <div className="relative rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-6 py-5">
            {/* 배경 패턴 */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }}></div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                    <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">실시간 방문자</p>
                    <p className="text-3xl font-extrabold text-white tabular-nums">{stats.realtime.visitors}<span className="text-lg font-normal text-indigo-200 ml-1">명</span></p>
                  </div>
                </div>

                <div className="w-px h-12 bg-white/20 hidden sm:block"></div>

                <div className="hidden sm:block">
                  <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">실시간 페이지뷰</p>
                  <p className="text-3xl font-extrabold text-white tabular-nums">{stats.realtime.pageViews}</p>
                </div>
              </div>

              <div className="text-right hidden md:block">
                <p className="text-xs text-indigo-200">최근 5분 기준</p>
                <p className="text-sm text-white/80 font-mono">{new Date().toLocaleTimeString('ko-KR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== KPI 카드 그리드 ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={<IconUsers className="w-5 h-5" />}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            title="총 방문자"
            value={stats.traffic.totalVisitors.toLocaleString()}
            unit="명"
            subItems={[
              { label: '신규', value: stats.traffic.newVisitors.toLocaleString() },
              { label: '재방문', value: stats.traffic.returningVisitors.toLocaleString() },
            ]}
          />
          <KPICard
            icon={<IconEye className="w-5 h-5" />}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/10"
            title="페이지뷰"
            value={stats.traffic.totalPageViews.toLocaleString()}
            unit="회"
            subItems={[
              { label: '평균 체류', value: formatTime(stats.traffic.avgDwellTime) },
              { label: '이탈률', value: `${stats.traffic.bounceRate}%` },
            ]}
          />
          <KPICard
            icon={<IconShield className="w-5 h-5" />}
            iconColor="text-red-400"
            iconBg="bg-red-500/10"
            title="부정클릭 차단"
            value={stats.fraud.fraudClicks.toLocaleString()}
            unit="건"
            alert={stats.fraud.fraudRate > 5}
            subItems={[
              { label: '차단율', value: `${stats.fraud.fraudRate}%`, alert: stats.fraud.fraudRate > 5 },
              { label: '의심', value: `${stats.fraud.suspiciousClicks}건` },
            ]}
          />
          <KPICard
            icon={<IconWallet className="w-5 h-5" />}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            title="절약된 광고비"
            value={`₩${stats.fraud.estimatedSavedCost.toLocaleString()}`}
            subItems={[
              { label: '블랙리스트', value: `${stats.fraud.blacklistCount}개` },
              { label: '차단 세션', value: `${stats.fraud.blockedSessions}개` },
            ]}
          />
        </div>

        {/* ===== 차트 영역 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 유입 경로 */}
          <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <IconGlobe className="w-4 h-4 text-slate-500" />
                <h3 className="text-base font-semibold text-white">유입 경로</h3>
              </div>
              <span className="text-xs text-slate-500">{period === 'today' ? '오늘' : period === 'week' ? '최근 7일' : '최근 30일'}</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.trafficSources} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
                <XAxis
                  dataKey="source"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#1e2130' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1d27',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                  }}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                  formatter={(value: number) => [`${value}건`, '방문']}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                >
                  {stats.trafficSources.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 디바이스 분포 */}
          <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <IconMonitor className="w-4 h-4 text-slate-500" />
                <h3 className="text-base font-semibold text-white">디바이스 분포</h3>
              </div>
            </div>
            {(() => {
              const formattedDevices = stats.devices.map(d => ({
                ...d,
                name: d.vendor && d.model && d.model !== 'Unknown'
                  ? (d.vendor === 'Apple' ? d.model : `${d.vendor} ${d.model}`)
                  : d.type || 'Unknown',
              }));
              const total = formattedDevices.reduce((acc, d) => acc + d.count, 0);

              return (
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={formattedDevices}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="name"
                          stroke="none"
                        >
                          {formattedDevices.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3 min-w-0">
                    {formattedDevices.slice(0, 5).map((device, index) => {
                      const pct = total > 0 ? ((device.count / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                          <span className="text-sm text-slate-300 truncate flex-1">{device.name}</span>
                          <span className="text-sm font-mono text-slate-400 tabular-nums">{pct}%</span>
                          <span className="text-xs text-slate-600 tabular-nums w-10 text-right">{device.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ===== 부정클릭 상세 & 요약 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 부정클릭 테이블 (2/3) */}
          <div className="lg:col-span-2 rounded-2xl bg-[#1a1d27] border border-slate-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <IconAlert className="w-4 h-4 text-red-400" />
                <h3 className="text-base font-semibold text-white">최근 부정클릭 감지</h3>
                {stats.recentFraudClicks.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium tabular-nums">
                    {stats.recentFraudClicks.length}건
                  </span>
                )}
              </div>
              <a
                href="/admin/analytics/fraud"
                className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                전체 보기 <IconChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                    <th className="px-6 py-3 font-medium">시간</th>
                    <th className="px-6 py-3 font-medium">IP 주소</th>
                    <th className="px-6 py-3 font-medium">디바이스</th>
                    <th className="px-6 py-3 font-medium">지역</th>
                    <th className="px-6 py-3 font-medium">위험도</th>
                    <th className="px-6 py-3 font-medium">사유</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {stats.recentFraudClicks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <IconShield className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-slate-300 font-medium">부정클릭이 감지되지 않았습니다</p>
                            <p className="text-slate-500 text-xs mt-1">현재 광고가 안전하게 보호되고 있습니다</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stats.recentFraudClicks.map((click) => {
                      const level = getFraudLevel(click.fraudScore);
                      return (
                        <tr
                          key={click.id}
                          className="border-b border-slate-800/30 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-3.5 text-slate-400 whitespace-nowrap tabular-nums">
                            {new Date(click.timestamp).toLocaleString('ko-KR', {
                              month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-6 py-3.5">
                            <code className="text-slate-300 bg-slate-800/50 px-2 py-0.5 rounded text-xs font-mono">
                              {click.session.ipAddress || '-'}
                            </code>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex flex-col">
                              <span className="text-slate-300 text-xs">
                                {click.session.deviceVendor && click.session.deviceModel && click.session.deviceModel !== 'Unknown'
                                  ? (click.session.deviceVendor === 'Apple'
                                    ? click.session.deviceModel
                                    : `${click.session.deviceVendor} ${click.session.deviceModel}`)
                                  : click.session.deviceType || 'Unknown'}
                              </span>
                              <span className="text-slate-600 text-xs">{click.session.browser}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-slate-400 text-xs">
                            {click.session.city || '-'}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border tabular-nums ${level.bg} ${level.text} ${level.border}`}>
                              {click.fraudScore}점
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 text-xs max-w-[200px] truncate">
                            {click.fraudReason || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 사이드 통계 패널 (1/3) */}
          <div className="space-y-4">
            {/* 부정클릭 비율 게이지 */}
            <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
              <h4 className="text-sm font-medium text-slate-400 mb-4">부정클릭 비율</h4>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1e2130" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke={stats.fraud.fraudRate > 10 ? '#ef4444' : stats.fraud.fraudRate > 5 ? '#f59e0b' : '#22c55e'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(stats.fraud.fraudRate / 100) * 314} 314`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white tabular-nums">{stats.fraud.fraudRate}%</span>
                    <span className="text-xs text-slate-500">차단율</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <p className="text-lg font-bold text-white tabular-nums">{stats.fraud.totalClicks}</p>
                  <p className="text-xs text-slate-500">전체 클릭</p>
                </div>
                <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                  <p className="text-lg font-bold text-red-400 tabular-nums">{stats.fraud.fraudClicks}</p>
                  <p className="text-xs text-slate-500">부정클릭</p>
                </div>
              </div>
            </div>

            {/* 빠른 액션 */}
            <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-6">
              <h4 className="text-sm font-medium text-slate-400 mb-4">빠른 액션</h4>
              <div className="space-y-2">
                <a
                  href="/admin/analytics/fraud"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <IconBan className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">부정클릭 상세</p>
                    <p className="text-xs text-slate-500">IP 분석 · 사유별 통계</p>
                  </div>
                  <IconChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </a>
                <a
                  href="/admin/analytics/fraud"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <IconShield className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">블랙리스트 관리</p>
                    <p className="text-xs text-slate-500">{stats.fraud.blacklistCount}개 등록됨</p>
                  </div>
                  <IconChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </a>
                <a
                  href="/admin/analytics/visitors"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <IconActivity className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">방문자 로그</p>
                    <p className="text-xs text-slate-500">세션 · 행동 분석</p>
                  </div>
                  <IconChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ===========================================
// KPI 카드 컴포넌트
// ===========================================

interface KPICardProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  value: string;
  unit?: string;
  alert?: boolean;
  subItems: Array<{ label: string; value: string; alert?: boolean }>;
}

function KPICard({ icon, iconColor, iconBg, title, value, unit, alert, subItems }: KPICardProps) {
  return (
    <div className={`rounded-2xl bg-[#1a1d27] border p-5 transition-all hover:border-slate-700/80 ${
      alert ? 'border-red-500/30 shadow-lg shadow-red-500/5' : 'border-slate-800/50'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        {alert && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
            주의
          </span>
        )}
      </div>

      <div className="mb-3">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-white tabular-nums leading-none">
          {value}
          {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
        </p>
      </div>

      <div className="flex items-center gap-4 pt-3 border-t border-slate-800/50">
        {subItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-600">{item.label}</span>
            <span className={`text-xs font-semibold tabular-nums ${item.alert ? 'text-red-400' : 'text-slate-300'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================
// 유틸리티
// ===========================================

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}분 ${remainingSeconds}초`;
}
