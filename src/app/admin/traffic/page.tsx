'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total_sessions: number;
  success_count: number;
  failed_count: number;
  blocked_count: number;
  success_rate: string;
  avg_dwell_time: string;
  avg_fraud_score: string;
  avg_pages_visited: string;
  avg_scroll_depth: string;
  avg_mouse_movements: string;
}

interface Session {
  timestamp: string;
  device_type: string;
  device_name: string;
  status: string;
  dwell_time_seconds: number;
  fraud_score: number;
  referrer_type: string;
  proxy_ip: string;
}

interface ReferrerData {
  typeSummary: Array<{
    referrer_type: string;
    total_count: number;
    percentage: number;
    avg_dwell_time: number;
    avg_fraud_score: number;
    success_rate: number;
  }>;
  keywordRanking: Array<{
    referrer_keyword: string;
    referrer_type: string;
    count: number;
    avg_dwell_time: number;
    success_count: number;
  }>;
  socialPlatforms: Array<{
    platform: string;
    count: number;
    avg_dwell_time: number;
    avg_fraud_score: number;
  }>;
}

interface PageData {
  landingPages: Array<{
    page_path: string;
    page_name: string;
    visit_count: number;
    avg_dwell_time: number;
    avg_fraud_score: number;
    success_count: number;
    success_rate: number;
  }>;
  allPages: Array<{
    page_path: string;
    page_name: string;
    visit_count: number;
    percentage: number;
  }>;
}

export default function TrafficDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [referrerData, setReferrerData] = useState<ReferrerData | null>(null);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 통계 가져오기
      const statsRes = await fetch('/api/traffic/stats');
      const statsData = await statsRes.json();
      setStats(statsData.today);

      // 세션 가져오기
      const sessionsRes = await fetch('/api/traffic/sessions');
      const sessionsData = await sessionsRes.json();
      setSessions(sessionsData);

      // 유입경로 데이터 가져오기
      const referrerRes = await fetch('/api/traffic/referrers');
      const referrerData = await referrerRes.json();
      setReferrerData(referrerData);

      // 페이지별 데이터 가져오기
      const pageRes = await fetch('/api/traffic/pages');
      const pageData = await pageRes.json();
      setPageData(pageData);

      setLoading(false);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 30초마다 자동 업데이트
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🚀 트래픽 시뮬레이터 대시보드
        </h1>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="오늘 총 세션"
            value={stats?.total_sessions.toString() || '0'}
            subValue={`성공: ${stats?.success_count || 0}`}
          />
          <StatCard
            title="성공률"
            value={stats?.success_rate || '0%'}
            subValue={`실패: ${stats?.failed_count || 0}`}
            valueColor="text-green-600"
          />
          <StatCard
            title="평균 체류시간"
            value={stats?.avg_dwell_time || '0초'}
            subValue={`스크롤: ${stats?.avg_scroll_depth || '0%'}`}
          />
          <StatCard
            title="평균 부정클릭 점수"
            value={stats?.avg_fraud_score || '0점'}
            subValue={`차단: ${stats?.blocked_count || 0}회`}
            valueColor="text-orange-600"
          />
        </div>

        {/* 세션 로그 테이블 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">📋 최근 세션 로그</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    디바이스
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    체류시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    부정클릭점수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    유입경로
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    IP 주소
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      아직 세션 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  sessions.map((session, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(session.timestamp).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            session.device_type === 'mobile'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {session.device_type === 'mobile' ? '모바일' : '데스크톱'}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">{session.device_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-bold ${
                            session.status === 'success'
                              ? 'text-green-600'
                              : session.status === 'failed'
                              ? 'text-red-600'
                              : 'text-orange-600'
                          }`}
                        >
                          {session.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.dwell_time_seconds}초
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.fraud_score}점
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.referrer_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {session.proxy_ip || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 페이지별 방문 통계 */}
        {pageData && (
          <>
            {/* 전체 페이지 방문 통계 */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 페이지별 총 방문 횟수</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">순위</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">페이지</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">방문 횟수</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">비율</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pageData.allPages.map((page, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          #{idx + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-blue-600">{page.page_name}</div>
                          <div className="text-xs text-gray-500">{page.page_path}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-bold">{page.visit_count}회</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full"
                                style={{ width: `${page.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 min-w-[50px]">
                              {page.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 첫 진입 페이지 통계 */}
            {pageData.landingPages.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">🚪 첫 진입 페이지 통계</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">페이지</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">진입 횟수</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">성공률</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">평균 체류시간</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">평균 부정점수</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pageData.landingPages.map((page, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-blue-600">{page.page_name}</div>
                            <div className="text-xs text-gray-500">{page.page_path}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-bold">{page.visit_count}회</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${
                              page.success_rate >= 70 ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              {page.success_rate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {page.avg_dwell_time}초
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {page.avg_fraud_score}점
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* 유입경로 분석 */}
        {referrerData && (
          <>
            {/* 유입 타입별 통계 */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 유입경로 타입별 통계</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {referrerData.typeSummary.map((type) => (
                  <div key={type.referrer_type} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-700">
                        {type.referrer_type === 'naver' && '네이버'}
                        {type.referrer_type === 'google' && '구글'}
                        {type.referrer_type === 'social' && '소셜미디어'}
                        {type.referrer_type === 'direct' && '직접 유입'}
                      </h3>
                      <span className="text-2xl font-bold text-blue-600">{type.percentage}%</span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>총 {type.total_count}회</div>
                      <div>성공률: {type.success_rate}%</div>
                      <div>평균 체류: {type.avg_dwell_time.toFixed(1)}초</div>
                      <div>부정점수: {type.avg_fraud_score.toFixed(1)}점</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 검색 키워드 랭킹 */}
            {referrerData.keywordRanking.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">🔍 검색 키워드 랭킹 TOP 10</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">순위</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">키워드</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">검색엔진</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">유입 횟수</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">성공 횟수</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">평균 체류시간</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {referrerData.keywordRanking.map((keyword, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                            #{idx + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                            {keyword.referrer_keyword}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              keyword.referrer_type === 'naver'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {keyword.referrer_type === 'naver' ? '네이버' : '구글'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {keyword.count}회
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                            {keyword.success_count}회
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {keyword.avg_dwell_time.toFixed(1)}초
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 소셜 미디어 플랫폼별 통계 */}
            {referrerData.socialPlatforms.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">📱 소셜 미디어 플랫폼별 통계</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">플랫폼</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">유입 횟수</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">평균 체류시간</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">평균 부정점수</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {referrerData.socialPlatforms.map((platform, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                            <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              {platform.platform === 'facebook' && '페이스북'}
                              {platform.platform === 'instagram' && '인스타그램'}
                              {platform.platform === 'kakaotalk' && '카카오톡'}
                              {platform.platform === 'naver_blog' && '네이버 블로그'}
                              {platform.platform === 'naver_cafe' && '네이버 카페'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {platform.count}회
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {platform.avg_dwell_time.toFixed(1)}초
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {platform.avg_fraud_score.toFixed(1)}점
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* 업데이트 시간 */}
        <div className="mt-4 text-center text-sm text-gray-500">
          마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')} | 30초마다 자동 업데이트
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subValue,
  valueColor = 'text-green-600',
}: {
  title: string;
  value: string;
  subValue?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
      {subValue && <div className="text-sm text-gray-400 mt-2">{subValue}</div>}
    </div>
  );
}
