/**
 * 클릭 이벤트 API
 *
 * POST /api/analytics/click
 * - 클릭 이벤트 기록
 * - 부정클릭 실시간 탐지
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIP } from '@/lib/geoip';
import {
  smartFraudCheck,
  updateSessionRisk,
  addToBlacklist,
} from '@/lib/fraudDetection';

// ===========================================
// CORS 헤더
// ===========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ===========================================
// OPTIONS (CORS Preflight)
// ===========================================

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ===========================================
// POST - 클릭 이벤트 기록
// ===========================================

interface ClickEventRequest {
  sessionId: string;
  landingSiteSlug?: string;

  // 이벤트 정보
  eventType: string; // ad_click, cta_click, phone_click, inquiry_submit, external_link
  targetUrl?: string;
  targetElement?: string;
  targetText?: string;

  // 클릭 위치
  clickX?: number;
  clickY?: number;
  viewportWidth?: number;
  viewportHeight?: number;

  // 광고 정보
  adSource?: string;
  adCampaign?: string;
  adGroup?: string;
  adKeyword?: string;
  adCreative?: string;

  // 컨텍스트
  pageUrl?: string;

  // 클릭 전 행동 데이터
  dwellTimeBeforeClick?: number;
  scrollDepthBeforeClick?: number;
  mouseMovementsBeforeClick?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ClickEventRequest = await request.json();

    if (!body.sessionId || !body.eventType) {
      return NextResponse.json(
        { error: 'sessionId and eventType are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 세션 조회
    const session = await prisma.visitorSession.findUnique({
      where: { id: body.sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 이미 차단된 세션
    if (session.isBlocked) {
      return NextResponse.json(
        {
          clickId: null,
          isFraud: true,
          action: 'block',
          message: '차단된 세션입니다.',
        },
        { headers: corsHeaders }
      );
    }

    // IP 주소
    const ipAddress = getClientIP(request);

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

    // 부정클릭 탐지 (광고 클릭인 경우에만)
    let fraudResult: {
      isFraud: boolean;
      riskScore: number;
      reasons: string[];
      action: 'allow' | 'warn' | 'block';
    } = {
      isFraud: false,
      riskScore: 0,
      reasons: [],
      action: 'allow',
    };

    if (body.eventType === 'ad_click' || body.eventType === 'cta_click') {
      fraudResult = await smartFraudCheck({
        fingerprint: session.fingerprint,
        ipAddress,
        sessionId: session.id,
        landingSiteId,
        eventType: body.eventType,
        adSource: body.adSource,
        dwellTimeBeforeClick: body.dwellTimeBeforeClick,
        scrollDepthBeforeClick: body.scrollDepthBeforeClick,
        mouseMovementsBeforeClick: body.mouseMovementsBeforeClick,
        clickX: body.clickX,
        clickY: body.clickY,
        isVpn: session.isVpn,
        isProxy: session.isProxy,
        countryCode: session.countryCode,
      });

      // 세션 리스크 스코어 업데이트
      await updateSessionRisk(session.id, fraudResult.riskScore, fraudResult.reasons);

      // 블랙리스트 추가 (100점 이상)
      if (fraudResult.riskScore >= 100) {
        await addToBlacklist(
          session.fingerprint,
          ipAddress,
          fraudResult.reasons.join(', '),
          {
            sessionId: session.id,
            eventType: body.eventType,
            timestamp: new Date().toISOString(),
          },
          false // 30일 차단
        );
      }
    }

    // 클릭 이벤트 기록
    const clickEvent = await prisma.clickEvent.create({
      data: {
        sessionId: body.sessionId,
        landingSiteId,

        eventType: body.eventType,
        targetUrl: body.targetUrl,
        targetElement: body.targetElement,
        targetText: body.targetText,

        clickX: body.clickX,
        clickY: body.clickY,
        viewportWidth: body.viewportWidth,
        viewportHeight: body.viewportHeight,

        adSource: body.adSource,
        adCampaign: body.adCampaign,
        adGroup: body.adGroup,
        adKeyword: body.adKeyword,
        adCreative: body.adCreative,

        pageUrl: body.pageUrl,

        dwellTimeBeforeClick: body.dwellTimeBeforeClick,
        scrollDepthBeforeClick: body.scrollDepthBeforeClick,
        mouseMovementsBeforeClick: body.mouseMovementsBeforeClick,

        isFraud: fraudResult.isFraud,
        fraudReason: fraudResult.reasons.length > 0 ? fraudResult.reasons.join(', ') : null,
        fraudScore: fraudResult.riskScore,
      },
    });

    return NextResponse.json(
      {
        clickId: clickEvent.id,
        isFraud: fraudResult.isFraud,
        riskScore: fraudResult.riskScore,
        action: fraudResult.action,
        reasons: fraudResult.reasons,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Click API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
