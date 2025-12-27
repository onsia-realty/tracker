import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'traffic-simulator', 'logs', 'sessions.db');

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    // 페이지별 방문 통계
    const pageStats = db.prepare(`
      SELECT
        landing_page,
        COUNT(*) as visit_count,
        AVG(dwell_time_seconds) as avg_dwell_time,
        AVG(fraud_score) as avg_fraud_score,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM sessions
      WHERE landing_page IS NOT NULL
      GROUP BY landing_page
      ORDER BY visit_count DESC
    `).all();

    // 전체 페이지 방문 빈도 (visited_pages JSON 파싱)
    const allSessions = db.prepare(`
      SELECT visited_pages
      FROM sessions
      WHERE visited_pages IS NOT NULL
    `).all();

    // 페이지별 방문 횟수 집계
    const pageVisits: Record<string, number> = {};

    allSessions.forEach((session: any) => {
      try {
        const pages = JSON.parse(session.visited_pages);
        if (Array.isArray(pages)) {
          pages.forEach((page: string) => {
            pageVisits[page] = (pageVisits[page] || 0) + 1;
          });
        }
      } catch (e) {
        // JSON 파싱 실패 시 무시
      }
    });

    // 페이지 이름 매핑
    const pageNames: Record<string, string> = {
      '/': '메인 페이지',
      '/business': '사업 안내',
      '/premium': '프리미엄',
      '/location': '입지 환경',
      '/site-plan': '단지 배치도',
      '/floor-plan': '평면도',
      '/interior': '특화 설계',
      '/community': '커뮤니티',
      '/contact': '분양 문의'
    };

    // 정렬 및 변환
    const allPagesStats = Object.entries(pageVisits)
      .map(([path, count]) => ({
        page_path: path,
        page_name: pageNames[path] || path,
        visit_count: count,
        percentage: 0 // 나중에 계산
      }))
      .sort((a, b) => b.visit_count - a.visit_count);

    // 비율 계산
    const totalVisits = allPagesStats.reduce((sum, page) => sum + page.visit_count, 0);
    allPagesStats.forEach(page => {
      page.percentage = totalVisits > 0
        ? parseFloat(((page.visit_count / totalVisits) * 100).toFixed(2))
        : 0;
    });

    db.close();

    return NextResponse.json({
      landingPages: pageStats.map((stat: any) => ({
        page_path: stat.landing_page,
        page_name: pageNames[stat.landing_page] || stat.landing_page,
        visit_count: stat.visit_count,
        avg_dwell_time: parseFloat(stat.avg_dwell_time?.toFixed(1) || '0'),
        avg_fraud_score: parseFloat(stat.avg_fraud_score?.toFixed(1) || '0'),
        success_count: stat.success_count,
        success_rate: stat.visit_count > 0
          ? parseFloat(((stat.success_count / stat.visit_count) * 100).toFixed(2))
          : 0
      })),
      allPages: allPagesStats
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({
      landingPages: [],
      allPages: [],
    }, { status: 500 });
  }
}
