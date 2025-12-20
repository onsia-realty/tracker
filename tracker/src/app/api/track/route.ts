// app/api/track/route.ts
// 방문자 추적 데이터 수신 API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseUserAgent } from '@/lib/userAgentParser';

// 이벤트 타입 정의
type EventType =
  | 'session_start'
  | 'pageview_start'
  | 'pageview_end'
  | 'heartbeat'
  | 'scroll_milestone'
  | 'click'
  | 'custom'
  | 'conversion';

interface TrackingPayload {
  eventType: EventType;
  siteId: string;
  sessionId: string;
  fingerprint: string;
  timestamp: number;
  url: string;
  [key: string]: any;
}

// IP 추출
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (real) {
    return real;
  }
  return '127.0.0.1';
}

// 이 함수는 이제 userAgentParser.ts에서 import

export async function POST(request: NextRequest) {
  try {
    const payload: TrackingPayload = await request.json();
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const deviceInfo = parseUserAgent(userAgent);

    // 이벤트 타입별 처리
    switch (payload.eventType) {
      // ========== 세션 시작 ==========
      case 'session_start': {
        // LandingSite 찾기 또는 생성
        let site = await prisma.landingSite.findUnique({
          where: { slug: payload.siteId }
        });

        if (!site) {
          // 사이트가 없으면 자동 생성
          site = await prisma.landingSite.create({
            data: {
              name: payload.siteId,
              slug: payload.siteId,
              isActive: true
            }
          });
        }

        await prisma.visitorSession.upsert({
          where: { id: payload.sessionId },
          update: {
            fingerprint: payload.fingerprint,
            lastVisit: new Date(),
            visitCount: { increment: 1 }
          },
          create: {
            id: payload.sessionId,
            fingerprint: payload.fingerprint,
            ipAddress: clientIP,
            userAgent: userAgent,
            deviceType: deviceInfo.deviceType,
            deviceVendor: deviceInfo.deviceVendor,
            deviceModel: deviceInfo.deviceModel,
            browser: deviceInfo.browser,
            browserVersion: deviceInfo.browserVersion,
            os: deviceInfo.os,
            osVersion: deviceInfo.osVersion,
            referrer: payload.referrer || null,
            utmSource: payload.utm?.utm_source || null,
            utmMedium: payload.utm?.utm_medium || null,
            utmCampaign: payload.utm?.utm_campaign || null,
            utmContent: payload.utm?.utm_content || null,
            landingSiteId: site.id,
            firstVisit: new Date(),
            lastVisit: new Date(),
            visitCount: 1,
            riskScore: 0,
            isBlocked: false
          }
        });

        // 블랙리스트 체크
        const blocked = await prisma.blacklist.findUnique({
          where: { fingerprint: payload.fingerprint }
        });

        return NextResponse.json({
          success: true,
          blocked: !!blocked,
          blockReason: blocked?.reason
        });
      }

      // ========== 페이지뷰 시작 ==========
      case 'pageview_start': {
        // LandingSite 찾기
        const site = await prisma.landingSite.findUnique({
          where: { slug: payload.siteId }
        });

        await prisma.pageView.create({
          data: {
            id: payload.pageviewId,
            sessionId: payload.sessionId,
            landingSiteId: site?.id || null,
            path: payload.path,
            title: payload.title,
            enterTime: new Date(),
            dwellTime: 0,
            scrollDepth: 0,
            mouseMovements: 0,
            clicks: 0
          }
        });

        return NextResponse.json({ success: true });
      }

      // ========== 하트비트 (체류시간 업데이트) ==========
      case 'heartbeat': {
        if (payload.pageviewId) {
          await prisma.pageView.update({
            where: { id: payload.pageviewId },
            data: {
              dwellTime: payload.dwellTime,
              scrollDepth: payload.maxScrollDepth,
              mouseMovements: payload.mouseMovements,
              clicks: payload.clickCount
            }
          });
        }

        // 세션 마지막 활동 시간 업데이트
        await prisma.visitorSession.update({
          where: { id: payload.sessionId },
          data: { lastVisit: new Date() }
        });

        return NextResponse.json({ success: true });
      }

      // ========== 페이지뷰 종료 ==========
      case 'pageview_end': {
        await prisma.pageView.update({
          where: { id: payload.pageviewId },
          data: {
            exitTime: new Date(),
            dwellTime: payload.dwellTime,
            scrollDepth: payload.maxScrollDepth,
            mouseMovements: payload.mouseMovements,
            clicks: payload.clickCount
          }
        });

        // 중요 클릭 이벤트 저장
        if (payload.clicks && payload.clicks.length > 0) {
          const site = await prisma.landingSite.findUnique({
            where: { slug: payload.siteId }
          });

          await prisma.clickEvent.createMany({
            data: payload.clicks.map((click: any) => ({
              id: `${payload.pageviewId}-${click.timestamp}`,
              sessionId: payload.sessionId,
              landingSiteId: site?.id || null,
              eventType: click.eventType,
              targetElement: click.target,
              clickX: click.x,
              clickY: click.y,
              timestamp: new Date(click.timestamp),
              isFraud: false,
              fraudScore: 0
            }))
          });
        }

        return NextResponse.json({ success: true });
      }

      // ========== 스크롤 마일스톤 ==========
      case 'scroll_milestone': {
        // 로그만 기록 (별도 테이블 없이)
        console.log(`[Scroll] Session ${payload.sessionId}: ${payload.milestone}%`);
        return NextResponse.json({ success: true });
      }

      // ========== 클릭 이벤트 (중요 클릭만) ==========
      case 'click': {
        const riskScore = await calculateClickRisk(payload, clientIP);

        const site = await prisma.landingSite.findUnique({
          where: { slug: payload.siteId }
        });

        await prisma.clickEvent.create({
          data: {
            id: `${payload.sessionId}-${payload.timestamp}`,
            sessionId: payload.sessionId,
            landingSiteId: site?.id || null,
            eventType: payload.eventType,
            targetElement: payload.target,
            clickX: payload.x,
            clickY: payload.y,
            timestamp: new Date(payload.timestamp),
            isFraud: riskScore >= 80,
            fraudScore: riskScore
          }
        });

        // 위험도 높으면 세션 업데이트
        if (riskScore >= 50) {
          await prisma.visitorSession.update({
            where: { id: payload.sessionId },
            data: {
              riskScore: { increment: riskScore },
              isBlocked: riskScore >= 100,
              blockReason: riskScore >= 100 ? '부정클릭 의심' : null
            }
          });
        }

        return NextResponse.json({
          success: true,
          riskScore,
          blocked: riskScore >= 100
        });
      }

      // ========== 전환 이벤트 ==========
      case 'conversion': {
        const site = await prisma.landingSite.findUnique({
          where: { slug: payload.siteId }
        });

        await prisma.clickEvent.create({
          data: {
            id: `conv-${payload.sessionId}-${payload.timestamp}`,
            sessionId: payload.sessionId,
            landingSiteId: site?.id || null,
            eventType: 'conversion',
            targetElement: payload.conversionType,
            timestamp: new Date(payload.timestamp),
            isFraud: false,
            fraudScore: 0
          }
        });

        return NextResponse.json({ success: true });
      }

      // ========== 커스텀 이벤트 ==========
      case 'custom': {
        console.log(`[Custom Event] ${payload.eventName}`, payload.properties);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown event type' }, { status: 400 });
    }

  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

// ========== 부정클릭 위험도 계산 ==========
async function calculateClickRisk(payload: TrackingPayload, ip: string): Promise<number> {
  let score = 0;

  // 1. 같은 핑거프린트의 최근 클릭 수 체크
  const recentClicks = await prisma.clickEvent.count({
    where: {
      sessionId: payload.sessionId,
      timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } // 5분 내
    }
  });

  if (recentClicks >= 3) score += 30;  // 5분 내 3회 이상
  if (recentClicks >= 5) score += 30;  // 5분 내 5회 이상

  // 2. 체류시간 체크 (체류시간 데이터 있으면)
  if (payload.dwellTimeBeforeConversion !== undefined) {
    if (payload.dwellTimeBeforeConversion < 3) score += 20;  // 3초 미만
  }

  // 3. 같은 IP에서 다른 핑거프린트로 클릭 (IP 변조 의심)
  const sameIPDifferentFP = await prisma.visitorSession.count({
    where: {
      ipAddress: ip,
      fingerprint: { not: payload.fingerprint },
      lastVisit: { gte: new Date(Date.now() - 60 * 60 * 1000) } // 1시간 내
    }
  });

  if (sameIPDifferentFP >= 3) score += 25;

  // 4. 블랙리스트 체크
  const blacklisted = await prisma.blacklist.findUnique({
    where: { fingerprint: payload.fingerprint }
  });

  if (blacklisted) score = 100;

  return Math.min(score, 100);
}

// OPTIONS (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
