/**
 * 세션 관리 API
 *
 * POST /api/analytics/session
 * - 핑거프린트로 기존 세션 조회 또는 새 세션 생성
 * - IP 기반 지역 정보 추출
 * - 블랙리스트 체크
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIP, getGeoIP } from '@/lib/geoip';
import { isBlacklisted } from '@/lib/fraudDetection';

// ===========================================
// 타입 정의
// ===========================================

interface SessionRequest {
  fingerprint: string;
  cookieId?: string;

  // 디바이스 정보
  deviceType: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;

  // 유입 경로
  referrer?: string;
  referrerDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;

  // 사이트 정보
  landingSiteSlug?: string;
}

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
// POST - 세션 생성/조회
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const body: SessionRequest = await request.json();

    if (!body.fingerprint) {
      return NextResponse.json(
        { error: 'fingerprint is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // IP 주소 추출
    const ipAddress = getClientIP(request);

    // 블랙리스트 체크
    const blacklisted = await isBlacklisted(body.fingerprint, ipAddress);
    if (blacklisted) {
      return NextResponse.json(
        {
          sessionId: null,
          isBlocked: true,
          message: '차단된 사용자입니다.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 지역 정보 조회
    let geoInfo = null;
    if (ipAddress) {
      geoInfo = await getGeoIP(ipAddress);
    }

    // 랜딩 사이트 조회
    let landingSite = null;
    if (body.landingSiteSlug) {
      landingSite = await prisma.landingSite.findUnique({
        where: { slug: body.landingSiteSlug },
      });
    }

    // 기존 세션 조회 (24시간 내 같은 핑거프린트)
    const existingSession = await prisma.visitorSession.findFirst({
      where: {
        fingerprint: body.fingerprint,
        lastVisit: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간
        },
      },
      orderBy: { lastVisit: 'desc' },
    });

    let session;

    if (existingSession) {
      // 기존 세션 업데이트
      session = await prisma.visitorSession.update({
        where: { id: existingSession.id },
        data: {
          lastVisit: new Date(),
          visitCount: { increment: 1 },
          ipAddress: ipAddress || existingSession.ipAddress,
          // UTM 파라미터는 첫 방문 값 유지 (또는 새 값으로 업데이트 선택)
        },
      });
    } else {
      // 새 세션 생성
      session = await prisma.visitorSession.create({
        data: {
          fingerprint: body.fingerprint,
          cookieId: body.cookieId,
          ipAddress,

          // 디바이스 정보
          userAgent: body.userAgent,
          deviceType: body.deviceType,
          browser: body.browser,
          browserVersion: body.browserVersion,
          os: body.os,
          osVersion: body.osVersion,
          screenWidth: body.screenWidth,
          screenHeight: body.screenHeight,

          // 지역 정보
          country: geoInfo?.country,
          countryCode: geoInfo?.countryCode,
          region: geoInfo?.region,
          city: geoInfo?.city,
          isp: geoInfo?.isp,
          isVpn: geoInfo?.isVpn || false,
          isProxy: geoInfo?.isProxy || false,

          // 유입 경로
          referrer: body.referrer,
          referrerDomain: body.referrerDomain,
          utmSource: body.utmSource,
          utmMedium: body.utmMedium,
          utmCampaign: body.utmCampaign,
          utmContent: body.utmContent,
          utmTerm: body.utmTerm,

          // 사이트 연결
          landingSiteId: landingSite?.id,
        },
      });
    }

    return NextResponse.json(
      {
        sessionId: session.id,
        isBlocked: session.isBlocked,
        isNew: !existingSession,
        visitCount: session.visitCount,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
