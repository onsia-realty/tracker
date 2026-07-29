import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SLUG = 'yamok-grandhill'
const DAYS = 7

const site = await prisma.landingSite.findUnique({ where: { slug: SLUG } })
const since = new Date(Date.now() - DAYS*24*60*60*1000)

const sessions = await prisma.visitorSession.findMany({
  where: { landingSiteId: site.id, firstVisit: { gte: since } },
  orderBy: { firstVisit: 'asc' },
})
console.log(`최근 ${DAYS}일 세션 ${sessions.length}건\n`)

// IP별 그룹
const byIp = {}
for (const s of sessions) {
  const ip = s.ipAddress || '(no-ip)'
  ;(byIp[ip] ||= []).push(s)
}
console.log('=== IP별 세션 수 (2회 이상만) ===')
const dupes = Object.entries(byIp).filter(([,v])=>v.length>=2).sort((a,b)=>b[1].length-a[1].length)
for (const [ip, list] of dupes) {
  const first = list[0]
  console.log(`\n■ ${ip} — ${list.length}회 | ${first.isp||'?'} | ${first.city||'?'} ${first.region||''} | vpn=${first.isVpn} proxy=${first.isProxy}`)
  list.forEach(s=>console.log(`   ${s.firstVisit.toISOString().slice(0,16)} | ${s.deviceType||'?'} ${s.deviceVendor||''} ${s.deviceModel||''} | ${s.browser||'?'} ${s.os||''} | fp=${s.fingerprint.slice(0,10)} | visit_count=${s.visitCount} | ${s.referrerDomain||s.utmSource||'직접'}`))
}
if (!dupes.length) console.log('  중복 IP 없음')

// fingerprint별 그룹 (같은 기기)
const byFp = {}
for (const s of sessions) (byFp[s.fingerprint] ||= []).push(s)
console.log('\n=== 같은 기기(fingerprint) 세션 수 (2회 이상만) ===')
const fpDupes = Object.entries(byFp).filter(([,v])=>v.length>=2).sort((a,b)=>b[1].length-a[1].length)
for (const [fp, list] of fpDupes) {
  const f = list[0]
  console.log(`\n■ fp=${fp.slice(0,16)}... — ${list.length}회 | ${f.deviceType||'?'} ${f.deviceVendor||''} ${f.deviceModel||''} ${f.browser||''} ${f.os||''}`)
  list.forEach(s=>console.log(`   ${s.firstVisit.toISOString().slice(0,16)} | ip=${s.ipAddress||'?'} | visit_count=${s.visitCount} | ${s.referrerDomain||s.utmSource||'직접'}`))
}
if (!fpDupes.length) console.log('  중복 기기 없음')

// visitCount 자체가 높은 세션 (같은 세션 재방문)
console.log('\n=== visit_count 2 이상 세션 ===')
const rev = sessions.filter(s=>s.visitCount>=2).sort((a,b)=>b.visitCount-a.visitCount)
rev.forEach(s=>console.log(`  ${s.firstVisit.toISOString().slice(0,16)}~${s.lastVisit.toISOString().slice(0,16)} | ${s.visitCount}회 | ip=${s.ipAddress||'?'} | ${s.deviceType} ${s.deviceModel||''} | ${s.referrerDomain||'직접'}`))
if (!rev.length) console.log('  없음')

await prisma.$disconnect()
