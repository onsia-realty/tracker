'use client';

import { useState } from 'react';

interface BlockConfirmModalProps {
  ipAddress: string | null;
  fingerprint: string;
  onConfirm: (reason: string, duration: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function BlockConfirmModal({
  ipAddress,
  fingerprint,
  onConfirm,
  onCancel,
  loading,
}: BlockConfirmModalProps) {
  const [reason, setReason] = useState('수동 차단 - 부정클릭 의심');
  const [duration, setDuration] = useState('30');

  const durations = [
    { value: '1', label: '1일' },
    { value: '7', label: '7일' },
    { value: '30', label: '30일' },
    { value: 'permanent', label: '영구' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* 모달 */}
      <div className="relative bg-[#1a1d27] border border-slate-700/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-1">IP 차단 확인</h3>
        <p className="text-sm text-slate-400 mb-5">아래 정보를 확인하고 차단을 진행하세요.</p>

        {/* 대상 정보 */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-5 space-y-2">
          {ipAddress && (
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">IP 주소</span>
              <code className="text-sm text-slate-200 font-mono">{ipAddress}</code>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">핑거프린트</span>
            <code className="text-xs text-slate-400 font-mono truncate ml-4 max-w-[200px]">{fingerprint}</code>
          </div>
        </div>

        {/* 사유 입력 */}
        <label className="block mb-4">
          <span className="text-sm text-slate-300 mb-1.5 block">차단 사유</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
            placeholder="차단 사유를 입력하세요"
          />
        </label>

        {/* 기간 선택 */}
        <label className="block mb-6">
          <span className="text-sm text-slate-300 mb-1.5 block">차단 기간</span>
          <div className="flex gap-2">
            {durations.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  duration === d.value
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </label>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800/50 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition-colors border border-slate-700/50"
            disabled={loading}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(reason, duration)}
            disabled={!reason || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : '차단하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
