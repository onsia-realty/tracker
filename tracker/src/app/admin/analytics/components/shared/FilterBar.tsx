'use client';

interface FilterBarProps {
  filters: {
    riskLevel: string;
    deviceType: string;
    source: string;
    search: string;
    blocked: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onSearch: () => void;
}

export default function FilterBar({ filters, onFilterChange, onSearch }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* 위험등급 */}
      <select
        value={filters.riskLevel}
        onChange={(e) => onFilterChange('riskLevel', e.target.value)}
        className="px-3 py-2 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all"
      >
        <option value="all">전체 위험등급</option>
        <option value="high">위험 (85+)</option>
        <option value="suspicious">의심 (50-84)</option>
        <option value="normal">정상 (0-49)</option>
      </select>

      {/* 기기유형 */}
      <select
        value={filters.deviceType}
        onChange={(e) => onFilterChange('deviceType', e.target.value)}
        className="px-3 py-2 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all"
      >
        <option value="all">전체 기기</option>
        <option value="desktop">Desktop</option>
        <option value="mobile">Mobile</option>
        <option value="tablet">Tablet</option>
      </select>

      {/* 유입 소스 */}
      <select
        value={filters.source}
        onChange={(e) => onFilterChange('source', e.target.value)}
        className="px-3 py-2 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all"
      >
        <option value="all">전체 유입</option>
        <option value="naver">네이버 광고</option>
        <option value="google">구글 광고</option>
        <option value="direct">직접 방문</option>
      </select>

      {/* 차단 상태 */}
      <select
        value={filters.blocked}
        onChange={(e) => onFilterChange('blocked', e.target.value)}
        className="px-3 py-2 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all"
      >
        <option value="all">전체 상태</option>
        <option value="true">차단됨</option>
        <option value="false">활성</option>
      </select>

      {/* IP 검색 */}
      <div className="flex-1 min-w-[200px] flex gap-2">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="IP 주소 또는 핑거프린트 검색..."
          className="flex-1 px-3 py-2 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
        />
        <button
          onClick={onSearch}
          className="px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
        >
          검색
        </button>
      </div>
    </div>
  );
}
