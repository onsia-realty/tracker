import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/admin/analytics" className="text-xl font-bold text-blue-600">
                ONSIA Tracker
              </Link>
              <nav className="hidden md:flex gap-6">
                <Link
                  href="/admin/analytics"
                  className="text-gray-600 hover:text-gray-900"
                >
                  대시보드
                </Link>
                <Link
                  href="/admin/analytics/visitors"
                  className="text-gray-600 hover:text-gray-900"
                >
                  방문자
                </Link>
                <Link
                  href="/admin/analytics/fraud"
                  className="text-gray-600 hover:text-gray-900"
                >
                  부정클릭
                </Link>
                <Link
                  href="/admin/analytics/sites"
                  className="text-gray-600 hover:text-gray-900"
                >
                  사이트 관리
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">관리자</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
