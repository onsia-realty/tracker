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

  // LandingSite ID 조회
  let landingSiteId: string | null = null;
  if (siteId) {
    const site = await prisma.landingSite.findUnique({
      where: { slug: siteId }
    });
    landingSiteId = site?.id || null;
  }

  const where = {
    ...(landingSiteId && { landingSiteId }),
    enterTime: { gte: startDate }
  };

  const sessionWhere = {
    ...(landingSiteId && { landingSiteId }),
    firstVisit: { gte: startDate }
  };

  try {
    // ========== 1. 기본 지표 ==========
    const [
      totalPageviews,
      totalSessions,
      pageviewStats,
      deviceBreakdown,
      sourceBreakdown,
      topPages,
      conversionEvents,
      fraudClicks
    ] = await Promise.all([
      // 총 페이지뷰
      prisma.pageView.count({ where }),

      // 총 세션 (유니크 방문자)
      prisma.visitorSession.count({ where: sessionWhere }),

      // 체류시간 & 스크롤 통계
      prisma.pageView.aggregate({
        where,
        _avg: {
          dwellTime: true,
          scrollDepth: true,
          mouseMovements: true,
          clicks: true
        },
        _sum: {
          dwellTime: true
        },
        _max: {
          scrollDepth: true
        }
      }),

      // 디바이스별 분포
      prisma.visitorSession.groupBy({
        by: ['deviceType'],
        where: sessionWhere,
        _count: true
      }),

      // 유입 소스별 분포
      prisma.visitorSession.groupBy({
        by: ['utmSource'],
        where: sessionWhere,
        _count: true,
        orderBy: { _count: { utmSource: 'desc' } },
        take: 10
      }),

      // 인기 페이지 Top 10
      prisma.pageView.groupBy({
        by: ['path'],
        where,
        _count: true,
        _avg: { dwellTime: true, scrollDepth: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10
      }),

      // 전환 이벤트
      prisma.clickEvent.count({
        where: {
          eventType: 'conversion',
          timestamp: { gte: startDate },
          ...(landingSiteId && { landingSiteId })
        }
      }),

      // 부정클릭 의심
      prisma.clickEvent.count({
        where: {
          isFraud: true,
          timestamp: { gte: startDate },
          ...(landingSiteId && { landingSiteId })
        }
      })
    ]);

    // ========== 2. 스크롤 깊이 분포 ==========
    const scrollDistribution = await prisma.$queryRaw<{depth_range: string, count: bigint}[]>`
      SELECT
        CASE
          WHEN "scrollDepth" < 25 THEN '0-25%'
          WHEN "scrollDepth" < 50 THEN '25-50%'
          WHEN "scrollDepth" < 75 THEN '50-75%'
          ELSE '75-100%'
        END as depth_range,
        COUNT(*) as count
      FROM "PageView"
      WHERE "enterTime" >= ${startDate}
      ${landingSiteId ? prisma.$queryRaw`AND "landingSiteId" = ${landingSiteId}` : prisma.$queryRaw``}
      GROUP BY depth_range
      ORDER BY depth_range
    `;

    // ========== 3. 체류시간 분포 ==========
    const dwellDistribution = await prisma.$queryRaw<{time_range: string, count: bigint}[]>`
      SELECT
        CASE
          WHEN "dwellTime" < 10 THEN '0-10초'
          WHEN "dwellTime" < 30 THEN '10-30초'
          WHEN "dwellTime" < 60 THEN '30초-1분'
          WHEN "dwellTime" < 180 THEN '1-3분'
          ELSE '3분+'
        END as time_range,
        COUNT(*) as count
      FROM "PageView"
      WHERE "enterTime" >= ${startDate}
      ${landingSiteId ? prisma.$queryRaw`AND "landingSiteId" = ${landingSiteId}` : prisma.$queryRaw``}
      GROUP BY time_range
    `;

    // ========== 4. 일별 트렌드 ==========
    const dailyTrend = await prisma.$queryRaw<{date: Date, pageviews: bigint, sessions: bigint}[]>`
      SELECT
        DATE("enterTime") as date,
        COUNT(*) as pageviews,
        COUNT(DISTINCT "sessionId") as sessions
      FROM "PageView"
      WHERE "enterTime" >= ${startDate}
      ${landingSiteId ? prisma.$queryRaw`AND "landingSiteId" = ${landingSiteId}` : prisma.$queryRaw``}
      GROUP BY DATE("enterTime")
      ORDER BY date
    `;

    // ========== 5. 클릭 이벤트 타입별 ==========
    const clicksByType = await prisma.clickEvent.groupBy({
      by: ['eventType'],
      where: {
        timestamp: { gte: startDate },
        ...(landingSiteId && { landingSiteId })
      },
      _count: true
    });

    // ========== 응답 구성 ==========
    const stats = {
      period: { days, startDate: startDate.toISOString() },

      overview: {
        totalPageviews,
        totalSessions,
        avgDwellTime: Math.round(pageviewStats._avg.dwellTime || 0),
        avgScrollDepth: Math.round(pageviewStats._avg.scrollDepth || 0),
        avgMouseMovements: Math.round(pageviewStats._avg.mouseMovements || 0),
        avgClicks: Math.round((pageviewStats._avg.clicks || 0) * 10) / 10,
        totalDwellTime: pageviewStats._sum.dwellTime || 0,
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
          type: d.deviceType || 'unknown',
          count: d._count
        })),
        source: sourceBreakdown.map(s => ({
          source: s.utmSource || 'direct',
          count: s._count
        }))
      },

      topPages: topPages.map(p => ({
        path: p.path,
        views: p._count,
        avgDwellTime: Math.round(p._avg.dwellTime || 0),
        avgScrollDepth: Math.round(p._avg.scrollDepth || 0)
      })),

      dailyTrend: dailyTrend.map(d => ({
        date: d.date,
        pageviews: Number(d.pageviews),
        sessions: Number(d.sessions)
      })),

      clicksByType: clicksByType.map(c => ({
        type: c.eventType,
        count: c._count
      }))
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
