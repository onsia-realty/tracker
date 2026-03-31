import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_IP = '220.117.73.250';

interface ThreatItem {
  type: 'fingerprint' | 'ip';
  value: string;
  score: number;
  reasons: string[];
  sessions: number;
  lastSeen: string;
  details: {
    ips?: string[];
    pages?: string[];
    avgDwell?: number;
    deviceType?: string;
    browser?: string;
    city?: string;
  };
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const threats: ThreatItem[] = [];

    // 1. 유령 방문이 많은 핑거프린트 찾기
    // (스크롤 0% + 마우스 0 + 체류 5초 이하인 페이지뷰)
    const ghostFingerprints = await prisma.$queryRaw<Array<{
      fingerprint: string;
      ghost_count: bigint;
      total_sessions: bigint;
      last_seen: Date;
      avg_dwell: number;
    }>>`
      SELECT
        vs.fingerprint,
        COUNT(DISTINCT pv.id) as ghost_count,
        COUNT(DISTINCT vs.id) as total_sessions,
        MAX(vs."lastVisit") as last_seen,
        COALESCE(AVG(vs."totalDwellTime"), 0) as avg_dwell
      FROM "VisitorSession" vs
      JOIN "PageView" pv ON pv."sessionId" = vs.id
      WHERE vs."lastVisit" >= ${thirtyDaysAgo}
        AND vs."isBlocked" = false
        AND vs."ipAddress" != ${ADMIN_IP}
        AND COALESCE(pv."dwellTime", 0) <= 5
        AND COALESCE(pv."scrollDepth", 0) < 5
        AND pv."mouseMovements" = 0
      GROUP BY vs.fingerprint
      HAVING COUNT(DISTINCT pv.id) >= 2
      ORDER BY COUNT(DISTINCT pv.id) DESC
      LIMIT 30
    `;

    for (const gf of ghostFingerprints) {
      let score = 0;
      const reasons: string[] = [];
      const ghostCount = Number(gf.ghost_count);
      const sessionCount = Number(gf.total_sessions);

      // 유령 방문 점수
      if (ghostCount >= 5) {
        score += 60;
        reasons.push(`유령 방문 ${ghostCount}회 (0초/0스크롤)`);
      } else if (ghostCount >= 3) {
        score += 40;
        reasons.push(`유령 방문 ${ghostCount}회`);
      } else {
        score += 20;
        reasons.push(`유령 방문 ${ghostCount}회`);
      }

      // 세션 정보 조회
      const sessions = await prisma.visitorSession.findMany({
        where: { fingerprint: gf.fingerprint, lastVisit: { gte: thirtyDaysAgo } },
        select: { ipAddress: true, deviceType: true, browser: true, city: true, isProxy: true, isVpn: true },
      });

      // IP 호핑 체크
      const uniqueIPs = [...new Set(sessions.map(s => s.ipAddress).filter(Boolean))] as string[];
      if (uniqueIPs.length >= 3) {
        score += 25;
        reasons.push(`IP ${uniqueIPs.length}개 사용 (IP 변경)`);
      } else if (uniqueIPs.length >= 2) {
        score += 10;
        reasons.push(`IP ${uniqueIPs.length}개 사용`);
      }

      // Proxy/VPN 체크
      const hasProxy = sessions.some(s => s.isProxy || s.isVpn);
      if (hasProxy) {
        score += 25;
        reasons.push('프록시/VPN 사용');
      }

      // 접속 페이지 조회
      const pageViews = await prisma.pageView.findMany({
        where: { session: { fingerprint: gf.fingerprint } },
        select: { path: true },
        distinct: ['path'],
        take: 5,
      });

      if (score >= 40) {
        threats.push({
          type: 'fingerprint',
          value: gf.fingerprint,
          score: Math.min(score, 100),
          reasons,
          sessions: sessionCount,
          lastSeen: gf.last_seen.toISOString(),
          details: {
            ips: uniqueIPs.slice(0, 5),
            pages: pageViews.map(p => p.path),
            avgDwell: Math.round(gf.avg_dwell),
            deviceType: sessions[0]?.deviceType || undefined,
            browser: sessions[0]?.browser || undefined,
            city: sessions[0]?.city || undefined,
          },
        });
      }
    }

    // 2. Proxy/VPN + 저관여 IP 찾기
    const proxyIPs = await prisma.visitorSession.groupBy({
      by: ['ipAddress'],
      where: {
        lastVisit: { gte: thirtyDaysAgo },
        isBlocked: false,
        ipAddress: { not: ADMIN_IP },
        OR: [{ isProxy: true }, { isVpn: true }],
      },
      _count: true,
      _avg: { totalDwellTime: true },
      _max: { lastVisit: true },
      having: { ipAddress: { _count: { gte: 2 } } },
      orderBy: { _count: { ipAddress: 'desc' } },
      take: 10,
    });

    for (const pip of proxyIPs) {
      if (!pip.ipAddress) continue;
      // 이미 핑거프린트 위협으로 잡힌 IP 스킵
      const alreadyCovered = threats.some(t => t.details.ips?.includes(pip.ipAddress!));
      if (alreadyCovered) continue;

      let score = 30; // 프록시 기본 점수
      const reasons = ['프록시/VPN IP'];

      const avgDwell = Math.round(pip._avg?.totalDwellTime || 0);
      if (avgDwell <= 5) {
        score += 30;
        reasons.push(`평균 체류 ${avgDwell}초`);
      }

      if (pip._count >= 3) {
        score += 20;
        reasons.push(`${pip._count}회 접속`);
      }

      if (score >= 40) {
        threats.push({
          type: 'ip',
          value: pip.ipAddress,
          score: Math.min(score, 100),
          reasons,
          sessions: pip._count,
          lastSeen: pip._max?.lastVisit?.toISOString() || '',
          details: {
            avgDwell,
          },
        });
      }
    }

    // 점수 높은 순 정렬, 상위 20개
    threats.sort((a, b) => b.score - a.score);

    return NextResponse.json({ threats: threats.slice(0, 20) });
  } catch (error) {
    console.error('Threats API error:', error);
    return NextResponse.json({ threats: [] });
  }
}
