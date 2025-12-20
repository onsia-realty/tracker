// 실제 데이터 확인 스크립트
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('📊 데이터베이스 확인 중...\n');

  // 1. 사이트 목록
  const sites = await prisma.landingSite.findMany();
  console.log(`🏢 사이트: ${sites.length}개`);
  sites.forEach(site => {
    console.log(`   - ${site.name} (${site.slug})`);
  });

  // 2. 방문자 세션
  const sessions = await prisma.visitorSession.findMany({
    take: 10,
    orderBy: { lastVisit: 'desc' },
    include: {
      landingSite: true
    }
  });
  console.log(`\n👥 방문자 세션: ${sessions.length}개 (최근 10개)`);
  sessions.forEach(session => {
    const deviceName = session.deviceModel || session.deviceType || 'Unknown';
    const browserInfo = session.browserVersion
      ? `${session.browser} ${session.browserVersion.split('.')[0]}`
      : session.browser;
    const osInfo = session.osVersion
      ? `${session.os} ${session.osVersion.split('.')[0]}`
      : session.os;

    console.log(`   - ${deviceName} | ${browserInfo} · ${osInfo} | ${session.city || '지역 미확인'} | ${session.landingSite?.name || '미분류'}`);
  });

  // 3. 페이지뷰
  const pageViews = await prisma.pageView.findMany({
    take: 5,
    orderBy: { enterTime: 'desc' }
  });
  console.log(`\n📄 페이지뷰: ${pageViews.length}개 (최근 5개)`);
  pageViews.forEach(pv => {
    console.log(`   - ${pv.path} | 체류시간: ${pv.dwellTime}초 | 스크롤: ${pv.scrollDepth}%`);
  });

  // 4. 클릭 이벤트
  const clicks = await prisma.clickEvent.findMany({
    take: 5,
    orderBy: { timestamp: 'desc' }
  });
  console.log(`\n🖱️ 클릭 이벤트: ${clicks.length}개 (최근 5개)`);
  clicks.forEach(click => {
    console.log(`   - ${click.eventType} | 부정클릭 점수: ${click.fraudScore}점 | ${click.isFraud ? '⚠️ 부정클릭' : '✅ 정상'}`);
  });

  console.log('\n✅ 확인 완료!');

  await prisma.$disconnect();
}

checkData().catch(console.error);
