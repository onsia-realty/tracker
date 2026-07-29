import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const KST = 9 * 60 * 60 * 1000
const kst = d => new Date(d.getTime() + KST).toISOString().slice(0, 16).replace('T', ' ')
const DAYS = Number(process.argv[2] || 14)

const site = await prisma.landingSite.findUnique({ where: { slug: 'yamok-grandhill' } })
const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)

const ss = await prisma.visitorSession.findMany({
  where: { landingSiteId: site.id, firstVisit: { gte: since } },
  orderBy: { firstVisit: 'asc' },
})

// 레퍼러 URL에서 검색어 추출 (네이버 query / 다음 q / 구글 q)
const kwOf = r => {
  if (!r) return null
  try {
    const u = new URL(r)
    for (const k of ['query', 'q', 'keyword', 'where']) {
      const v = u.searchParams.get(k)
      if (v && k !== 'where') return decodeURIComponent(v)
    }
  } catch { }
  const m = (r || '').match(/[?&](?:query|q)=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

const isAd = s => /ad\.search\.naver/.test(s.referrerDomain || '')

console.log(`■ 야목 랜딩 최근 ${DAYS}일 — 레퍼러/키워드별 핑거프린트\n`)

const withRef = ss.filter(s => s.referrer)
console.log(`전체 ${ss.length}세션 / referrer 값 있는 세션 ${withRef.length}건\n`)

console.log('=== 검색 유입 (네이버·다음·구글) ===')
const search = ss.filter(s => /search\.(naver|daum)|google|bing/.test(s.referrerDomain || ''))
if (!search.length) console.log('  없음')
for (const s of search) {
  const kw = kwOf(s.referrer)
  console.log(`${kst(s.firstVisit)} | ${(s.deviceType || '?').padEnd(7)} | fp=${s.fingerprint}`)
  console.log(`    IP ${s.ipAddress} | ${s.region}/${s.city} | dwell ${s.totalDwellTime}s pv${s.totalPageViews} risk${s.riskScore}${isAd(s) ? ' [광고]' : ''}`)
  console.log(`    키워드: ${kw || '(레퍼러에 없음)'}`)
  console.log(`    referrer: ${(s.referrer || '').slice(0, 160)}`)
}

console.log('\n=== 키워드별 집계 ===')
const byKw = {}
ss.forEach(s => {
  const kw = kwOf(s.referrer)
  if (!kw) return
  byKw[kw] = byKw[kw] || { n: 0, fps: new Set(), ips: new Set(), zero: 0 }
  byKw[kw].n++
  byKw[kw].fps.add(s.fingerprint)
  byKw[kw].ips.add(s.ipAddress)
  if (!s.totalDwellTime) byKw[kw].zero++
})
const ks = Object.keys(byKw)
if (!ks.length) console.log('  ⚠️ 레퍼러에 키워드가 실려오지 않음 → UTM 필요')
ks.sort((a, b) => byKw[b].n - byKw[a].n).forEach(k => {
  const v = byKw[k]
  console.log(`  "${k}" : ${v.n}회 | 고유fp ${v.fps.size} | 고유IP ${v.ips.size} | 0초이탈 ${v.zero}`)
  v.fps.forEach(f => console.log(`      fp=${f}`))
})

console.log('\n=== 광고 레퍼러(ad.search.naver) 세션 ===')
const ads = ss.filter(isAd)
if (!ads.length) console.log('  없음')
ads.forEach(s => console.log(`  ${kst(s.firstVisit)} | fp=${s.fingerprint} | IP ${s.ipAddress} | ${s.region}/${s.city} | dwell ${s.totalDwellTime}s | pv${s.totalPageViews}\n      ref: ${(s.referrer || '').slice(0, 160)}`))

await prisma.$disconnect()
