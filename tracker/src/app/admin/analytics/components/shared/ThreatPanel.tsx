'use client';

import { useEffect, useState, useCallback } from 'react';

interface ThreatItem {
  type: 'fingerprint' | 'ip';
  value: string;
  score: number;
  reasons: string[];
  sessions: number;
  lastSeen: string;
  details: {
    ips?: string[];
    pages?: string[];
    avgDwell?: number;
    deviceType?: string;
    browser?: string;
    city?: string;
  };
}

interface ThreatPanelProps {
  onBlock: (type: 'fingerprint' | 'ip', value: string, reason: string) => void;
}

export default function ThreatPanel({ onBlock }: ThreatPanelProps) {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);

  const fetchThreats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/threats');
      const json = await res.json();
      setThreats(json.threats || []);
    } catch (err) {
      console.error('Threat fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreats();
    const interval = setInterval(fetchThreats, 60000);
    return () => clearInterval(interval);
  }, [fetchThreats]);

  const handleBlock = async (threat: ThreatItem) => {
    setBlocking(threat.value);
    const reason = threat.reasons.join(', ');
    try {
      await onBlock(threat.type, threat.value, reason);
      setThreats((prev) => prev.filter((t) => t.value !== threat.value));
    } finally {
      setBlocking(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400 bg-red-500/15 border-red-500/30';
    if (score >= 60) return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30';
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">위협 탐지</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">위협 탐지</h3>
          {threats.length > 0 && (
            <span className="text-[10px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full">
              {threats.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setLoading(true); fetchThreats(); }}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          새로고침
        </button>
      </div>

      {/* 리스트 */}
      <div className="max-h-[600px] overflow-y-auto">
        {threats.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <span className="text-xs text-slate-500">탐지된 위협 없음</span>
          </div>
        ) : (
          threats.map((threat) => {
            const isExpanded = expanded === threat.value;
            const shortValue = threat.type === 'fingerprint'
              ? threat.value.substring(0, 16) + '...'
              : threat.value;

            return (
              <div key={threat.value} className="border-b border-slate-800/30 last:border-b-0">
                {/* 요약 행 */}
                <div
                  className="px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : threat.value)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {/* 타입 뱃지 */}
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        threat.type === 'fingerprint'
                          ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                          : 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                      }`}>
                        {threat.type === 'fingerprint' ? '기기' : 'IP'}
                      </span>
                      {/* 점수 */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${getScoreColor(threat.score)}`}>
                        {threat.score}점
                      </span>
                    </div>
                    {/* 차단 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBlock(threat);
                      }}
                      disabled={blocking === threat.value}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {blocking === threat.value ? '처리중...' : '차단'}
                    </button>
                  </div>

                  {/* 값 */}
                  <code className="text-xs font-mono text-slate-300 block mb-1">{shortValue}</code>

                  {/* 사유 */}
                  <div className="flex flex-wrap gap-1">
                    {threat.reasons.slice(0, 2).map((r, i) => (
                      <span key={i} className="text-[10px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                    {threat.reasons.length > 2 && (
                      <span className="text-[10px] text-slate-600">+{threat.reasons.length - 2}</span>
                    )}
                  </div>
                </div>

                {/* 상세 */}
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    <div className="bg-slate-900/50 rounded-lg p-3 text-[11px] space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">세션 수</span>
                        <span className="text-slate-300 font-medium">{threat.sessions}회</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">평균 체류</span>
                        <span className="text-slate-300 font-medium">{threat.details.avgDwell || 0}초</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">마지막 접속</span>
                        <span className="text-slate-300 tabular-nums">
                          {new Date(threat.lastSeen).toLocaleString('ko-KR', {
                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {threat.details.ips && threat.details.ips.length > 0 && (
                        <div>
                          <span className="text-slate-500 block mb-1">사용 IP ({threat.details.ips.length}개)</span>
                          {threat.details.ips.map((ip) => (
                            <code key={ip} className="text-[10px] font-mono text-slate-400 block">{ip}</code>
                          ))}
                        </div>
                      )}
                      {threat.details.pages && threat.details.pages.length > 0 && (
                        <div>
                          <span className="text-slate-500 block mb-1">접속 페이지</span>
                          {threat.details.pages.map((p) => (
                            <span key={p} className="text-[10px] text-slate-400 block">{p}</span>
                          ))}
                        </div>
                      )}
                      {/* 전체 사유 */}
                      <div>
                        <span className="text-slate-500 block mb-1">탐지 사유</span>
                        {threat.reasons.map((r, i) => (
                          <span key={i} className="text-[10px] text-orange-400/80 block">- {r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
