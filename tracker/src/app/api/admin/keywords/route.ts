import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const site = searchParams.get('site');

    // 기간 계산
    const now = new Date();
    let dateFrom: Date;
    if (period === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 세션 WHERE 조건
    const sessionWhere: Record<string, unknown> = {
      lastVisit: { gte: dateFrom },
    };
    if (site && site !== 'all') {
      sessionWhere.landingSite = { slug: site };
    }

    // 1. utmTerm이 있는 세션들 가져오기
    const sessionsWithUtm = await prisma.visitorSession.findMany({
      where: {
        ...sessionWhere,
        utmTerm: { not: null },
      },
      select: {
        id: true,
        utmTerm: true,
        utmSource: true,
        riskScore: true,
        totalDwellTime: true,
        isBlocked: true,
        isSuspicious: true,
      },
    });

    // 2. PageView에서 n_query 파싱으로 키워드 추출
    const pageViewsWithUrl = await prisma.pageView.findMany({
      where: {
        enterTime: { gte: dateFrom },
        fullUrl: { not: null },
        session: sessionWhere,
      },
      select: {
        sessionId: true,
        fullUrl: true,
        session: {
          select: {
            utmSource: true,
            riskScore: true,
            totalDwellTime: true,
            isBlocked: true,
            isSuspicious: true,
          },
        },
      },
    });

    // 키워드별 집계 맵
    const keywordMap = new Map<string, {
      keyword: string;
      source: string;
      visitors: number;
      fraudCount: number;
      suspiciousCount: number;
      totalDwellTime: number;
      totalRiskScore: number;
      sessionIds: Set<string>;
    }>();

    // utmTerm 기반 집계
    for (const s of sessionsWithUtm) {
      if (!s.utmTerm) continue;
      const key = s.utmTerm.toLowerCase().trim();
      if (!keywordMap.has(key)) {
        keywordMap.set(key, {
          keyword: s.utmTerm.trim(),
          source: s.utmSource || 'unknown',
          visitors: 0,
          fraudCount: 0,
          suspiciousCount: 0,
          totalDwellTime: 0,
          totalRiskScore: 0,
          sessionIds: new Set(),
        });
      }
      const entry = keywordMap.get(key)!;
      if (!entry.sessionIds.has(s.id)) {
        entry.sessionIds.add(s.id);
        entry.visitors++;
        entry.totalDwellTime += s.totalDwellTime;
        entry.totalRiskScore += s.riskScore;
        if (s.isBlocked) entry.fraudCount++;
        else if (s.isSuspicious) entry.suspiciousCount++;
      }
    }

    // URL 파싱 기반 집계
    const processedSessions = new Set<string>();
    for (const pv of pageViewsWithUrl) {
      if (!pv.fullUrl || processedSessions.has(pv.sessionId)) continue;
      try {
        const url = new URL(pv.fullUrl);
        const nQuery = url.searchParams.get('n_query') || url.searchParams.get('n_keyword');
        if (!nQuery) continue;

        processedSessions.add(pv.sessionId);
        const key = nQuery.toLowerCase().trim();
        if (!keywordMap.has(key)) {
          keywordMap.set(key, {
            keyword: nQuery.trim(),
            source: pv.session.utmSource || 'naver',
            visitors: 0,
            fraudCount: 0,
            suspiciousCount: 0,
            totalDwellTime: 0,
            totalRiskScore: 0,
            sessionIds: new Set(),
          });
        }
        const entry = keywordMap.get(key)!;
        if (!entry.sessionIds.has(pv.sessionId)) {
          entry.sessionIds.add(pv.sessionId);
          entry.visitors++;
          entry.totalDwellTime += pv.session.totalDwellTime;
          entry.totalRiskScore += pv.session.riskScore;
          if (pv.session.isBlocked) entry.fraudCount++;
          else if (pv.session.isSuspicious) entry.suspiciousCount++;
        }
      } catch { /* ignore parse errors */ }
    }

    // 결과 변환 및 정렬
    const keywords = Array.from(keywordMap.values())
      .map((entry) => ({
        keyword: entry.keyword,
        source: entry.source,
        visitors: entry.visitors,
        fraudCount: entry.fraudCount,
        suspiciousCount: entry.suspiciousCount,
        fraudRate: entry.visitors > 0
          ? Math.round((entry.fraudCount / entry.visitors) * 100)
          : 0,
        avgDwellTime: entry.visitors > 0
          ? Math.round(entry.totalDwellTime / entry.visitors)
          : 0,
        avgRiskScore: entry.visitors > 0
          ? Math.round(entry.totalRiskScore / entry.visitors)
          : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);

    return NextResponse.json(keywords);
  } catch (error) {
    console.error('Keywords API error:', error);
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 });
  }
}
