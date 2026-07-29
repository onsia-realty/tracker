import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const KST = 9 * 60 * 60 * 1000
const nowKst = new Date(Date.now() + KST)
const yKst = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate() - 1))
const from = new Date(yKst.getTime() - KST)
const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)

const sites = await prisma.landingSite.findMany()
console.log('=== 어제(KST) 사이트별 세션 ===')
for (const s of sites) {
  const n = await prisma.visitorSession.count({ where: { landingSiteId: s.id, firstVisit: { gte: from, lt: to } } })
  const ad = await prisma.visitorSession.count({ where: { landingSiteId: s.id, firstVisit: { gte: from, lt: to }, referrerDomain: { contains: 'ad.search' } } })
  console.log(`  ${s.slug.padEnd(22)} | 총 ${String(n).padStart(3)}건 | 광고레퍼러 ${ad}건`)
}
console.log('\n=== 최근 14일 야목 광고레퍼러 추이 (KST일자) ===')
const site = await prisma.landingSite.findUnique({ where: { slug: 'yamok-grandhill' } })
const since = new Date(from.getTime() - 13 * 24 * 60 * 60 * 1000)
const rows = await prisma.visitorSession.findMany({
  where: { landingSiteId: site.id, firstVisit: { gte: since, lt: to } },
  select: { firstVisit: true, referrerDomain: true, totalDwellTime: true },
})
const d = {}
rows.forEach(r => {
  const k = new Date(r.firstVisit.getTime() + KST).toISOString().slice(0, 10)
  d[k] = d[k] || { all: 0, ad: 0, naver: 0, zero: 0 }
  d[k].all++
  if (/ad\.search\.naver/.test(r.referrerDomain || '')) d[k].ad++
  if (/search\.naver/.test(r.referrerDomain || '')) d[k].naver++
  if (!r.totalDwellTime) d[k].zero++
})
Object.keys(d).sort().forEach(k => console.log(`  ${k} | 총 ${String(d[k].all).padStart(3)} | 네이버전체 ${String(d[k].naver).padStart(2)} | 광고레퍼러 ${String(d[k].ad).padStart(2)} | 0초이탈 ${d[k].zero}`))
await prisma.$disconnect()
