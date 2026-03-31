'use client';

import { useEffect, useState, useCallback } from 'react';

interface BlacklistEntry {
  id: string;
  fingerprint: string | null;
  ipAddress: string | null;
  reason: string;
  evidence: string | null;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  sessionCount: number;
}

export default function IPManagementTab() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ipAddress: '', fingerprint: '', reason: '', duration: 'permanent' });
  const [addLoading, setAddLoading] = useState(false);

  const fetchBlacklist = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blacklist');
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch blacklist:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlacklist();
  }, [fetchBlacklist]);

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`${ids.length}개 항목을 차단 해제하시겠습니까?`)) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/admin/blacklist?ids=${ids.join(',')}`, { method: 'DELETE' });
      setSelectedIds(new Set());
      fetchBlacklist();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const handleAdd = async () => {
    if (!addForm.ipAddress && !addForm.fingerprint) return;
    if (!addForm.reason) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: addForm.ipAddress || undefined,
          fingerprint: addForm.fingerprint || undefined,
          reason: addForm.reason,
          duration: addForm.duration,
        }),
      });
      if (res.ok) {
        setAddForm({ ipAddress: '', fingerprint: '', reason: '', duration: 'permanent' });
        setShowAddForm(false);
        fetchBlacklist();
      }
    } catch (err) {
      console.error('Add failed:', err);
    } finally {
      setAddLoading(false);
    }
  };

  const copyIPs = (format: 'naver' | 'google') => {
    const activeEntries = entries.filter((e) => !e.isExpired && e.ipAddress);
    const ips = activeEntries.map((e) => e.ipAddress!);
    if (ips.length === 0) {
      setCopyMsg('복사할 IP가 없습니다');
      setTimeout(() => setCopyMsg(null), 2000);
      return;
    }

    let text: string;
    if (format === 'naver') {
      // 네이버 광고: 줄바꿈으로 구분
      text = ips.join('\n');
    } else {
      // 구글 광고: 줄바꿈으로 구분
      text = ips.join('\n');
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg(`${ips.length}개 IP 복사됨 (${format === 'naver' ? '네이버' : '구글'} 광고용)`);
      setTimeout(() => setCopyMsg(null), 3000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const activeEntries = entries.filter((e) => !e.isExpired);

  return (
    <div className="space-y-4">
      {/* 상단 액션바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm text-slate-300">
            블랙리스트 <span className="text-indigo-400 font-semibold">{activeEntries.length}</span>개 활성
            {entries.length - activeEntries.length > 0 && (
              <span className="text-slate-500 ml-1">({entries.length - activeEntries.length}개 만료)</span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* 수동 등록 */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
          >
            {showAddForm ? '취소' : '+ 수동 차단'}
          </button>

          {/* IP 복사 버튼 */}
          <button
            onClick={() => copyIPs('naver')}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            네이버 광고용 IP 복사
          </button>
          <button
            onClick={() => copyIPs('google')}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
          >
            구글 광고용 IP 복사
          </button>

          {/* 벌크 삭제 */}
          {selectedIds.size > 0 && (
            <button
              onClick={() => handleDelete(Array.from(selectedIds))}
              disabled={deleteLoading}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              {deleteLoading ? '처리 중...' : `${selectedIds.size}개 해제`}
            </button>
          )}
        </div>
      </div>

      {/* 수동 등록 폼 */}
      {showAddForm && (
        <div className="rounded-2xl bg-[#1a1d27] border border-indigo-500/20 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-white">수동 차단 등록</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">IP 주소</label>
              <input
                type="text"
                placeholder="예: 123.45.67.89"
                value={addForm.ipAddress}
                onChange={(e) => setAddForm({ ...addForm, ipAddress: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f1117] border border-slate-700/50 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">핑거프린트 (기기 ID)</label>
              <input
                type="text"
                placeholder="예: fp_d1a330e086..."
                value={addForm.fingerprint}
                onChange={(e) => setAddForm({ ...addForm, fingerprint: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f1117] border border-slate-700/50 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">차단 사유 <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="예: 부정클릭 반복"
                value={addForm.reason}
                onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f1117] border border-slate-700/50 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">차단 기간</label>
              <select
                value={addForm.duration}
                onChange={(e) => setAddForm({ ...addForm, duration: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f1117] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
              >
                <option value="permanent">영구 차단</option>
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="90">90일</option>
                <option value="180">180일</option>
                <option value="365">1년</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-slate-600">IP 또는 핑거프린트 중 하나 이상 입력 필요</p>
            <button
              onClick={handleAdd}
              disabled={addLoading || (!addForm.ipAddress && !addForm.fingerprint) || !addForm.reason}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {addLoading ? '처리 중...' : '차단 등록'}
            </button>
          </div>
        </div>
      )}

      {/* 복사 메시지 */}
      {copyMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {copyMsg}
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-2xl bg-[#1a1d27] border border-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === entries.length && entries.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-600 bg-transparent"
                  />
                </th>
                <th className="px-4 py-3 font-medium">IP 주소</th>
                <th className="px-4 py-3 font-medium">핑거프린트</th>
                <th className="px-4 py-3 font-medium">사유</th>
                <th className="px-4 py-3 font-medium">차단일</th>
                <th className="px-4 py-3 font-medium">만료일</th>
                <th className="px-4 py-3 font-medium text-right">세션</th>
                <th className="px-4 py-3 font-medium text-center">액션</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    블랙리스트가 비어 있습니다.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-slate-800/30 hover:bg-white/[0.02] transition-colors ${
                      entry.isExpired ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                        className="rounded border-slate-600 bg-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-slate-300">{entry.ipAddress || '-'}</code>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-slate-500 truncate block max-w-[120px]">
                        {entry.fingerprint ? `${entry.fingerprint.slice(0, 12)}...` : '-'}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                      {entry.reason}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                      {entry.expiresAt ? (
                        <span className={entry.isExpired ? 'text-slate-600' : 'text-slate-400'}>
                          {new Date(entry.expiresAt).toLocaleDateString('ko-KR')}
                          {entry.isExpired && ' (만료)'}
                        </span>
                      ) : (
                        <span className="text-red-400">영구</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums text-right">
                      {entry.sessionCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete([entry.id])}
                        className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                      >
                        해제
                      </button>
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
