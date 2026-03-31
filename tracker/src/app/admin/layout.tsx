import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* 헤더 */}
      <header className="bg-[#1a1d27] border-b border-slate-800/50">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/admin/analytics" className="text-xl font-bold text-white">
                ONSIA <span className="text-indigo-400">Tracker</span>
              </Link>
              <nav className="hidden md:flex gap-1">
                <Link
                  href="/admin/analytics"
                  className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  대시보드
                </Link>
                <Link
                  href="/admin/analytics/visitors"
                  className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  방문자
                </Link>
                <Link
                  href="/admin/analytics/fraud"
                  className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  부정클릭
                </Link>
                <Link
                  href="/admin/analytics/sites"
                  className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  사이트 관리
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">관리자</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main>
        {children}
      </main>
    </div>
  );
}
