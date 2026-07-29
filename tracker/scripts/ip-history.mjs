import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const KST = 9 * 60 * 60 * 1000
const kst = d => new Date(d.getTime() + KST).toISOString().slice(0, 16).replace('T', ' ')
const IP = process.argv[2] || '211.34.166.201'

console.log(`■ IP ${IP} 전체 이력\n`)
const ss = await prisma.visitorSession.findMany({
  where: { ipAddress: IP },
  orderBy: { firstVisit: 'asc' },
  include: { landingSite: { select: { slug: true } } },
})
console.log(`세션 ${ss.length}건`)
ss.forEach(s => console.log(`  ${kst(s.firstVisit)} KST | ${s.landingSite?.slug} | ${s.deviceType} | fp ${(s.fingerprint || '').slice(0, 12)} | dwell ${s.totalDwellTime}s | pv${s.totalPageViews} | risk ${s.riskScore}${s.isBlocked ? ' [BLOCKED]' : ''}${s.isSuspicious ? ' [의심]' : ''} | ${s.referrerDomain || '직접'}`))

console.log(`\n■ 블랙리스트 전체`)
const bl = await prisma.blacklist.findMany({ orderBy: { createdAt: 'desc' } })
if (!bl.length) console.log('  (비어있음) ← 트래커가 자동 차단한 대상 없음')
bl.forEach(b => console.log(`  ${kst(b.createdAt)} KST | ip=${b.ipAddress || '-'} | fp=${(b.fingerprint || '-').slice(0, 14)} | ${JSON.stringify(b).slice(0, 200)}`))

console.log(`\n■ SMS 알림 발송 이력`)
const fa = await prisma.fraudAlertLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
if (!fa.length) console.log('  (없음)')
fa.forEach(f => console.log(`  ${kst(f.createdAt)} KST | ip=${f.ipAddress} | risk=${f.riskScore}`))

await prisma.$disconnect()
