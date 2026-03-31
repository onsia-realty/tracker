import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.visitorSession.findUnique({
      where: { id },
      include: {
        landingSite: { select: { name: true, slug: true } },
        pageViews: {
          orderBy: { enterTime: 'desc' },
          select: {
            id: true,
            path: true,
            fullUrl: true,
            title: true,
            enterTime: true,
            exitTime: true,
            dwellTime: true,
            scrollDepth: true,
            scrollEvents: true,
            mouseMovements: true,
            clicks: true,
            exitType: true,
          },
        },
        clickEvents: {
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            eventType: true,
            targetUrl: true,
            targetText: true,
            timestamp: true,
            isFraud: true,
            fraudScore: true,
            fraudReason: true,
            dwellTimeBeforeClick: true,
            scrollDepthBeforeClick: true,
            mouseMovementsBeforeClick: true,
            adSource: true,
            adKeyword: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 같은 IP의 다른 세션 조회
    let sameIpSessions: Array<{
      id: string;
      fingerprint: string;
      lastVisit: Date;
      riskScore: number;
      isBlocked: boolean;
      deviceType: string | null;
      browser: string | null;
      _count: { pageViews: number };
    }> = [];

    if (session.ipAddress) {
      sameIpSessions = await prisma.visitorSession.findMany({
        where: {
          ipAddress: session.ipAddress,
          id: { not: id },
        },
        orderBy: { lastVisit: 'desc' },
        take: 10,
        select: {
          id: true,
          fingerprint: true,
          lastVisit: true,
          riskScore: true,
          isBlocked: true,
          deviceType: true,
          browser: true,
          _count: { select: { pageViews: true } },
        },
      });
    }

    // 블랙리스트 상태 확인
    let blacklistEntry = null;
    const bl = await prisma.blacklist.findFirst({
      where: {
        OR: [
          { fingerprint: session.fingerprint },
          ...(session.ipAddress ? [{ ipAddress: session.ipAddress }] : []),
        ],
      },
    });
    if (bl) {
      blacklistEntry = {
        id: bl.id,
        reason: bl.reason,
        createdAt: bl.createdAt,
        expiresAt: bl.expiresAt,
      };
    }

    return NextResponse.json({
      ...session,
      sameIpSessions,
      blacklistEntry,
    });
  } catch (error) {
    console.error('Visitor detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch visitor detail' }, { status: 500 });
  }
}
