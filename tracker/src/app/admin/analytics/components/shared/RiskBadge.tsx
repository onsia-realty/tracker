'use client';

interface RiskBadgeProps {
  score: number;
  isBlocked?: boolean;
  size?: 'sm' | 'md';
}

export default function RiskBadge({ score, isBlocked, size = 'md' }: RiskBadgeProps) {
  if (isBlocked) {
    return (
      <span className={`inline-flex items-center rounded-lg font-semibold border tabular-nums bg-red-500/10 text-red-400 border-red-500/20 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}>
        차단됨
      </span>
    );
  }

  if (score >= 85) {
    return (
      <span className={`inline-flex items-center rounded-lg font-semibold border tabular-nums bg-red-500/10 text-red-400 border-red-500/20 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}>
        {score}점
      </span>
    );
  }

  if (score >= 70) {
    return (
      <span className={`inline-flex items-center rounded-lg font-semibold border tabular-nums bg-orange-500/10 text-orange-400 border-orange-500/20 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}>
        {score}점
      </span>
    );
  }

  if (score >= 50) {
    return (
      <span className={`inline-flex items-center rounded-lg font-semibold border tabular-nums bg-yellow-500/10 text-yellow-400 border-yellow-500/20 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}>
        {score}점
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-lg font-semibold border tabular-nums bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ${
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    }`}>
      {score}점
    </span>
  );
}
