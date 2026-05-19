/**
 * onsia.city 적용 대상 랜딩사이트 시드
 *
 * 실행: tsx scripts/seed-onsia-sites.ts
 * 또는: npx ts-node scripts/seed-onsia-sites.ts
 *
 * DATABASE_URL_UNPOOLED(Supabase direct)를 환경변수로 지정한 뒤 실행 권장.
 * slug @unique 이므로 idempotent.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITES = [
  {
    slug: 'yamok-grandhill',
    name: '야목역 서희스타힐스 그랜드힐',
    description: '야목역세권 / GTX-F(예정) / 경기도 화성시 비봉면',
    cheongyakId: null as string | null,
  },
  {
    slug: 'urbanhomes',
    name: '왕십리 어반홈스',
    description: '왕십리 도시형생활주택',
    cheongyakId: null as string | null,
  },
];

async function main() {
  console.log('🌱 onsia 랜딩사이트 시드 시작\n');

  for (const site of SITES) {
    const result = await prisma.landingSite.upsert({
      where: { slug: site.slug },
      update: {
        name: site.name,
        description: site.description,
        cheongyakId: site.cheongyakId,
        isActive: true,
      },
      create: {
        slug: site.slug,
        name: site.name,
        description: site.description,
        cheongyakId: site.cheongyakId,
        isActive: true,
      },
    });

    console.log(`✅ ${result.slug} → id=${result.id} (${result.name})`);
  }

  const total = await prisma.landingSite.count();
  console.log(`\n📊 총 LandingSite 행 수: ${total}`);
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
