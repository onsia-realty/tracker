'use client';

import { useEffect, useState, useCallback } from 'react';

// ===========================================
// 타입 정의
// ===========================================

interface TrafficStats {
  summary: {
    totalVisitors: number;
    newVisitors: number;
    returningVisitors: number;
    totalPageViews: number;
    avgDwellTime: number;
    bounceRate: number;
  };
  trafficSources: Array<{ source: string; count: number }>;
  devices: Array<{ type: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  regions: Array<{ city: string; count: number }>;
}

interface RealtimeData {
  realtime: {
    visitors: number;
    pageViews: number;
  };
  recentVisitors: Array<{
    id: string;
    ipAddress: string | null;
    deviceType: string;
    deviceVendor: string | null;
    deviceModel: string | null;
    browser: string;
    browserVersion: string | null;
    os: string;
    osVersion: string | null;
    city: string;
    country: string;
    referrer: string;
    utmSource: string;
    lastVisit: string;
    riskScore: number;
    isBlocked: boolean;
    landingSite: {
      name: string;
      slug: string;
    } | null;
  }>;
}

// ===========================================
// 메인 컴포넌트
// ===========================================

interface LandingSite {
  id: string;
  name: string;
  slug: string;
}

export default function VisitorsPage() {
  const [traffic, setTraffic] = useState<TrafficStats | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');

  // 사이트 목록 로드
  useEffect(() => {
    fetch('/api/admin/sites')
      .then(res => res.json())
      .then(data => setSites(data))
      .catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const siteParam = selectedSite !== 'all' ? `&site=${selectedSite}` : '';
      const [trafficRes, realtimeRes] = await Promise.all([
        fetch(`/api/analytics/stats?period=${period}&type=traffic${siteParam}`),
        fetch(`/api/analytics/stats?type=realtime${siteParam}`),
      ]);

      if (trafficRes.ok) setTraffic(await trafficRes.json());
      if (realtimeRes.ok) setRealtime(await realtimeRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedSite]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      {/* 헤더 */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">방문자 분석</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">실시간 방문자 현황 및 트래픽 분석</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* 사이트 선택 */}
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 transition"
          >
            <option value="all">전체 사이트</option>
            {sites.map((site) => (
              <option key={site.id} value={site.slug}>
                {site.name}
              </option>
            ))}
          </select>

          {/* 기간 선택 */}
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {p === 'today' ? '오늘' : p === 'week' ? '이번 주' : '이번 달'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 실시간 + 요약 */}
      {traffic && realtime && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 md:p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs md:text-sm">실시간 방문자</p>
                  <p className="text-2xl md:text-3xl font-bold mt-1">
                    {realtime.realtime.visitors}
                  </p>
                </div>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500">총 방문자</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                {traffic.summary.totalVisitors.toLocaleString()}
              </p>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                신규 {traffic.summary.newVisitors.toLocaleString()} / 재방문{' '}
                {traffic.summary.returningVisitors.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500">페이지뷰</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                {traffic.summary.totalPageViews.toLocaleString()}
              </p>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                평균{' '}
                {(
                  traffic.summary.totalPageViews / traffic.summary.totalVisitors || 0
                ).toFixed(1)}
                페이지/방문
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500">평균 체류시간</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                {formatTime(traffic.summary.avgDwellTime)}
              </p>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                이탈률 {traffic.summary.bounceRate}%
              </p>
            </div>
          </div>

          {/* 상세 분석 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* 유입 경로 */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">유입 경로</h3>
              <div className="space-y-3">
                {traffic.trafficSources.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">데이터가 없습니다.</p>
                ) : (
                  traffic.trafficSources.map((item, index) => {
                    const total = traffic.trafficSources.reduce(
                      (sum, s) => sum + s.count,
                      0
                    );
                    const percent = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            {getSourceLabel(item.source)}
                          </span>
                          <span className="text-gray-500">
                            {item.count.toLocaleString()} ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 지역별 */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">지역별 방문자</h3>
              <div className="space-y-2">
                {traffic.regions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">데이터가 없습니다.</p>
                ) : (
                  traffic.regions.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <span className="text-gray-700">{item.city || '알 수 없음'}</span>
                      <span className="font-medium text-gray-900">
                        {item.count.toLocaleString()}명
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 디바이스 */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">디바이스</h3>
              <div className="grid grid-cols-3 gap-4">
                {traffic.devices.map((device, index) => {
                  const total = traffic.devices.reduce((sum, d) => sum + d.count, 0);
                  const percent = total > 0 ? (device.count / total) * 100 : 0;
                  const icon =
                    device.type === 'mobile'
                      ? '📱'
                      : device.type === 'desktop'
                      ? '🖥️'
                      : '📱';
                  return (
                    <div
                      key={index}
                      className="text-center p-4 bg-gray-50 rounded-lg"
                    >
                      <span className="text-3xl">{icon}</span>
                      <p className="text-sm text-gray-500 mt-2 capitalize">
                        {device.type || 'unknown'}
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {percent.toFixed(0)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 브라우저 */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">브라우저</h3>
              <div className="space-y-2">
                {traffic.browsers.map((browser, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-gray-700">{browser.name || '알 수 없음'}</span>
                    <span className="font-medium text-gray-900">
                      {browser.count.toLocaleString()}명
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 최근 방문자 */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">최근 방문자</h3>

            {/* 데스크톱 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">방문 시간</th>
                    <th className="pb-3 font-medium">사이트</th>
                    <th className="pb-3 font-medium">IP 주소</th>
                    <th className="pb-3 font-medium">기기 정보</th>
                    <th className="pb-3 font-medium">지역</th>
                    <th className="pb-3 font-medium">유입 경로</th>
                    <th className="pb-3 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {realtime.recentVisitors.map((visitor) => (
                    <tr key={visitor.id} className="border-b last:border-0">
                      <td className="py-3 text-gray-600">
                        {new Date(visitor.lastVisit).toLocaleString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {visitor.landingSite?.name || '미분류'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600 font-mono text-xs">
                        {visitor.ipAddress || '-'}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="text-gray-900 font-medium">
                            {formatDeviceName(visitor)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {visitor.browser || 'Unknown'}
                            {visitor.browserVersion && ` ${visitor.browserVersion.split('.')[0]}`}
                            {' · '}
                            {visitor.os || 'Unknown'}
                            {visitor.osVersion && ` ${visitor.osVersion.split('.')[0]}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-gray-700">
                        {visitor.city || visitor.country || '-'}
                      </td>
                      <td className="py-3 text-gray-700">
                        {getSourceLabel(visitor.utmSource)}
                      </td>
                      <td className="py-3">
                        {visitor.isBlocked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            차단됨
                          </span>
                        ) : visitor.riskScore >= 70 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            의심 {visitor.riskScore}점
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            정상
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className="md:hidden space-y-3">
              {realtime.recentVisitors.map((visitor) => (
                <div key={visitor.id} className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {new Date(visitor.lastVisit).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {visitor.isBlocked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        차단됨
                      </span>
                    ) : visitor.riskScore >= 70 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        의심 {visitor.riskScore}점
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        정상
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">
                      {formatDeviceName(visitor)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {visitor.landingSite?.name || '미분류'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      {visitor.browser || 'Unknown'}
                      {visitor.browserVersion && ` ${visitor.browserVersion.split('.')[0]}`}
                      {' · '}
                      {visitor.os || 'Unknown'}
                      {visitor.osVersion && ` ${visitor.osVersion.split('.')[0]}`}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>📍 {visitor.city || visitor.country || '-'}</span>
                      <span className="font-mono">{visitor.ipAddress || '-'}</span>
                    </div>
                    <div>🔗 {getSourceLabel(visitor.utmSource)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
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
  if (minutes < 60) return `${minutes}분 ${remainingSeconds}초`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 ${minutes % 60}분`;
}

function getSourceLabel(source: string | null): string {
  if (!source) return '직접 방문';
  const labels: Record<string, string> = {
    naver: '네이버 광고',
    google: '구글 광고',
    daum: '다음',
    kakao: '카카오',
    facebook: '페이스북',
    instagram: '인스타그램',
    direct: '직접 방문',
  };
  return labels[source.toLowerCase()] || source;
}

function formatDeviceName(visitor: RealtimeData['recentVisitors'][0]): string {
  // 기종 정보가 있으면 표시
  if (visitor.deviceModel && visitor.deviceModel !== 'Unknown') {
    // Apple 기기는 벤더 생략
    if (visitor.deviceVendor === 'Apple') {
      return visitor.deviceModel; // "iPhone 14 Pro"
    }
    // 기타 기기는 벤더 + 모델
    return `${visitor.deviceVendor || ''} ${visitor.deviceModel}`.trim();
  }

  // 기종 정보가 없으면 디바이스 타입으로 표시
  const deviceIcons: Record<string, string> = {
    mobile: '📱 Mobile',
    tablet: '📱 Tablet',
    desktop: '🖥️ Desktop',
  };
  return deviceIcons[visitor.deviceType] || visitor.deviceType;
}
