/**
 * 페이지뷰 기록 API
 *
 * POST /api/analytics/pageview
 * - 페이지 진입 기록
 *
 * PATCH /api/analytics/pageview
 * - 페이지 이탈 시 체류시간, 스크롤 깊이 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ===========================================
// CORS 헤더
// ===========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ===========================================
// OPTIONS (CORS Preflight)
// ===========================================

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ===========================================
// POST - 페이지 진입 기록
// ===========================================

interface PageViewRequest {
  sessionId: string;
  landingSiteSlug?: string;
  path: string;
  fullUrl?: string;
  title?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PageViewRequest = await request.json();

    if (!body.sessionId || !body.path) {
      return NextResponse.json(
        { error: 'sessionId and path are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 세션 존재 확인
    const session = await prisma.visitorSession.findUnique({
      where: { id: body.sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 차단된 세션은 기록만 하고 응답
    if (session.isBlocked) {
      return NextResponse.json(
        { pageViewId: null, isBlocked: true },
        { headers: corsHeaders }
      );
    }

    // 랜딩 사이트 조회
    let landingSiteId = session.landingSiteId;
    if (body.landingSiteSlug) {
      const landingSite = await prisma.landingSite.findUnique({
        where: { slug: body.landingSiteSlug },
      });
      if (landingSite) {
        landingSiteId = landingSite.id;
      }
    }

    // 페이지뷰 기록
    const pageView = await prisma.pageView.create({
      data: {
        sessionId: body.sessionId,
        landingSiteId,
        path: body.path,
        fullUrl: body.fullUrl,
        title: body.title,
      },
    });

    // 세션 총 페이지뷰 업데이트
    await prisma.visitorSession.update({
      where: { id: body.sessionId },
      data: {
        totalPageViews: { increment: 1 },
        lastVisit: new Date(),
      },
    });

    return NextResponse.json(
      { pageViewId: pageView.id },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('PageView POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ===========================================
// PATCH - 페이지 이탈 시 업데이트
// ===========================================

interface PageViewUpdateRequest {
  pageViewId: string;
  dwellTime?: number;
  scrollDepth?: number;
  scrollEvents?: number;
  mouseMovements?: number;
  clicks?: number;
  exitType?: string;
}

export async function PATCH(request: NextRequest) {
  try {
    const body: PageViewUpdateRequest = await request.json();

    if (!body.pageViewId) {
      return NextResponse.json(
        { error: 'pageViewId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 페이지뷰 업데이트
    const pageView = await prisma.pageView.update({
      where: { id: body.pageViewId },
      data: {
        exitTime: new Date(),
        dwellTime: body.dwellTime,
        scrollDepth: body.scrollDepth,
        scrollEvents: body.scrollEvents,
        mouseMovements: body.mouseMovements,
        clicks: body.clicks,
        exitType: body.exitType,
      },
    });

    // 세션 총 체류시간 업데이트
    if (body.dwellTime) {
      await prisma.visitorSession.update({
        where: { id: pageView.sessionId },
        data: {
          totalDwellTime: { increment: body.dwellTime },
        },
      });
    }

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('PageView PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
