import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const KST = 9 * 60 * 60 * 1000
const kst = d => new Date(d.getTime() + KST).toISOString().slice(0, 16).replace('T', ' ')
const IP = '211.34.166.201'
const APPLY = process.argv.includes('--apply')

// 어제(KST) 해당 IP 세션
const nowKst = new Date(Date.now() + KST)
const yKst = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate() - 1))
const from = new Date(yKst.getTime() - KST)
const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)

const ss = await prisma.visitorSession.findMany({
  where: { ipAddress: IP, firstVisit: { gte: from, lt: to } },
  orderBy: { firstVisit: 'asc' },
})

console.log(`■ ${IP} 어제 세션 ${ss.length}건`)
ss.forEach(s => console.log(`  ${kst(s.firstVisit)} | fp=${s.fingerprint} | dwell ${s.totalDwellTime}s | pv${s.totalPageViews} | ${s.referrerDomain || '직접'}`))

const fps = [...new Set(ss.map(s => s.fingerprint))]
console.log(`\n고유 핑거프린트 ${fps.length}개: ${fps.join(', ')}`)

if (!APPLY) {
  console.log('\n[미리보기] --apply 붙이면 실제 차단 등록')
  await prisma.$disconnect()
  process.exit(0)
}

const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
for (const fp of fps) {
  const n = ss.filter(s => s.fingerprint === fp).length
  const r = await prisma.blacklist.upsert({
    where: { fingerprint: fp },
    create: {
      fingerprint: fp,
      ipAddress: IP,
      reason: '수동 차단 (운영자 지시)',
      evidence: `2026-07-26 KST ${IP}에서 ${n}회 방문 / 안산 / 총 ${ss.length}세션`,
      expiresAt,
    },
    update: { ipAddress: IP, reason: '수동 차단 (운영자 지시)', expiresAt },
  })
  console.log(`✅ 차단 등록: ${fp} (만료 ${kst(expiresAt)} KST)`)
}

console.log('\n■ 현재 블랙리스트')
const bl = await prisma.blacklist.findMany({ orderBy: { createdAt: 'desc' } })
bl.forEach(b => console.log(`  ${kst(b.createdAt)} | fp=${b.fingerprint} | ip=${b.ipAddress} | ${b.reason} | 만료 ${b.expiresAt ? kst(b.expiresAt) : '없음'}`))

await prisma.$disconnect()
