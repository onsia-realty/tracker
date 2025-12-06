'use client';

import { useEffect, useState } from 'react';

// ===========================================
// 타입 정의
// ===========================================

interface LandingSite {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    sessions: number;
    pageViews: number;
    clickEvents: number;
  };
}

// ===========================================
// 메인 컴포넌트
// ===========================================

export default function SitesPage() {
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState<LandingSite | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subdomain: '',
    description: '',
  });

  const fetchSites = async () => {
    try {
      const response = await fetch('/api/admin/sites');
      if (response.ok) {
        const data = await response.json();
        setSites(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingSite
      ? `/api/admin/sites/${editingSite.id}`
      : '/api/admin/sites';
    const method = editingSite ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingSite(null);
        setFormData({ name: '', slug: '', subdomain: '', description: '' });
        fetchSites();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (site: LandingSite) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      slug: site.slug,
      subdomain: site.subdomain || '',
      description: site.description || '',
    });
    setShowForm(true);
  };

  const handleToggleActive = async (site: LandingSite) => {
    try {
      await fetch(`/api/admin/sites/${site.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !site.isActive }),
      });
      fetchSites();
    } catch (err) {
      console.error(err);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사이트 관리</h1>
          <p className="text-gray-500 mt-1">분양현장 랜딩페이지 관리</p>
        </div>
        <button
          onClick={() => {
            setEditingSite(null);
            setFormData({ name: '', slug: '', subdomain: '', description: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + 사이트 추가
        </button>
      </div>

      {/* 사이트 폼 (모달) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingSite ? '사이트 수정' : '새 사이트 추가'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사이트 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: formData.slug || generateSlug(e.target.value),
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="예: 래미안 원베일리"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  슬러그 (URL) *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="예: raemian-one-bailey"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL에 사용될 고유 식별자 (영문, 숫자, 하이픈만)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  서브도메인 (선택)
                </label>
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={(e) =>
                    setFormData({ ...formData, subdomain: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="예: raemian-one-bailey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명 (선택)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="사이트에 대한 간단한 설명"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingSite ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 사이트 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-500">
              <th className="px-6 py-4 font-medium">사이트</th>
              <th className="px-6 py-4 font-medium">슬러그</th>
              <th className="px-6 py-4 font-medium">방문자</th>
              <th className="px-6 py-4 font-medium">페이지뷰</th>
              <th className="px-6 py-4 font-medium">클릭</th>
              <th className="px-6 py-4 font-medium">상태</th>
              <th className="px-6 py-4 font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sites.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  등록된 사이트가 없습니다.
                </td>
              </tr>
            ) : (
              sites.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{site.name}</p>
                      {site.subdomain && (
                        <p className="text-sm text-gray-500">{site.subdomain}.onsia.city</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">
                    {site.slug}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {(site._count?.sessions || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {(site._count?.pageViews || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {(site._count?.clickEvents || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        site.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {site.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(site)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleToggleActive(site)}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        {site.isActive ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 추적 코드 안내 */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          📋 추적 코드 설치 방법
        </h3>
        <p className="text-blue-700 text-sm mb-4">
          랜딩 페이지에 아래 컴포넌트를 추가하세요.
        </p>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-300">
            {`import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';

export default function LandingPage() {
  return (
    <>
      <AnalyticsTracker
        config={{
          apiEndpoint: 'https://tracker.onsia.city/api/analytics',
          siteSlug: 'your-site-slug',
          trackClicks: true,
          trackScroll: true,
          trackMouse: true,
        }}
      />
      {/* 페이지 컨텐츠 */}
    </>
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
