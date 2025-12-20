// app/api/track/route.ts
// 방문자 추적 데이터 수신 API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Prisma 클라이언트

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

// User-Agent 파싱 (간단 버전)
function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  // 브라우저 감지
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  // OS 감지
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'MacOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // 디바이스 타입
  if (ua.includes('Mobile') || ua.includes('Android')) deviceType = 'mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) deviceType = 'tablet';

  return { browser, os, deviceType };
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrackingPayload = await request.json();
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // 이벤트 타입별 처리
    switch (payload.eventType) {
      // ========== 세션 시작 ==========
      case 'session_start': {
        await prisma.visitor_sessions.upsert({
          where: { id: payload.sessionId },
          update: {
            fingerprint: payload.fingerprint,
            last_visit: new Date(),
            visit_count: { increment: 1 }
          },
          create: {
            id: payload.sessionId,
            fingerprint: payload.fingerprint,
            ip_address: clientIP,
            user_agent: userAgent,
            device_type: deviceType,
            browser,
            os,
            referrer: payload.referrer || null,
            utm_source: payload.utm?.utm_source || null,
            utm_medium: payload.utm?.utm_medium || null,
            utm_campaign: payload.utm?.utm_campaign || null,
            utm_content: payload.utm?.utm_content || null,
            landing_site: payload.siteId,
            first_visit: new Date(),
            last_visit: new Date(),
            visit_count: 1,
            risk_score: 0,
            is_blocked: false
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
        await prisma.page_views.create({
          data: {
            id: payload.pageviewId,
            session_id: payload.sessionId,
            landing_site: payload.siteId,
            path: payload.path,
            title: payload.title,
            enter_time: new Date(),
            dwell_time: 0,
            scroll_depth: 0,
            mouse_movements: 0,
            clicks: 0
          }
        });

        return NextResponse.json({ success: true });
      }

      // ========== 하트비트 (체류시간 업데이트) ==========
      case 'heartbeat': {
        if (payload.pageviewId) {
          await prisma.page_views.update({
            where: { id: payload.pageviewId },
            data: {
              dwell_time: payload.dwellTime,
              scroll_depth: payload.maxScrollDepth,
              mouse_movements: payload.mouseMovements,
              clicks: payload.clickCount
            }
          });
        }

        // 세션 마지막 활동 시간 업데이트
        await prisma.visitor_sessions.update({
          where: { id: payload.sessionId },
          data: { last_visit: new Date() }
        });

        return NextResponse.json({ success: true });
      }

      // ========== 페이지뷰 종료 ==========
      case 'pageview_end': {
        await prisma.page_views.update({
          where: { id: payload.pageviewId },
          data: {
            exit_time: new Date(),
            dwell_time: payload.dwellTime,
            scroll_depth: payload.maxScrollDepth,
            mouse_movements: payload.mouseMovements,
            clicks: payload.clickCount
          }
        });

        // 중요 클릭 이벤트 저장
        if (payload.clicks && payload.clicks.length > 0) {
          await prisma.click_events.createMany({
            data: payload.clicks.map((click: any) => ({
              id: `${payload.pageviewId}-${click.timestamp}`,
              session_id: payload.sessionId,
              landing_site: payload.siteId,
              event_type: click.eventType,
              target_element: click.target,
              click_x: click.x,
              click_y: click.y,
              timestamp: new Date(click.timestamp),
              is_fraud: false,
              risk_score: 0
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

        await prisma.click_events.create({
          data: {
            id: `${payload.sessionId}-${payload.timestamp}`,
            session_id: payload.sessionId,
            landing_site: payload.siteId,
            event_type: payload.eventType,
            target_element: payload.target,
            click_x: payload.x,
            click_y: payload.y,
            timestamp: new Date(payload.timestamp),
            is_fraud: riskScore >= 80,
            risk_score: riskScore
          }
        });

        // 위험도 높으면 세션 업데이트
        if (riskScore >= 50) {
          await prisma.visitor_sessions.update({
            where: { id: payload.sessionId },
            data: { 
              risk_score: { increment: riskScore },
              is_blocked: riskScore >= 100,
              block_reason: riskScore >= 100 ? '부정클릭 의심' : null
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
        await prisma.click_events.create({
          data: {
            id: `conv-${payload.sessionId}-${payload.timestamp}`,
            session_id: payload.sessionId,
            landing_site: payload.siteId,
            event_type: 'conversion',
            target_element: payload.conversionType,
            timestamp: new Date(payload.timestamp),
            is_fraud: false,
            risk_score: 0
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
  const recentClicks = await prisma.click_events.count({
    where: {
      session_id: payload.sessionId,
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
  const sameIPDifferentFP = await prisma.visitor_sessions.count({
    where: {
      ip_address: ip,
      fingerprint: { not: payload.fingerprint },
      last_visit: { gte: new Date(Date.now() - 60 * 60 * 1000) } // 1시간 내
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
