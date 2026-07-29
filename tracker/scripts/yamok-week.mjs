import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SLUG = 'yamok-grandhill'
const DAYS = 7

const fmt = s => s == null ? 'N/A' : s < 60 ? `${s}초` : `${Math.floor(s/60)}분 ${s%60}초`

const site = await prisma.landingSite.findUnique({ where: { slug: SLUG } })
if (!site) { console.log('site 없음'); process.exit(0) }
console.log(`사이트: ${site.name} (${site.slug})`)

const since = new Date(Date.now() - DAYS*24*60*60*1000)
console.log(`기간: ${since.toISOString().slice(0,10)} ~ 오늘 (최근 ${DAYS}일)`)

// 세션
const sessions = await prisma.visitorSession.findMany({
  where: { landingSiteId: site.id, firstVisit: { gte: since } },
  orderBy: { firstVisit: 'desc' },
})
console.log(`\n=== 세션 ${sessions.length}건 ===`)
const dev = {}, ref = {}, daily = {}
let dwellSum = 0, dwellN = 0, blocked = 0, suspicious = 0
for (const s of sessions) {
  dev[s.deviceType||'?'] = (dev[s.deviceType||'?']||0)+1
  const r = s.referrerDomain || s.utmSource || '(직접)'
  ref[r] = (ref[r]||0)+1
  const d = s.firstVisit.toISOString().slice(0,10)
  daily[d] = (daily[d]||0)+1
  if (s.totalDwellTime > 0) { dwellSum += s.totalDwellTime; dwellN++ }
  if (s.isBlocked) blocked++
  if (s.isSuspicious) suspicious++
}
console.log('일별 세션:', JSON.stringify(daily))
console.log('디바이스:', JSON.stringify(dev))
console.log('유입경로:', JSON.stringify(ref))
console.log(`차단:${blocked} 의심:${suspicious}`)
console.log(`dwell>0 세션: ${dwellN}/${sessions.length}, 평균 ${dwellN?fmt(Math.round(dwellSum/dwellN)):'N/A'}`)
console.log('\n세션 목록:')
sessions.forEach(s=>console.log(`  ${s.firstVisit.toISOString().slice(0,16)} | ${s.deviceType||'?'} | dwell=${fmt(s.totalDwellTime)} | pv=${s.totalPageViews} | ${s.referrerDomain||s.utmSource||'직접'} | risk=${s.riskScore}${s.isBlocked?' [BLOCK]':''}${s.isSuspicious?' [의심]':''}`))

// 페이지뷰
const pvs = await prisma.pageView.findMany({
  where: { landingSiteId: site.id, enterTime: { gte: since } },
  orderBy: { enterTime: 'desc' },
})
console.log(`\n=== page_views ${pvs.length}건 ===`)
const wd = pvs.filter(p=>p.dwellTime!=null && p.dwellTime>0).map(p=>p.dwellTime).sort((a,b)=>a-b)
if (wd.length) {
  const avg = Math.round(wd.reduce((a,b)=>a+b,0)/wd.length)
  const med = wd[Math.floor(wd.length/2)]
  const bounce = pvs.filter(p=>(p.dwellTime||0)<5).length
  const scr = pvs.filter(p=>p.scrollDepth!=null)
  const scrAvg = scr.length ? Math.round(scr.reduce((a,p)=>a+p.scrollDepth,0)/scr.length) : null
  console.log(`dwell기록: ${wd.length}/${pvs.length} | 평균 ${fmt(avg)} | 중앙값 ${fmt(med)} | 최대 ${fmt(wd[wd.length-1])}`)
  console.log(`5초미만 이탈: ${bounce}/${pvs.length} (${Math.round(bounce/pvs.length*100)}%) | 평균스크롤 ${scrAvg!=null?scrAvg+'%':'N/A'}`)
} else if (pvs.length) {
  console.log('⚠️ dwell 기록된 page_view 없음')
}

// 클릭
const clicks = await prisma.clickEvent.findMany({
  where: { landingSiteId: site.id, timestamp: { gte: since } },
  orderBy: { timestamp: 'desc' },
})
console.log(`\n=== click_events ${clicks.length}건 ===`)
const byType = {}
clicks.forEach(c=>byType[c.eventType]=(byType[c.eventType]||0)+1)
console.log('타입별:', JSON.stringify(byType))
clicks.forEach(c=>console.log(`  ${c.timestamp.toISOString().slice(0,16)} | ${c.eventType} | 체류전=${fmt(c.dwellTimeBeforeClick)} | "${(c.targetText||'').slice(0,20)}"${c.isFraud?' [F]':''}`))

// 일별 통계
const ds = await prisma.dailyStats.findMany({ where:{landingSiteId:site.id, date:{gte:since}}, orderBy:{date:'desc'} })
console.log(`\n=== daily_stats ${ds.length}일 ===`)
ds.forEach(d=>console.log(`  ${d.date.toISOString().slice(0,10)} | 방문 ${d.uniqueVisitors} | PV ${d.totalPageViews} | 평균체류 ${fmt(d.avgDwellTime)} | 바운스 ${Math.round(d.bounceRate*100)}% | 네이버 ${d.naverAdVisits} 구글 ${d.googleAdVisits} 직접 ${d.directVisits}`))

await prisma.$disconnect()
