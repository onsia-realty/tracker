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
import { notifyFraudAlert, notifyRepeatAlert } from '@/lib/notifyFraud';

const FRAUD_ALERT_DEDUP_HOURS = 24;

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

      // 블랙리스트 추가 (만점 cap=100)
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

    // SMS 알림 — 클릭 이벤트가 DB 저장된 후에 카운트해야 현재 클릭 포함됨.
    // 같은 IP + 같은 fingerprint(디바이스) + 같은 광고 키워드로 24h 내 3회 이상 접속 시 발송.
    if (body.eventType === 'ad_click' || body.eventType === 'cta_click') {
      await maybeSendRepeatFraudSms({
        sessionFingerprint: session.fingerprint,
        ipAddress,
        siteSlug: body.landingSiteSlug || null,
        adKeyword: body.adKeyword ?? session.utmTerm ?? null,
        adSource: body.adSource ?? session.utmSource ?? null,
        utmCampaign: body.adCampaign ?? session.utmCampaign ?? null,
        riskScore: fraudResult.riskScore,
        reasons: fraudResult.reasons,
        deviceLabel: `${session.browser || '?'}/${session.os || '?'}`,
      });
    }

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

// ===========================================
// 반복 접속 SMS 발송 (같은 IP + 같은 fingerprint + 같은 키워드 = 24h 내 3회+)
// ===========================================

interface MaybeSendRepeatFraudSmsArgs {
  sessionFingerprint: string;
  ipAddress: string | null;
  siteSlug: string | null;
  adKeyword: string | null;
  adSource: string | null;
  utmCampaign: string | null;
  riskScore: number;
  reasons: string[];
  deviceLabel: string;
}

const REPEAT_THRESHOLD = 3;
const REPEAT_WINDOW_HOURS = 24;

async function maybeSendRepeatFraudSms(args: MaybeSendRepeatFraudSmsArgs) {
  try {
    // 키워드 없으면 자연유입 가능성 — SMS 발송 안 함
    if (!args.adKeyword || !args.ipAddress) return;

    const since = new Date(Date.now() - REPEAT_WINDOW_HOURS * 3600 * 1000);

    // 같은 IP + 같은 fingerprint + 같은 키워드 = 24h 내 모든 ad/cta 클릭 조회
    const matchingClicks = await prisma.clickEvent.findMany({
      where: {
        adKeyword: args.adKeyword,
        timestamp: { gte: since },
        eventType: { in: ['ad_click', 'cta_click'] },
        session: {
          ipAddress: args.ipAddress,
          fingerprint: args.sessionFingerprint,
        },
      },
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    if (matchingClicks.length < REPEAT_THRESHOLD) return;

    // 24h 중복 발송 방지
    const recentAlert = await prisma.fraudAlertLog.findFirst({
      where: {
        sentAt: { gte: since },
        OR: [
          { fingerprint: args.sessionFingerprint },
          { ipAddress: args.ipAddress },
        ],
      },
      select: { id: true },
    });
    if (recentAlert) return;

    // 시간 목록 (한국시간 HH:MM 포맷, 최대 5개)
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const timeList = matchingClicks
      .slice(-5)
      .map((c) => {
        const k = new Date(c.timestamp.getTime() + KST_OFFSET);
        return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
      })
      .join(', ');

    const result = await notifyRepeatAlert({
      siteSlug: args.siteSlug || 'unknown',
      ipAddress: args.ipAddress,
      adKeyword: args.adKeyword,
      adSource: args.adSource,
      deviceLabel: args.deviceLabel,
      clickCount: matchingClicks.length,
      timeList,
    });

    await prisma.fraudAlertLog.create({
      data: {
        fingerprint: args.sessionFingerprint,
        ipAddress: args.ipAddress,
        siteSlug: args.siteSlug || 'unknown',
        riskScore: args.riskScore,
        reasons: `반복접속 ${matchingClicks.length}회 (${args.adKeyword})`.slice(0, 500),
        smsResult: result.success ? 'success' : result.skipped ? 'skipped' : (result.error || 'error').slice(0, 200),
      },
    });
  } catch (e) {
    console.error('[maybeSendRepeatFraudSms] failed:', e);
  }
}

// 레거시 — 점수 기반 발송 (현재 비활성, 미래에 옵션으로 살릴 수 있게 유지)
interface MaybeSendFraudSmsArgs {
  fingerprint: string;
  ipAddress: string | null;
  siteSlug: string | null;
  riskScore: number;
  reasons: string[];
  adSource: string | null;
  adKeyword: string | null;
  utmCampaign: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function maybeSendFraudSms(args: MaybeSendFraudSmsArgs) {
  try {
    const since = new Date(Date.now() - FRAUD_ALERT_DEDUP_HOURS * 3600 * 1000);

    // 같은 fingerprint 또는 ipAddress로 24h 내 발송 이력 있으면 skip
    const recent = await prisma.fraudAlertLog.findFirst({
      where: {
        sentAt: { gte: since },
        OR: [
          { fingerprint: args.fingerprint },
          ...(args.ipAddress ? [{ ipAddress: args.ipAddress }] : []),
        ],
      },
      select: { id: true },
    });

    if (recent) return;

    // 5분 내 같은 fingerprint 클릭 수
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const clickCount5min = await prisma.clickEvent.count({
      where: {
        session: { fingerprint: args.fingerprint },
        timestamp: { gte: fiveMinAgo },
      },
    });

    const result = await notifyFraudAlert({
      siteSlug: args.siteSlug || 'unknown',
      ipAddress: args.ipAddress,
      riskScore: args.riskScore,
      reasons: args.reasons,
      adSource: args.adSource,
      adKeyword: args.adKeyword,
      utmCampaign: args.utmCampaign,
      clickCount5min,
    });

    await prisma.fraudAlertLog.create({
      data: {
        fingerprint: args.fingerprint,
        ipAddress: args.ipAddress,
        siteSlug: args.siteSlug || 'unknown',
        riskScore: args.riskScore,
        reasons: args.reasons.slice(0, 3).join(', ').slice(0, 500),
        smsResult: result.success ? 'success' : result.skipped ? 'skipped' : (result.error || 'error').slice(0, 200),
      },
    });
  } catch (e) {
    console.error('[maybeSendFraudSms] failed:', e);
  }
}
