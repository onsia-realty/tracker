import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sort = searchParams.get('sort') || 'lastVisit';
    const order = searchParams.get('order') || 'desc';
    const riskLevel = searchParams.get('riskLevel') || 'all';
    const deviceType = searchParams.get('deviceType');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const blocked = searchParams.get('blocked');
    const site = searchParams.get('site');

    // WHERE 조건 구성
    const where: Record<string, unknown> = {};

    // 위험등급 필터
    if (riskLevel === 'high') {
      where.riskScore = { gte: 85 };
    } else if (riskLevel === 'suspicious') {
      where.riskScore = { gte: 50, lt: 85 };
    } else if (riskLevel === 'normal') {
      where.riskScore = { lt: 50 };
    }

    // 기기 유형 필터
    if (deviceType && deviceType !== 'all') {
      where.deviceType = deviceType;
    }

    // 유입 소스 필터
    if (source && source !== 'all') {
      if (source === 'direct') {
        where.utmSource = null;
      } else {
        where.utmSource = source;
      }
    }

    // IP/핑거프린트 검색
    if (search) {
      where.OR = [
        { ipAddress: { contains: search } },
        { fingerprint: { contains: search } },
      ];
    }

    // 날짜 범위
    if (dateFrom || dateTo) {
      where.lastVisit = {};
      if (dateFrom) (where.lastVisit as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.lastVisit as Record<string, unknown>).lte = new Date(dateTo);
    }

    // 차단 상태
    if (blocked === 'true') {
      where.isBlocked = true;
    } else if (blocked === 'false') {
      where.isBlocked = false;
    }

    // 사이트 필터
    if (site && site !== 'all') {
      where.landingSite = { slug: site };
    }

    // 정렬 매핑
    const validSorts: Record<string, string> = {
      lastVisit: 'lastVisit',
      riskScore: 'riskScore',
      totalDwellTime: 'totalDwellTime',
      totalPageViews: 'totalPageViews',
      visitCount: 'visitCount',
    };
    const sortField = validSorts[sort] || 'lastVisit';

    const skip = (page - 1) * limit;

    const [visitors, total] = await Promise.all([
      prisma.visitorSession.findMany({
        where,
        orderBy: { [sortField]: order === 'asc' ? 'asc' : 'desc' },
        skip,
        take: limit,
        include: {
          landingSite: { select: { name: true, slug: true } },
          _count: { select: { pageViews: true, clickEvents: true } },
          pageViews: {
            orderBy: { enterTime: 'desc' },
            take: 1,
            select: { path: true, fullUrl: true, enterTime: true, dwellTime: true },
          },
        },
      }),
      prisma.visitorSession.count({ where }),
    ]);

    // 키워드 추출 + 응답 매핑
    const data = visitors.map((v) => {
      let keyword: string | null = v.utmTerm || null;

      // fullUrl에서 n_query 파싱
      if (!keyword && v.pageViews[0]?.fullUrl) {
        try {
          const url = new URL(v.pageViews[0].fullUrl);
          keyword = url.searchParams.get('n_query') || url.searchParams.get('n_keyword') || null;
        } catch { /* ignore */ }
      }

      return {
        id: v.id,
        fingerprint: v.fingerprint,
        ipAddress: v.ipAddress,
        deviceType: v.deviceType,
        deviceVendor: v.deviceVendor,
        deviceModel: v.deviceModel,
        browser: v.browser,
        browserVersion: v.browserVersion,
        os: v.os,
        osVersion: v.osVersion,
        country: v.country,
        countryCode: v.countryCode,
        city: v.city,
        isp: v.isp,
        latitude: v.latitude,
        longitude: v.longitude,
        isVpn: v.isVpn,
        isProxy: v.isProxy,
        referrer: v.referrer,
        utmSource: v.utmSource,
        utmMedium: v.utmMedium,
        utmCampaign: v.utmCampaign,
        keyword,
        firstVisit: v.firstVisit,
        lastVisit: v.lastVisit,
        visitCount: v.visitCount,
        totalPageViews: v._count.pageViews,
        totalClicks: v._count.clickEvents,
        totalDwellTime: v.totalDwellTime,
        riskScore: v.riskScore,
        isSuspicious: v.isSuspicious,
        isBlocked: v.isBlocked,
        blockReason: v.blockReason,
        blockedAt: v.blockedAt,
        landingSite: v.landingSite,
      };
    });

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Visitors API error:', error);
    return NextResponse.json({ error: 'Failed to fetch visitors' }, { status: 500 });
  }
}
