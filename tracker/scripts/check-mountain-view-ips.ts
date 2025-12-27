/**
 * Mountain View 지역의 IP 주소 확인
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  const sessions = await prisma.visitorSession.findMany({
    where: {
      city: '마운틴뷰',
    },
    select: {
      id: true,
      ipAddress: true,
      city: true,
      country: true,
      userAgent: true,
      lastVisit: true,
    },
    orderBy: {
      lastVisit: 'desc',
    },
    take: 10,
  });

  console.log(`\n📍 Mountain View (마운틴뷰) IP 주소 분석:\n`);

  sessions.forEach((session) => {
    console.log(`IP: ${session.ipAddress || 'null'}`);
    console.log(`시간: ${session.lastVisit.toLocaleString('ko-KR')}`);
    console.log(`User-Agent: ${session.userAgent?.substring(0, 100) || 'null'}...`);
    console.log('---');
  });

  console.log(`\n총 ${sessions.length}개 세션`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
