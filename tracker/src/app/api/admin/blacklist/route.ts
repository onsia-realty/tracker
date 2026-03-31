import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 블랙리스트 목록 조회
export async function GET() {
  try {
    const blacklist = await prisma.blacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 각 블랙리스트 항목에 관련 세션 수 추가
    const data = await Promise.all(
      blacklist.map(async (entry) => {
        const sessionCount = await prisma.visitorSession.count({
          where: {
            OR: [
              ...(entry.fingerprint ? [{ fingerprint: entry.fingerprint }] : []),
              ...(entry.ipAddress ? [{ ipAddress: entry.ipAddress }] : []),
            ],
          },
        });

        return {
          ...entry,
          isExpired: entry.expiresAt ? entry.expiresAt < new Date() : false,
          sessionCount,
        };
      })
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('Blacklist GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch blacklist' }, { status: 500 });
  }
}

// IP/핑거프린트 차단
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fingerprint, ipAddress, reason, duration } = body;

    if (!fingerprint && !ipAddress) {
      return NextResponse.json({ error: 'fingerprint 또는 ipAddress 필요' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: '차단 사유 필요' }, { status: 400 });
    }

    // 만료일 계산
    let expiresAt: Date | null = null;
    if (duration && duration !== 'permanent') {
      const days = parseInt(duration);
      if (!isNaN(days)) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }

    // 블랙리스트 추가/업데이트
    let entry;
    if (fingerprint) {
      entry = await prisma.blacklist.upsert({
        where: { fingerprint },
        create: {
          fingerprint,
          ipAddress: ipAddress || null,
          reason,
          expiresAt,
        },
        update: {
          ipAddress: ipAddress || undefined,
          reason,
          expiresAt,
        },
      });
    } else {
      // IP만으로 차단 (fingerprint 없는 경우)
      const existing = await prisma.blacklist.findFirst({ where: { ipAddress } });
      if (existing) {
        entry = await prisma.blacklist.update({
          where: { id: existing.id },
          data: { reason, expiresAt },
        });
      } else {
        entry = await prisma.blacklist.create({
          data: {
            ipAddress,
            reason,
            expiresAt,
          },
        });
      }
    }

    // 관련 세션들의 isBlocked 업데이트
    const sessionWhere: Record<string, unknown>[] = [];
    if (fingerprint) sessionWhere.push({ fingerprint });
    if (ipAddress) sessionWhere.push({ ipAddress });

    if (sessionWhere.length > 0) {
      await prisma.visitorSession.updateMany({
        where: { OR: sessionWhere },
        data: {
          isBlocked: true,
          blockReason: `수동 차단: ${reason}`,
          blockedAt: new Date(),
        },
      });
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Blacklist POST error:', error);
    return NextResponse.json({ error: 'Failed to add to blacklist' }, { status: 500 });
  }
}

// 차단 해제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids'); // 벌크 삭제용

    if (!id && !ids) {
      return NextResponse.json({ error: 'id 또는 ids 필요' }, { status: 400 });
    }

    const targetIds = ids ? ids.split(',') : [id!];

    // 삭제 전에 관련 정보 조회
    const entries = await prisma.blacklist.findMany({
      where: { id: { in: targetIds } },
    });

    // 블랙리스트에서 삭제
    await prisma.blacklist.deleteMany({
      where: { id: { in: targetIds } },
    });

    // 관련 세션들의 차단 상태 해제
    for (const entry of entries) {
      const sessionWhere: Record<string, unknown>[] = [];
      if (entry.fingerprint) sessionWhere.push({ fingerprint: entry.fingerprint });
      if (entry.ipAddress) sessionWhere.push({ ipAddress: entry.ipAddress });

      if (sessionWhere.length > 0) {
        // 다른 블랙리스트 항목으로 여전히 차단되는지 확인
        const otherBlocks = await prisma.blacklist.findFirst({
          where: {
            id: { notIn: targetIds },
            OR: sessionWhere,
          },
        });

        if (!otherBlocks) {
          await prisma.visitorSession.updateMany({
            where: { OR: sessionWhere },
            data: {
              isBlocked: false,
              blockReason: null,
              blockedAt: null,
            },
          });
        }
      }
    }

    return NextResponse.json({ deleted: targetIds.length });
  } catch (error) {
    console.error('Blacklist DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove from blacklist' }, { status: 500 });
  }
}
