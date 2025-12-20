// app/api/stats/route.ts
// 관리자 대시보드용 통계 API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stats?siteId=xxx&period=7d
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d
  
  // 기간 계산
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where = {
    ...(siteId && { landing_site: siteId }),
    enter_time: { gte: startDate }
  };

  const sessionWhere = {
    ...(siteId && { landing_site: siteId }),
    first_visit: { gte: startDate }
  };

  try {
    // ========== 1. 기본 지표 ==========
    const [
      totalPageviews,
      totalSessions,
      pageviewStats,
      deviceBreakdown,
      sourceBreakdown,
      hourlyDistribution,
      topPages,
      conversionEvents,
      fraudClicks
    ] = await Promise.all([
      // 총 페이지뷰
      prisma.page_views.count({ where }),

      // 총 세션 (유니크 방문자)
      prisma.visitor_sessions.count({ where: sessionWhere }),

      // 체류시간 & 스크롤 통계
      prisma.page_views.aggregate({
        where,
        _avg: {
          dwell_time: true,
          scroll_depth: true,
          mouse_movements: true,
          clicks: true
        },
        _sum: {
          dwell_time: true
        },
        _max: {
          scroll_depth: true
        }
      }),

      // 디바이스별 분포
      prisma.visitor_sessions.groupBy({
        by: ['device_type'],
        where: sessionWhere,
        _count: true
      }),

      // 유입 소스별 분포
      prisma.visitor_sessions.groupBy({
        by: ['utm_source'],
        where: sessionWhere,
        _count: true,
        orderBy: { _count: { utm_source: 'desc' } },
        take: 10
      }),

      // 시간대별 방문 분포 (raw query 필요)
      prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM enter_time) as hour,
          COUNT(*) as count
        FROM page_views
        WHERE enter_time >= ${startDate}
        ${siteId ? prisma.$queryRaw`AND landing_site = ${siteId}` : prisma.$queryRaw``}
        GROUP BY EXTRACT(HOUR FROM enter_time)
        ORDER BY hour
      `,

      // 인기 페이지 Top 10
      prisma.page_views.groupBy({
        by: ['path'],
        where,
        _count: true,
        _avg: { dwell_time: true, scroll_depth: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10
      }),

      // 전환 이벤트
      prisma.click_events.count({
        where: {
          event_type: 'conversion',
          timestamp: { gte: startDate },
          ...(siteId && { landing_site: siteId })
        }
      }),

      // 부정클릭 의심
      prisma.click_events.count({
        where: {
          is_fraud: true,
          timestamp: { gte: startDate },
          ...(siteId && { landing_site: siteId })
        }
      })
    ]);

    // ========== 2. 스크롤 깊이 분포 ==========
    const scrollDistribution = await prisma.$queryRaw<{depth_range: string, count: bigint}[]>`
      SELECT 
        CASE 
          WHEN scroll_depth < 25 THEN '0-25%'
          WHEN scroll_depth < 50 THEN '25-50%'
          WHEN scroll_depth < 75 THEN '50-75%'
          ELSE '75-100%'
        END as depth_range,
        COUNT(*) as count
      FROM page_views
      WHERE enter_time >= ${startDate}
      ${siteId ? prisma.$queryRaw`AND landing_site = ${siteId}` : prisma.$queryRaw``}
      GROUP BY depth_range
      ORDER BY depth_range
    `;

    // ========== 3. 체류시간 분포 ==========
    const dwellDistribution = await prisma.$queryRaw<{time_range: string, count: bigint}[]>`
      SELECT 
        CASE 
          WHEN dwell_time < 10 THEN '0-10초'
          WHEN dwell_time < 30 THEN '10-30초'
          WHEN dwell_time < 60 THEN '30초-1분'
          WHEN dwell_time < 180 THEN '1-3분'
          ELSE '3분+'
        END as time_range,
        COUNT(*) as count
      FROM page_views
      WHERE enter_time >= ${startDate}
      ${siteId ? prisma.$queryRaw`AND landing_site = ${siteId}` : prisma.$queryRaw``}
      GROUP BY time_range
    `;

    // ========== 4. 일별 트렌드 ==========
    const dailyTrend = await prisma.$queryRaw<{date: Date, pageviews: bigint, sessions: bigint}[]>`
      SELECT 
        DATE(enter_time) as date,
        COUNT(*) as pageviews,
        COUNT(DISTINCT session_id) as sessions
      FROM page_views
      WHERE enter_time >= ${startDate}
      ${siteId ? prisma.$queryRaw`AND landing_site = ${siteId}` : prisma.$queryRaw``}
      GROUP BY DATE(enter_time)
      ORDER BY date
    `;

    // ========== 5. 클릭 이벤트 타입별 ==========
    const clicksByType = await prisma.click_events.groupBy({
      by: ['event_type'],
      where: {
        timestamp: { gte: startDate },
        ...(siteId && { landing_site: siteId })
      },
      _count: true
    });

    // ========== 응답 구성 ==========
    const stats = {
      period: { days, startDate: startDate.toISOString() },
      
      overview: {
        totalPageviews,
        totalSessions,
        avgDwellTime: Math.round(pageviewStats._avg.dwell_time || 0),
        avgScrollDepth: Math.round(pageviewStats._avg.scroll_depth || 0),
        avgMouseMovements: Math.round(pageviewStats._avg.mouse_movements || 0),
        avgClicks: Math.round((pageviewStats._avg.clicks || 0) * 10) / 10,
        totalDwellTime: pageviewStats._sum.dwell_time || 0,
        conversions: conversionEvents,
        conversionRate: totalSessions > 0 
          ? Math.round((conversionEvents / totalSessions) * 1000) / 10 
          : 0,
        fraudClicks
      },

      distributions: {
        scroll: scrollDistribution.map(r => ({
          range: r.depth_range,
          count: Number(r.count)
        })),
        dwellTime: dwellDistribution.map(r => ({
          range: r.time_range,
          count: Number(r.count)
        })),
        device: deviceBreakdown.map(d => ({
          type: d.device_type || 'unknown',
          count: d._count
        })),
        source: sourceBreakdown.map(s => ({
          source: s.utm_source || 'direct',
          count: s._count
        })),
        hourly: hourlyDistribution
      },

      topPages: topPages.map(p => ({
        path: p.path,
        views: p._count,
        avgDwellTime: Math.round(p._avg.dwell_time || 0),
        avgScrollDepth: Math.round(p._avg.scroll_depth || 0)
      })),

      dailyTrend: dailyTrend.map(d => ({
        date: d.date,
        pageviews: Number(d.pageviews),
        sessions: Number(d.sessions)
      })),

      clicksByType: clicksByType.map(c => ({
        type: c.event_type,
        count: c._count
      }))
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// ========== 실시간 방문자 ==========
// GET /api/stats/realtime?siteId=xxx
export async function getRealtimeVisitors(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  
  // 최근 5분 내 활동한 세션
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const activeVisitors = await prisma.visitor_sessions.findMany({
    where: {
      last_visit: { gte: fiveMinutesAgo },
      ...(siteId && { landing_site: siteId })
    },
    select: {
      id: true,
      fingerprint: true,
      device_type: true,
      browser: true,
      utm_source: true,
      last_visit: true,
      risk_score: true
    },
    orderBy: { last_visit: 'desc' },
    take: 50
  });

  // 최근 페이지뷰 정보도 가져오기
  const recentPageviews = await prisma.page_views.findMany({
    where: {
      session_id: { in: activeVisitors.map(v => v.id) }
    },
    orderBy: { enter_time: 'desc' },
    take: 100
  });

  const pageviewMap = new Map();
  recentPageviews.forEach(pv => {
    if (!pageviewMap.has(pv.session_id)) {
      pageviewMap.set(pv.session_id, pv);
    }
  });

  return NextResponse.json({
    count: activeVisitors.length,
    visitors: activeVisitors.map(v => ({
      sessionId: v.id.substring(0, 8) + '...',
      fingerprint: v.fingerprint.substring(0, 12) + '...',
      device: v.device_type,
      browser: v.browser,
      source: v.utm_source || 'direct',
      lastActive: v.last_visit,
      riskScore: v.risk_score,
      currentPage: pageviewMap.get(v.id)?.path || '/'
    }))
  });
}
