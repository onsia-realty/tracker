import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SLUG = 'yamok-grandhill'

// KST(UTC+9) 기준 어제 00:00 ~ 24:00 → UTC 범위로 환산
const KST = 9 * 60 * 60 * 1000
const nowKst = new Date(Date.now() + KST)
const yKst = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate() - 1))
const from = new Date(yKst.getTime() - KST)
const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)
const kst = d => new Date(d.getTime() + KST).toISOString().slice(0, 16).replace('T', ' ')
const fmt = s => s == null ? 'N/A' : s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`

const site = await prisma.landingSite.findUnique({ where: { slug: SLUG } })
console.log(`■ ${site.name} — 어제 KST ${kst(from)} ~ ${kst(to)}\n`)

const sessions = await prisma.visitorSession.findMany({
  where: { landingSiteId: site.id, firstVisit: { gte: from, lt: to } },
  orderBy: { firstVisit: 'asc' },
})

// 네이버 광고 유입 판별: utm 또는 ad.search.naver 레퍼러
const isAd = s => /ad\.search\.naver/.test(s.referrerDomain || '') ||
  /naver/i.test(s.utmSource || '') || (s.utmMedium || '').length > 0
const isNsaBot = s => /navercorp\.com$/.test(s.referrerDomain || '')

console.log(`총 세션 ${sessions.length}건`)
console.log(`  네이버 광고 추정: ${sessions.filter(isAd).length}건`)
console.log(`  네이버 내부검수봇(navercorp): ${sessions.filter(isNsaBot).length}건`)
console.log(`  dwell 0초(즉시이탈): ${sessions.filter(s => !s.totalDwellTime).length}건`)
console.log(`  의심: ${sessions.filter(s => s.isSuspicious).length} / 차단: ${sessions.filter(s => s.isBlocked).length}\n`)

console.log('=== 세션 상세 (KST) ===')
for (const s of sessions) {
  const tag = [isAd(s) && '[광고]', isNsaBot(s) && '[네이버봇]', s.isSuspicious && '[의심]', s.isBlocked && '[차단]'].filter(Boolean).join('')
  console.log(`${kst(s.firstVisit)} | ${(s.deviceType || '?').padEnd(7)} | IP ${(s.ipAddress || '?').padEnd(15)} | fp ${(s.fingerprint || '').slice(0, 10)} | ${(s.region || '')}${s.city ? '/' + s.city : ''} | dwell ${fmt(s.totalDwellTime).padEnd(9)} | pv${s.totalPageViews} | risk ${s.riskScore} | ${s.referrerDomain || s.utmSource || '직접'} ${tag}`)
}

// IP 중복
const byIp = {}, byFp = {}
sessions.forEach(s => {
  byIp[s.ipAddress || '?'] = (byIp[s.ipAddress || '?'] || 0) + 1
  byFp[s.fingerprint || '?'] = (byFp[s.fingerprint || '?'] || 0) + 1
})
const dupIp = Object.entries(byIp).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])
const dupFp = Object.entries(byFp).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])
console.log(`\n=== 중복 IP (2회+) ===`)
dupIp.length ? dupIp.forEach(([ip, n]) => console.log(`  ${ip} : ${n}회`)) : console.log('  없음')
console.log(`=== 중복 핑거프린트 (2회+) ===`)
dupFp.length ? dupFp.forEach(([fp, n]) => console.log(`  ${fp.slice(0, 16)} : ${n}회`)) : console.log('  없음')

// UTM 원본
console.log(`\n=== UTM 파라미터 있는 세션 ===`)
const utms = sessions.filter(s => s.utmSource || s.utmMedium || s.utmCampaign || s.utmTerm)
utms.length ? utms.forEach(s => console.log(`  ${kst(s.firstVisit)} | src=${s.utmSource} med=${s.utmMedium} camp=${s.utmCampaign} term=${s.utmTerm} content=${s.utmContent}`)) : console.log('  없음 ← 광고 URL에 UTM 미설정이면 광고/자연 구분 불가')

// 클릭
const clicks = await prisma.clickEvent.findMany({
  where: { landingSiteId: site.id, timestamp: { gte: from, lt: to } },
  orderBy: { timestamp: 'asc' },
})
console.log(`\n=== 클릭 ${clicks.length}건 ===`)
clicks.forEach(c => console.log(`  ${kst(c.timestamp)} | ${c.eventType} | 체류전 ${fmt(c.dwellTimeBeforeClick)} | "${(c.targetText || '').slice(0, 24)}"${c.isFraud ? ' [F]' : ''}`))

// 어제 daily_stats
const ds = await prisma.dailyStats.findMany({ where: { landingSiteId: site.id, date: { gte: from, lt: to } } })
console.log(`\n=== daily_stats ===`)
ds.forEach(d => console.log(`  ${d.date.toISOString().slice(0, 10)} | 방문 ${d.uniqueVisitors} | PV ${d.totalPageViews} | 네이버광고 ${d.naverAdVisits} | 구글광고 ${d.googleAdVisits} | 직접 ${d.directVisits}`))

await prisma.$disconnect()
