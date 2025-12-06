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
  devices: Array<{ type: string; count: number }>;
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
      browser: string;
      city: string;
    };
  }>;
}

// ===========================================
// 메인 컴포넌트
// ===========================================

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/analytics/stats?period=${period}&type=overview`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('통계를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();

    // 실시간 갱신 (30초)
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 차트 색상
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error || '데이터를 불러올 수 없습니다.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">분석 대시보드</h1>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'today' ? '오늘' : p === 'week' ? '이번 주' : '이번 달'}
            </button>
          ))}
        </div>
      </div>

      {/* 실시간 상태 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">실시간 방문자 (최근 5분)</p>
            <p className="text-4xl font-bold mt-1">{stats.realtime.visitors}명</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">실시간 페이지뷰</p>
            <p className="text-2xl font-semibold mt-1">{stats.realtime.pageViews}</p>
          </div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 방문자"
          value={stats.traffic.totalVisitors.toLocaleString()}
          subtitle={`신규 ${stats.traffic.newVisitors.toLocaleString()}명`}
          icon="👤"
        />
        <StatCard
          title="페이지뷰"
          value={stats.traffic.totalPageViews.toLocaleString()}
          subtitle={`평균 체류 ${formatTime(stats.traffic.avgDwellTime)}`}
          icon="📄"
        />
        <StatCard
          title="부정클릭 차단"
          value={stats.fraud.fraudClicks.toLocaleString()}
          subtitle={`차단율 ${stats.fraud.fraudRate}%`}
          icon="🛡️"
          highlight={stats.fraud.fraudRate > 5}
        />
        <StatCard
          title="절약된 광고비"
          value={`₩${stats.fraud.estimatedSavedCost.toLocaleString()}`}
          subtitle={`블랙리스트 ${stats.fraud.blacklistCount}개`}
          icon="💰"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 유입 경로 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">유입 경로</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.trafficSources}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="source" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 디바이스 분포 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">디바이스 분포</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.devices}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="count"
                nameKey="type"
                label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {stats.devices.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 최근 부정클릭 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">최근 부정클릭 감지</h3>
          <a
            href="/admin/analytics/fraud"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            전체 보기 →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">시간</th>
                <th className="pb-3 font-medium">IP</th>
                <th className="pb-3 font-medium">디바이스</th>
                <th className="pb-3 font-medium">위험도</th>
                <th className="pb-3 font-medium">사유</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.recentFraudClicks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    감지된 부정클릭이 없습니다.
                  </td>
                </tr>
              ) : (
                stats.recentFraudClicks.map((click) => (
                  <tr key={click.id} className="border-b last:border-0">
                    <td className="py-3 text-gray-600">
                      {new Date(click.timestamp).toLocaleString('ko-KR')}
                    </td>
                    <td className="py-3 font-mono text-gray-900">
                      {click.session.ipAddress || '-'}
                    </td>
                    <td className="py-3 text-gray-600">
                      {click.session.deviceType} / {click.session.browser}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          click.fraudScore >= 100
                            ? 'bg-red-100 text-red-800'
                            : click.fraudScore >= 70
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {click.fraudScore}점
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">
                      {click.fraudReason || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// 서브 컴포넌트
// ===========================================

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  highlight?: boolean;
}

function StatCard({ title, value, subtitle, icon, highlight }: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-6 ${
        highlight ? 'ring-2 ring-red-200' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <span className="text-3xl">{icon}</span>
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
