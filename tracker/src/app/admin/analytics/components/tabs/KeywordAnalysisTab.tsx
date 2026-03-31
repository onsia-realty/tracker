'use client';

import { useEffect, useState } from 'react';

interface KeywordData {
  keyword: string;
  source: string;
  visitors: number;
  fraudCount: number;
  suspiciousCount: number;
  fraudRate: number;
  avgDwellTime: number;
  avgRiskScore: number;
}

interface KeywordAnalysisTabProps {
  selectedSite: string;
  period: string;
}

export default function KeywordAnalysisTab({ selectedSite, period }: KeywordAnalysisTabProps) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'visitors' | 'fraudRate' | 'avgRiskScore'>('visitors');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (selectedSite !== 'all') params.set('site', selectedSite);

    fetch(`/api/admin/keywords?${params}`)
      .then((res) => res.json())
      .then(setKeywords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedSite, period]);

  const sorted = [...keywords].sort((a, b) => b[sortField] - a[sortField]);

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}초`;
    return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = { naver: '네이버', google: '구글', daum: '다음' };
    return labels[source.toLowerCase()] || source;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 정렬 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">정렬:</span>
        {[
          { key: 'visitors' as const, label: '방문자수' },
          { key: 'fraudRate' as const, label: '부정클릭률' },
          { key: 'avgRiskScore' as const, label: '평균 위험도' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortField(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortField === opt.key
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">총 {keywords.length}개 키워드</span>
      </div>

      {/* 테이블 */}
      <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                <th className="px-4 py-3 font-medium">키워드</th>
                <th className="px-4 py-3 font-medium">소스</th>
                <th className="px-4 py-3 font-medium text-right">방문자수</th>
                <th className="px-4 py-3 font-medium text-right">부정클릭률</th>
                <th className="px-4 py-3 font-medium text-right">평균 체류시간</th>
                <th className="px-4 py-3 font-medium text-right">평균 위험도</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                    수집된 키워드가 없습니다.
                  </td>
                </tr>
              ) : (
                sorted.map((kw, i) => (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-200 font-medium">&quot;{kw.keyword}&quot;</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        kw.source === 'naver' ? 'bg-emerald-500/10 text-emerald-400' :
                        kw.source === 'google' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {getSourceLabel(kw.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-300 tabular-nums">
                      {kw.visitors}명
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold tabular-nums ${
                        kw.fraudRate >= 50 ? 'text-red-400' :
                        kw.fraudRate >= 20 ? 'text-orange-400' :
                        'text-slate-400'
                      }`}>
                        {kw.fraudRate}%
                      </span>
                      {kw.fraudCount > 0 && (
                        <span className="text-[10px] text-slate-600 ml-1">({kw.fraudCount}건)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 tabular-nums">
                      {formatTime(kw.avgDwellTime)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold tabular-nums ${
                        kw.avgRiskScore >= 70 ? 'text-red-400' :
                        kw.avgRiskScore >= 50 ? 'text-orange-400' :
                        'text-emerald-400'
                      }`}>
                        {kw.avgRiskScore}점
                      </span>
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
