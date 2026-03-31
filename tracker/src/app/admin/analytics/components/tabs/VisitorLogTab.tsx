'use client';

import { useEffect, useState, useCallback } from 'react';
import RiskBadge from '../shared/RiskBadge';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import BlockConfirmModal from '../shared/BlockConfirmModal';
import VisitorDetailPanel from '../shared/VisitorDetailPanel';
import ThreatPanel from '../shared/ThreatPanel';

interface Visitor {
  id: string;
  fingerprint: string;
  ipAddress: string | null;
  deviceType: string | null;
  deviceVendor: string | null;
  deviceModel: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isVpn: boolean;
  isProxy: boolean;
  utmSource: string | null;
  keyword: string | null;
  referrer: string | null;
  lastVisit: string;
  visitCount: number;
  totalPageViews: number;
  totalDwellTime: number;
  riskScore: number;
  isSuspicious: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  landingSite: { name: string; slug: string } | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface VisitorLogTabProps {
  selectedSite: string;
}

const ADMIN_IP = '220.117.73.250';

const CITY_KO: Record<string, string> = {
  // 서울 구
  'Seoul': '서울', 'Gangnam-gu': '강남구', 'Gangbuk-gu': '강북구', 'Gangdong-gu': '강동구',
  'Gangseo-gu': '강서구', 'Gwanak-gu': '관악구', 'Gwangjin-gu': '광진구', 'Guro-gu': '구로구',
  'Geumcheon-gu': '금천구', 'Nowon-gu': '노원구', 'Dobong-gu': '도봉구', 'Dongdaemun-gu': '동대문구',
  'Dongdaemun': '동대문구', 'Dongjak-gu': '동작구', 'Mapo-gu': '마포구', 'Seodaemun-gu': '서대문구',
  'Seocho-gu': '서초구', 'Seongdong-gu': '성동구', 'Seongbuk-gu': '성북구', 'Songpa-gu': '송파구',
  'Yangcheon-gu': '양천구', 'Yeongdeungpo-gu': '영등포구', 'Yongsan-gu': '용산구',
  'Eunpyeong-gu': '은평구', 'Jongno-gu': '종로구', 'Jung-gu': '중구', 'Jungnang-gu': '중랑구',
  // 광역시/도시
  'Busan': '부산', 'Daegu': '대구', 'Incheon': '인천', 'Gwangju': '광주',
  'Daejeon': '대전', 'Ulsan': '울산', 'Sejong': '세종', 'Jeju': '제주',
  // 경기도
  'Seongnam-si': '성남', 'Suwon': '수원', 'Yongin-si': '용인', 'Goyang-si': '고양',
  'Bucheon-si': '부천', 'Ansan-si': '안산', 'Anyang-si': '안양', 'Namyangju-si': '남양주',
  'Hwaseong-si': '화성', 'Pyeongtaek-si': '평택', 'Uijeongbu-si': '의정부',
  'Siheung-si': '시흥', 'Paju-si': '파주', 'Gimpo-si': '김포', 'Gwangmyeong': '광명',
  'Gwangmyeong-si': '광명', 'Hanam-si': '하남', 'Icheon-si': '이천',
  'Gunpo-si': '군포', 'Osan-si': '오산', 'Yangju-si': '양주',
  // 충청도
  'Cheongju-si': '청주', 'Cheonan-si': '천안', 'Asan-si': '아산',
  'Seosan City': '서산', 'Seosan-si': '서산',
  // 기타
  'Changwon-si': '창원', 'Gimhae-si': '김해', 'Jeonju-si': '전주',
  'Chuncheon-si': '춘천', 'Wonju-si': '원주', 'Gangneung-si': '강릉',
  // 해외 (주요)
  'Mountain View': 'Mountain View(US)', 'San Jose': 'San Jose(US)',
  'San Francisco': 'San Francisco(US)', 'Boydton': 'Boydton(US)',
  'Paripark': 'Paripark',
};

function toKoCity(city: string | null): string {
  if (!city) return '-';
  return CITY_KO[city] || city;
}

interface LandingSite {
  id: string;
  name: string;
  slug: string;
}

export default function VisitorLogTab({ selectedSite }: VisitorLogTabProps) {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState('lastVisit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    riskLevel: 'all',
    deviceType: 'all',
    source: 'all',
    search: '',
    blocked: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [blockTarget, setBlockTarget] = useState<Visitor | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [activeSite, setActiveSite] = useState(selectedSite);

  // 사이트 목록 로드
  useEffect(() => {
    fetch('/api/admin/sites')
      .then((res) => res.json())
      .then((data) => setSites(data))
      .catch(console.error);
  }, []);

  // 상위 selectedSite 변경 시 동기화
  useEffect(() => {
    setActiveSite(selectedSite);
  }, [selectedSite]);

  const fetchVisitors = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort: sortField,
        order: sortOrder,
      });
      if (activeSite !== 'all') params.set('site', activeSite);
      if (appliedFilters.riskLevel !== 'all') params.set('riskLevel', appliedFilters.riskLevel);
      if (appliedFilters.deviceType !== 'all') params.set('deviceType', appliedFilters.deviceType);
      if (appliedFilters.source !== 'all') params.set('source', appliedFilters.source);
      if (appliedFilters.search) params.set('search', appliedFilters.search);
      if (appliedFilters.blocked !== 'all') params.set('blocked', appliedFilters.blocked);

      const res = await fetch(`/api/admin/visitors?${params}`);
      const json = await res.json();
      setVisitors(json.data);
      setPagination(json.pagination);
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder, activeSite, appliedFilters]);

  useEffect(() => {
    setLoading(true);
    fetchVisitors(1);
  }, [fetchVisitors]);

  // 30초 자동 새로고침
  useEffect(() => {
    const interval = setInterval(() => fetchVisitors(pagination.page), 30000);
    return () => clearInterval(interval);
  }, [fetchVisitors, pagination.page]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSearch = () => {
    setAppliedFilters({ ...filters });
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // 셀렉트 변경은 즉시 적용
    if (key !== 'search') {
      setAppliedFilters(newFilters);
    }
  };

  const handleBlock = async (reason: string, duration: string) => {
    if (!blockTarget) return;
    setBlockLoading(true);
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: blockTarget.fingerprint,
          ipAddress: blockTarget.ipAddress,
          reason,
          duration,
        }),
      });
      if (res.ok) {
        setBlockTarget(null);
        fetchVisitors(pagination.page);
      }
    } catch (err) {
      console.error('Block failed:', err);
    } finally {
      setBlockLoading(false);
    }
  };

  const formatDeviceName = (v: Visitor) => {
    if (v.deviceModel && v.deviceModel !== 'Unknown') {
      if (v.deviceVendor === 'Apple') return v.deviceModel;
      return `${v.deviceVendor || ''} ${v.deviceModel}`.trim();
    }
    return v.deviceType || '-';
  };

  const DeviceIcon = ({ type }: { type: string | null }) => {
    if (type === 'mobile') {
      return (
        <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    );
  };

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}초`;
    return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  };

  const getSourceLabel = (source: string | null) => {
    if (!source) return '직접';
    const labels: Record<string, string> = { naver: '네이버', google: '구글', daum: '다음', kakao: '카카오' };
    return labels[source.toLowerCase()] || source;
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-[10px]">
      {sortField === field ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
    </span>
  );

  const getRiskBorderColor = (score: number, isBlocked: boolean) => {
    if (isBlocked) return 'border-l-red-500';
    if (score >= 85) return 'border-l-red-400';
    if (score >= 70) return 'border-l-orange-400';
    if (score >= 50) return 'border-l-yellow-400';
    return 'border-l-transparent';
  };

  if (loading && visitors.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">방문자 로그 로딩 중...</p>
        </div>
      </div>
    );
  }

  const handleThreatBlock = async (type: 'fingerprint' | 'ip', value: string, reason: string) => {
    try {
      const body: Record<string, string> = { reason, duration: '30' };
      if (type === 'fingerprint') body.fingerprint = value;
      else body.ipAddress = value;

      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) fetchVisitors(pagination.page);
    } catch (err) {
      console.error('Threat block failed:', err);
    }
  };

  return (
    <div className="flex gap-4">
      {/* 왼쪽: 방문자 로그 */}
      <div className="flex-1 min-w-0 space-y-4">
      {/* 사이트 대분류 */}
      {sites.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSite('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSite === 'all'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-[#1a1d27] text-slate-400 border border-slate-700/50 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            전체
          </button>
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => setActiveSite(site.slug)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeSite === site.slug
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-[#1a1d27] text-slate-400 border border-slate-700/50 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {site.name}
            </button>
          ))}
        </div>
      )}

      {/* 필터바 */}
      <FilterBar filters={filters} onFilterChange={handleFilterChange} onSearch={handleSearch} />

      {/* 정렬 버튼 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">정렬:</span>
        {[
          { field: 'lastVisit', label: '접속시간' },
          { field: 'riskScore', label: '위험도' },
          { field: 'totalDwellTime', label: '체류시간' },
          { field: 'totalPageViews', label: '페이지' },
        ].map((s) => (
          <button
            key={s.field}
            onClick={() => handleSort(s.field)}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              sortField === s.field
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-slate-800/50 hover:border-slate-700'
            }`}
          >
            {s.label}
            <SortIcon field={s.field} />
          </button>
        ))}
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-2">
        {visitors.length === 0 ? (
          <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 px-4 py-16 text-center text-slate-500 text-sm">
            조건에 맞는 방문자가 없습니다.
          </div>
        ) : (
          visitors.map((v) => {
            const isMyVisit = v.ipAddress === ADMIN_IP;
            const isExpanded = expandedId === v.id;

            return (
              <div
                key={v.id}
                className={`rounded-xl bg-[#1a1d27] border overflow-hidden transition-all ${
                  v.isBlocked ? 'opacity-50 border-red-500/20' :
                  v.riskScore >= 85 ? 'border-red-500/30' :
                  v.riskScore >= 70 ? 'border-orange-500/30' :
                  v.riskScore >= 50 ? 'border-yellow-500/30' :
                  isMyVisit ? 'border-indigo-500/30' :
                  'border-slate-800/50'
                } ${isMyVisit ? 'bg-indigo-500/5' : ''}`}
              >
                {/* 메인 카드 */}
                <div
                  className="px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  {/* 1행: IP (주역) + 위험도/액션 */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <code className={`text-sm font-mono font-semibold tracking-wide ${
                        v.isBlocked ? 'line-through text-slate-500' : 'text-white'
                      }`}>
                        {v.ipAddress || '-'}
                      </code>
                      {(v.isVpn || v.isProxy) && (
                        <span className="text-[10px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 rounded-full">
                          VPN
                        </span>
                      )}
                      {isMyVisit && (
                        <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">내 방문</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge score={v.riskScore} isBlocked={v.isBlocked} />
                      {!v.isBlocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBlockTarget(v);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="차단"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="m4.9 4.9 14.2 14.2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2행: 기기 + 브라우저 + 지역 */}
                  <div className="flex items-center gap-2 mb-2">
                    <DeviceIcon type={v.deviceType} />
                    <span className="text-xs text-slate-300 font-medium">{formatDeviceName(v)}</span>
                    <span className="text-slate-700">/</span>
                    <span className="text-xs text-slate-400">{v.browser || '-'}</span>
                    <span className="text-slate-700">/</span>
                    <span className="text-xs text-slate-400">{toKoCity(v.city)}</span>
                  </div>

                  {/* 3행: 시간 + 사이트 + 키워드 + 수치 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                        {new Date(v.lastVisit).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {v.landingSite && (
                        <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded shrink-0">{v.landingSite.name}</span>
                      )}
                      <span className="text-[11px] text-slate-600 shrink-0">{getSourceLabel(v.utmSource)}</span>
                      {v.keyword && (
                        <span className="text-xs text-indigo-400 font-medium truncate min-w-0">&quot;{v.keyword}&quot;</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] shrink-0 ml-3">
                      <span className="tabular-nums text-slate-400">{formatTime(v.totalDwellTime)}</span>
                      <span className="text-slate-700">·</span>
                      <span className="tabular-nums text-slate-400">{v.totalPageViews}<span className="text-slate-600">p</span></span>
                    </div>
                  </div>
                </div>

                {/* 상세 패널 */}
                {isExpanded && <VisitorDetailPanel sessionId={v.id} />}
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 px-4 py-3">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={(p) => {
              setLoading(true);
              fetchVisitors(p);
            }}
          />
        </div>
      )}

      {/* 차단 모달 */}
      {blockTarget && (
        <BlockConfirmModal
          ipAddress={blockTarget.ipAddress}
          fingerprint={blockTarget.fingerprint}
          onConfirm={handleBlock}
          onCancel={() => setBlockTarget(null)}
          loading={blockLoading}
        />
      )}
      </div>

      {/* 오른쪽: 위협 탐지 패널 */}
      <div className="w-80 shrink-0 hidden lg:block">
        <div className="sticky top-6">
          <ThreatPanel onBlock={handleThreatBlock} />
        </div>
      </div>
    </div>
  );
}
