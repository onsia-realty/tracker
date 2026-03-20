'use client';

import { useEffect, useState, useCallback } from 'react';

// ===========================================
// 타입 정의
// ===========================================

interface FraudStats {
  summary: {
    totalClicks: number;
    fraudClicks: number;
    suspiciousClicks: number;
    fraudRate: number;
    blockedSessions: number;
    blacklistCount: number;
    estimatedSavedCost: number;
  };
  fraudReasons: Array<{ reason: string; count: number }>;
  fraudBySource: Array<{ source: string; count: number }>;
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
  suspiciousIPs: Array<{
    ipAddress: string;
    fraudClickCount: number;
    lastDetected: string;
    maxFraudScore: number;
    riskScore: number;
    deviceInfo: string;
    browser: string;
  }>;
}

interface LandingSite {
  id: string;
  name: string;
  slug: string;
}

// ===========================================
// 메인 컴포넌트
// ===========================================

export default function FraudPage() {
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');

  useEffect(() => {
    fetch('/api/admin/sites')
      .then(res => res.json())
      .then(data => setSites(data))
      .catch(console.error);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const siteParam = selectedSite !== 'all' ? `&site=${selectedSite}` : '';
      const response = await fetch(`/api/analytics/stats?period=${period}&type=fraud${siteParam}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setStats(data);
    } catch (err) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-red-600">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">부정클릭 탐지</h1>
          <p className="text-gray-500 mt-1">
            실시간 부정클릭 모니터링 및 차단 현황
          </p>
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
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">총 클릭</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {stats.summary.totalClicks.toLocaleString()}
          </p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-sm p-6 ring-2 ring-red-200">
          <p className="text-sm text-red-600">부정클릭 차단</p>
          <p className="text-3xl font-bold text-red-700 mt-1">
            {stats.summary.fraudClicks.toLocaleString()}
          </p>
          <p className="text-sm text-red-500 mt-1">
            차단율 {stats.summary.fraudRate}%
          </p>
        </div>
        <div className="bg-orange-50 rounded-xl shadow-sm p-6">
          <p className="text-sm text-orange-600">의심 클릭</p>
          <p className="text-3xl font-bold text-orange-700 mt-1">
            {stats.summary.suspiciousClicks.toLocaleString()}
          </p>
          <p className="text-sm text-orange-500 mt-1">70~99점 위험도</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-sm p-6">
          <p className="text-sm text-green-600">절약된 광고비</p>
          <p className="text-3xl font-bold text-green-700 mt-1">
            ₩{stats.summary.estimatedSavedCost.toLocaleString()}
          </p>
          <p className="text-sm text-green-500 mt-1">예상 절감액</p>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 부정클릭 사유 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            차단 사유별 현황
          </h3>
          <div className="space-y-3">
            {stats.fraudReasons.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">데이터가 없습니다.</p>
            ) : (
              stats.fraudReasons.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700 text-sm">{item.reason}</span>
                  <span className="font-semibold text-gray-900">{item.count}건</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 광고 소스별 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            광고 소스별 부정클릭
          </h3>
          <div className="space-y-3">
            {stats.fraudBySource.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">데이터가 없습니다.</p>
            ) : (
              stats.fraudBySource.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        item.source === 'naver'
                          ? 'bg-green-500'
                          : item.source === 'google'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}
                    ></span>
                    <span className="text-gray-700">
                      {item.source === 'naver'
                        ? '네이버 광고'
                        : item.source === 'google'
                        ? '구글 광고'
                        : item.source || '직접 유입'}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.count}건</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 부정클릭 로그 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">부정클릭 상세 로그</h3>
          <div className="flex gap-2">
            <span className="text-sm text-gray-500">
              블랙리스트: {stats.summary.blacklistCount}개
            </span>
            <span className="text-sm text-gray-500">
              차단 세션: {stats.summary.blockedSessions}개
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">시간</th>
                <th className="pb-3 font-medium">IP 주소</th>
                <th className="pb-3 font-medium">핑거프린트</th>
                <th className="pb-3 font-medium">디바이스</th>
                <th className="pb-3 font-medium">지역</th>
                <th className="pb-3 font-medium">위험도</th>
                <th className="pb-3 font-medium">차단 사유</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.recentFraudClicks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    🎉 부정클릭이 감지되지 않았습니다.
                  </td>
                </tr>
              ) : (
                stats.recentFraudClicks.map((click) => (
                  <tr key={click.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-4 text-gray-600">
                      {new Date(click.timestamp).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 font-mono text-gray-900">
                      {click.session.ipAddress || '-'}
                    </td>
                    <td className="py-4 font-mono text-gray-500">
                      {click.session.fingerprint}
                    </td>
                    <td className="py-4 text-gray-600">
                      <div className="flex flex-col">
                        <span className="text-gray-900">
                          {click.session.deviceVendor && click.session.deviceModel && click.session.deviceModel !== 'Unknown'
                            ? (click.session.deviceVendor === 'Apple'
                              ? click.session.deviceModel
                              : `${click.session.deviceVendor} ${click.session.deviceModel}`)
                            : click.session.deviceType || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400">{click.session.browser}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-600">
                      {click.session.city || '-'}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
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
                    <td className="py-4 text-gray-600 max-w-xs">
                      <div className="truncate" title={click.fraudReason}>
                        {click.fraudReason || '-'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 부정클릭 의심 IP 목록 */}
      {stats.suspiciousIPs && stats.suspiciousIPs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            부정클릭 의심 IP 목록
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">IP 주소</th>
                  <th className="pb-3 font-medium">부정클릭 횟수</th>
                  <th className="pb-3 font-medium">최근 감지</th>
                  <th className="pb-3 font-medium">최고 위험도</th>
                  <th className="pb-3 font-medium">리스크 점수</th>
                  <th className="pb-3 font-medium">기기 정보</th>
                  <th className="pb-3 font-medium">브라우저</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.suspiciousIPs.map((ip, index) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-4 font-mono text-gray-900 font-medium">
                      {ip.ipAddress}
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ip.fraudClickCount >= 10
                          ? 'bg-red-100 text-red-800'
                          : ip.fraudClickCount >= 5
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ip.fraudClickCount}회
                      </span>
                    </td>
                    <td className="py-4 text-gray-600">
                      {new Date(ip.lastDetected).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ip.maxFraudScore >= 100
                          ? 'bg-red-100 text-red-800'
                          : ip.maxFraudScore >= 70
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ip.maxFraudScore}점
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ip.riskScore >= 85
                          ? 'bg-red-100 text-red-800'
                          : ip.riskScore >= 70
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {ip.riskScore}점
                      </span>
                    </td>
                    <td className="py-4 text-gray-600">
                      {ip.deviceInfo}
                    </td>
                    <td className="py-4 text-gray-600">
                      {ip.browser}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 네이버/구글 광고 차단 안내 */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          💡 IP 차단 등록 방법
        </h3>
        <p className="text-blue-700 text-sm mb-4">
          부정클릭으로 감지된 IP는 광고 플랫폼에 직접 등록해야 합니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">네이버 광고</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. 네이버 광고 관리 시스템 접속</li>
              <li>2. 도구 → IP 제외 관리</li>
              <li>3. IP 주소 입력 후 저장</li>
            </ol>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">구글 광고</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Google Ads 접속</li>
              <li>2. 설정 → IP 제외</li>
              <li>3. 캠페인 선택 후 IP 입력</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
