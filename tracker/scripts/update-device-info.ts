// 기존 데이터의 디바이스 정보 업데이트
import { PrismaClient } from '@prisma/client';
import { parseUserAgent } from '../src/lib/userAgentParser';

const prisma = new PrismaClient();

async function updateDeviceInfo() {
  console.log('📱 기존 데이터 디바이스 정보 업데이트 시작...\n');

  // 모든 세션 조회
  const sessions = await prisma.visitorSession.findMany({
    where: {
      userAgent: { not: null }
    },
    select: {
      id: true,
      userAgent: true,
      deviceVendor: true,
      deviceModel: true
    }
  });

  console.log(`총 ${sessions.length}개 세션 발견\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    if (!session.userAgent) {
      skippedCount++;
      continue;
    }

    // User-Agent 파싱
    const deviceInfo = parseUserAgent(session.userAgent);

    // 이미 업데이트된 경우 스킵
    if (session.deviceVendor && session.deviceModel) {
      console.log(`⏭️  ${session.id.substring(0, 8)}... - 이미 업데이트됨 (${session.deviceModel})`);
      skippedCount++;
      continue;
    }

    // 업데이트
    await prisma.visitorSession.update({
      where: { id: session.id },
      data: {
        deviceType: deviceInfo.deviceType,
        deviceVendor: deviceInfo.deviceVendor,
        deviceModel: deviceInfo.deviceModel,
        browserVersion: deviceInfo.browserVersion,
        osVersion: deviceInfo.osVersion
      }
    });

    updatedCount++;
    console.log(`✅ ${session.id.substring(0, 8)}... - ${deviceInfo.deviceModel} (${deviceInfo.browser} · ${deviceInfo.os})`);
  }

  console.log(`\n📊 업데이트 완료!`);
  console.log(`   - 업데이트됨: ${updatedCount}개`);
  console.log(`   - 건너뜀: ${skippedCount}개`);
  console.log(`   - 총: ${sessions.length}개`);

  await prisma.$disconnect();
}

updateDeviceInfo().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
