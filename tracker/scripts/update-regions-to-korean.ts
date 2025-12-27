/**
 * 기존 DB의 영어 지역명을 한글로 일괄 변경
 *
 * 실행 방법:
 * npx tsx scripts/update-regions-to-korean.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// 영어 → 한글 매핑
const cityMapping: Record<string, string> = {
  'Mountain View': '마운틴뷰',
  'Suwon': '수원',
  'Seoul': '서울',
  'Busan': '부산',
  'Incheon': '인천',
  'Daegu': '대구',
  'Daejeon': '대전',
  'Gwangju': '광주',
  'Ulsan': '울산',
  'Sejong': '세종',
  'Seongnam': '성남',
  'Seongnam-si': '성남',
  'Goyang': '고양',
  'Yongin': '용인',
  'Yongin-si': '용인',
  'Changwon': '창원',
  'Hwaseong': '화성',
  'Hwaseong-si': '화성',
  'Naju': '나주',
  'Ansan': '안산',
  'Ansan-si': '안산',
  'Anyang': '안양',
  'Pohang': '포항',
  'Uijeongbu': '의정부',
  'Siheung': '시흥',
  'Paju': '파주',
  'Gimpo': '김포',
  'Pyeongtaek': '평택',
  'Gimhae': '김해',
  'Jinju': '진주',
  'Cheonan': '천안',
  'Asan': '아산',
  'Jeonju': '전주',
  'Cheongju': '청주',
  'Iksan': '익산',
  'Jeju': '제주',
  'Gunpo': '군포',
  'Gwangmyeong': '광명',
  'Hanam': '하남',
  // 서울 구
  'Gangnam-gu': '강남구',
  'Gangdong-gu': '강동구',
  'Gangbuk-gu': '강북구',
  'Gangseo-gu': '강서구',
  'Gwanak-gu': '관악구',
  'Gwangjin-gu': '광진구',
  'Guro-gu': '구로구',
  'Geumcheon-gu': '금천구',
  'Nowon-gu': '노원구',
  'Dobong-gu': '도봉구',
  'Dongdaemun-gu': '동대문구',
  'Dongjak-gu': '동작구',
  'Mapo-gu': '마포구',
  'Seodaemun-gu': '서대문구',
  'Seocho-gu': '서초구',
  'Seongdong-gu': '성동구',
  'Seongbuk-gu': '성북구',
  'Songpa-gu': '송파구',
  'Yangcheon-gu': '양천구',
  'Yeongdeungpo-gu': '영등포구',
  'Yongsan-gu': '용산구',
  'Eunpyeong-gu': '은평구',
  'Jongno-gu': '종로구',
  'Jung-gu': '중구',
  'Jungnang-gu': '중랑구',
};

const regionMapping: Record<string, string> = {
  'Seoul': '서울특별시',
  'Busan': '부산광역시',
  'Incheon': '인천광역시',
  'Daegu': '대구광역시',
  'Daejeon': '대전광역시',
  'Gwangju': '광주광역시',
  'Ulsan': '울산광역시',
  'Sejong': '세종특별자치시',
  'Gyeonggi-do': '경기도',
  'Gangwon-do': '강원도',
  'North Chungcheong': '충청북도',
  'South Chungcheong': '충청남도',
  'North Jeolla': '전라북도',
  'South Jeolla': '전라남도',
  'North Gyeongsang': '경상북도',
  'South Gyeongsang': '경상남도',
  'Jeju-do': '제주특별자치도',
  'California': '캘리포니아',
};

const countryMapping: Record<string, string> = {
  'Korea': '대한민국',
  'South Korea': '대한민국',
  'United States': '미국',
  'Japan': '일본',
  'China': '중국',
  'Taiwan': '대만',
  'Hong Kong': '홍콩',
  'Singapore': '싱가포르',
  'Vietnam': '베트남',
  'Thailand': '태국',
};

async function main() {
  console.log('🔄 기존 DB 지역명을 한글로 변경 중...\n');

  // 1. 모든 세션 조회
  const sessions = await prisma.visitorSession.findMany({
    select: {
      id: true,
      city: true,
      region: true,
      country: true,
    },
  });

  console.log(`📊 총 ${sessions.length}개 세션 발견\n`);

  let updateCount = 0;

  // 2. 각 세션별로 업데이트
  for (const session of sessions) {
    const updates: {
      city?: string;
      region?: string;
      country?: string;
    } = {};

    // city 변환
    if (session.city && cityMapping[session.city]) {
      updates.city = cityMapping[session.city];
    }

    // region 변환
    if (session.region && regionMapping[session.region]) {
      updates.region = regionMapping[session.region];
    }

    // country 변환
    if (session.country && countryMapping[session.country]) {
      updates.country = countryMapping[session.country];
    }

    // 변경사항이 있으면 업데이트
    if (Object.keys(updates).length > 0) {
      await prisma.visitorSession.update({
        where: { id: session.id },
        data: updates,
      });

      console.log(`✅ ${session.id.substring(0, 8)}: ${session.city || '-'} → ${updates.city || session.city || '-'}`);
      updateCount++;
    }
  }

  console.log(`\n✨ 완료! ${updateCount}개 세션 업데이트됨`);
}

main()
  .catch((error) => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
