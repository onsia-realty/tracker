/**
 * 통계 API
 *
 * GET /api/analytics/stats
 * - 실시간 방문자, 일간/주간/월간 통계
 * - 유입 경로 분석
 * - 부정클릭 현황
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ===========================================
// CORS 헤더
// ===========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ===========================================
// OPTIONS (CORS Preflight)
// ===========================================

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ===========================================
// GET - 통계 조회
// ===========================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const landingSiteSlug = searchParams.get('site');
    const period = searchParams.get('period') || 'today'; // today, week, month
    const type = searchParams.get('type') || 'overview'; // overview, traffic, fraud, realtime

    // 랜딩 사이트 필터 (선택)
    let landingSiteId: string | null = null;
    if (landingSiteSlug) {
      const site = await prisma.landingSite.findUnique({
        where: { slug: landingSiteSlug },
      });
      if (site) {
        landingSiteId = site.id;
      }
    }

    // 기간 계산
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // 타입별 응답
    switch (type) {
      case 'realtime':
        return NextResponse.json(
          await getRealtimeStats(landingSiteId),
          { headers: corsHeaders }
        );

      case 'traffic':
        return NextResponse.json(
          await getTrafficStats(landingSiteId, startDate),
          { headers: corsHeaders }
        );

      case 'fraud':
        return NextResponse.json(
          await getFraudStats(landingSiteId, startDate),
          { headers: corsHeaders }
        );

      default: // overview
        return NextResponse.json(
          await getOverviewStats(landingSiteId, startDate),
          { headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ===========================================
// 실시간 통계 (최근 5분)
// ===========================================

async function getRealtimeStats(landingSiteId: string | null) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const whereClause = landingSiteId
    ? { landingSiteId, lastVisit: { gte: fiveMinutesAgo } }
    : { lastVisit: { gte: fiveMinutesAgo } };

  // 실시간 방문자 수
  const realtimeVisitors = await prisma.visitorSession.count({
    where: whereClause,
  });

  // 실시간 페이지뷰
  const pageViewWhere = landingSiteId
    ? { landingSiteId, enterTime: { gte: fiveMinutesAgo } }
    : { enterTime: { gte: fiveMinutesAgo } };

  const realtimePageViews = await prisma.pageView.count({
    where: pageViewWhere,
  });

  // 최근 방문자 목록 (10명)
  const recentVisitors = await prisma.visitorSession.findMany({
    where: landingSiteId ? { landingSiteId } : {},
    orderBy: { lastVisit: 'desc' },
    take: 10,
    select: {
      id: true,
      deviceType: true,
      deviceVendor: true,
      deviceModel: true,
      browser: true,
      browserVersion: true,
      os: true,
      osVersion: true,
      city: true,
      country: true,
      referrer: true,
      utmSource: true,
      lastVisit: true,
      riskScore: true,
      isBlocked: true,
      landingSite: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  return {
    realtime: {
      visitors: realtimeVisitors,
      pageViews: realtimePageViews,
      timestamp: new Date().toISOString(),
    },
    recentVisitors,
  };
}

// ===========================================
// 트래픽 통계
// ===========================================

async function getTrafficStats(landingSiteId: string | null, startDate: Date) {
  const whereClause = landingSiteId
    ? { landingSiteId, firstVisit: { gte: startDate } }
    : { firstVisit: { gte: startDate } };

  // 총 방문자
  const totalVisitors = await prisma.visitorSession.count({
    where: whereClause,
  });

  // 신규 방문자 (visitCount = 1)
  const newVisitors = await prisma.visitorSession.count({
    where: { ...whereClause, visitCount: 1 },
  });

  // 재방문자
  const returningVisitors = totalVisitors - newVisitors;

  // 총 페이지뷰
  const pageViewWhere = landingSiteId
    ? { landingSiteId, enterTime: { gte: startDate } }
    : { enterTime: { gte: startDate } };

  const totalPageViews = await prisma.pageView.count({
    where: pageViewWhere,
  });

  // 평균 체류시간
  const avgDwellTime = await prisma.pageView.aggregate({
    where: { ...pageViewWhere, dwellTime: { not: null } },
    _avg: { dwellTime: true },
  });

  // 유입 경로별 통계
  const trafficSources = await prisma.visitorSession.groupBy({
    by: ['utmSource'],
    where: whereClause,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // 디바이스별 통계
  const deviceStats = await prisma.visitorSession.groupBy({
    by: ['deviceType'],
    where: whereClause,
    _count: { id: true },
  });

  // 브라우저별 통계
  const browserStats = await prisma.visitorSession.groupBy({
    by: ['browser'],
    where: whereClause,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });

  // 지역별 통계
  const regionStats = await prisma.visitorSession.groupBy({
    by: ['city'],
    where: { ...whereClause, city: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  return {
    summary: {
      totalVisitors,
      newVisitors,
      returningVisitors,
      totalPageViews,
      avgDwellTime: Math.round(avgDwellTime._avg.dwellTime || 0),
      bounceRate: totalVisitors > 0
        ? Math.round((newVisitors / totalVisitors) * 100)
        : 0,
    },
    trafficSources: trafficSources.map((s) => ({
      source: s.utmSource || 'direct',
      count: s._count.id,
    })),
    devices: deviceStats.map((d) => ({
      type: d.deviceType || 'unknown',
      count: d._count.id,
    })),
    browsers: browserStats.map((b) => ({
      name: b.browser || 'unknown',
      count: b._count.id,
    })),
    regions: regionStats.map((r) => ({
      city: r.city,
      count: r._count.id,
    })),
  };
}

// ===========================================
// 부정클릭 통계
// ===========================================

async function getFraudStats(landingSiteId: string | null, startDate: Date) {
  const clickWhere = landingSiteId
    ? { landingSiteId, timestamp: { gte: startDate } }
    : { timestamp: { gte: startDate } };

  // 총 클릭
  const totalClicks = await prisma.clickEvent.count({
    where: clickWhere,
  });

  // 부정클릭 수
  const fraudClicks = await prisma.clickEvent.count({
    where: { ...clickWhere, isFraud: true },
  });

  // 부정클릭 의심 (70점 이상)
  const suspiciousClicks = await prisma.clickEvent.count({
    where: {
      ...clickWhere,
      fraudScore: { gte: 70 },
      isFraud: false,
    },
  });

  // 차단된 세션 수
  const blockedSessions = await prisma.visitorSession.count({
    where: landingSiteId
      ? { landingSiteId, isBlocked: true }
      : { isBlocked: true },
  });

  // 블랙리스트 수 (만료되지 않은 것만)
  const blacklistCount = await prisma.blacklist.count({
    where: {
      OR: [
        { expiresAt: null }, // 영구 차단
        { expiresAt: { gt: new Date() } }, // 아직 만료되지 않음
      ],
    },
  });

  // 부정클릭 사유별 통계
  const fraudReasons = await prisma.clickEvent.groupBy({
    by: ['fraudReason'],
    where: { ...clickWhere, isFraud: true, fraudReason: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // 광고 소스별 부정클릭
  const fraudBySource = await prisma.clickEvent.groupBy({
    by: ['adSource'],
    where: { ...clickWhere, isFraud: true },
    _count: { id: true },
  });

  // 최근 부정클릭 로그 (20건)
  const recentFraudClicks = await prisma.clickEvent.findMany({
    where: { ...clickWhere, isFraud: true },
    orderBy: { timestamp: 'desc' },
    take: 20,
    include: {
      session: {
        select: {
          fingerprint: true,
          ipAddress: true,
          deviceType: true,
          browser: true,
          city: true,
        },
      },
    },
  });

  // 저장된 비용 추정 (네이버 평균 CPC 500원, 구글 300원 기준)
  const savedCost = fraudClicks * 400; // 평균 CPC

  return {
    summary: {
      totalClicks,
      fraudClicks,
      suspiciousClicks,
      fraudRate: totalClicks > 0
        ? Math.round((fraudClicks / totalClicks) * 100 * 10) / 10
        : 0,
      blockedSessions,
      blacklistCount,
      estimatedSavedCost: savedCost,
    },
    fraudReasons: fraudReasons.map((r) => ({
      reason: r.fraudReason,
      count: r._count.id,
    })),
    fraudBySource: fraudBySource.map((s) => ({
      source: s.adSource || 'unknown',
      count: s._count.id,
    })),
    recentFraudClicks: recentFraudClicks.map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      eventType: c.eventType,
      fraudScore: c.fraudScore,
      fraudReason: c.fraudReason,
      session: {
        fingerprint: c.session.fingerprint.substring(0, 8) + '...',
        ipAddress: c.session.ipAddress,
        deviceType: c.session.deviceType,
        browser: c.session.browser,
        city: c.session.city,
      },
    })),
  };
}

// ===========================================
// 전체 개요 통계
// ===========================================

async function getOverviewStats(landingSiteId: string | null, startDate: Date) {
  const [realtime, traffic, fraud] = await Promise.all([
    getRealtimeStats(landingSiteId),
    getTrafficStats(landingSiteId, startDate),
    getFraudStats(landingSiteId, startDate),
  ]);

  return {
    realtime: realtime.realtime,
    traffic: traffic.summary,
    fraud: fraud.summary,
    trafficSources: traffic.trafficSources.slice(0, 5),
    devices: traffic.devices,
    recentFraudClicks: fraud.recentFraudClicks.slice(0, 5),
  };
}
