'use client';

import { useEffect, useState } from 'react';
import VisitorLogTab from './components/tabs/VisitorLogTab';
import IPManagementTab from './components/tabs/IPManagementTab';
import KeywordAnalysisTab from './components/tabs/KeywordAnalysisTab';
import ClickAnalysisTab from './components/tabs/ClickAnalysisTab';
import OverviewTab from './components/tabs/OverviewTab';

type Tab = 'visitors' | 'blacklist' | 'keywords' | 'clicks' | 'overview';

interface LandingSite {
  id: string;
  name: string;
  slug: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'visitors', label: '방문자 로그' },
  { key: 'blacklist', label: '블랙리스트' },
  { key: 'keywords', label: '키워드 분석' },
  { key: 'clicks', label: '클릭 분석' },
  { key: 'overview', label: '개요' },
];

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('visitors');
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [selectedSite, setSelectedSite] = useState('all');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    fetch('/api/admin/sites')
      .then((res) => res.json())
      .then(setSites)
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* 헤더 */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              ONSIA <span className="text-indigo-400">Analytics</span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* 사이트 선택 */}
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[#1a1d27] border border-slate-700/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
            >
              <option value="all">전체 사이트</option>
              {sites.map((site) => (
                <option key={site.id} value={site.slug}>{site.name}</option>
              ))}
            </select>

            {/* 기간 선택 (개요/키워드/클릭 탭에서만) */}
            {(activeTab === 'overview' || activeTab === 'keywords' || activeTab === 'clicks') && (
              <div className="flex rounded-xl bg-[#1a1d27] border border-slate-700/50 p-1">
                {(['today', 'week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      period === p
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {p === 'today' ? '오늘' : p === 'week' ? '7일' : '30일'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* 탭 네비게이션 */}
        <div className="flex gap-1 border-b border-slate-800/50">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'text-indigo-400 border-indigo-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'visitors' && <VisitorLogTab selectedSite={selectedSite} />}
        {activeTab === 'blacklist' && <IPManagementTab />}
        {activeTab === 'keywords' && <KeywordAnalysisTab selectedSite={selectedSite} period={period} />}
        {activeTab === 'clicks' && <ClickAnalysisTab selectedSite={selectedSite} period={period} />}
        {activeTab === 'overview' && <OverviewTab selectedSite={selectedSite} period={period} />}
      </div>
    </div>
  );
}
