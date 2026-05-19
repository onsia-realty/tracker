/**
 * 부정클릭 3단계(riskScore >= 100) 도달 시 운영자(YDG)에게 SMS 발송
 *
 * 환경변수 (onsia.city src/lib/solapi.ts와 동일 키 재사용):
 *  - SOLAPI_API_KEY
 *  - SOLAPI_API_SECRET
 *  - SMS_SENDER_NUMBER
 *  - ADMIN_PHONE
 *
 * 호출 측에서 24시간 중복 발송 방지 체크(FraudAlertLog) 후 이 함수를 호출한다.
 */

import { SolapiMessageService } from 'solapi'

const sanitize = (s: string | undefined) =>
  (s || '').trim().replace(/[\r\n]/g, '')

const apiKey = sanitize(process.env.SOLAPI_API_KEY)
const apiSecret = sanitize(process.env.SOLAPI_API_SECRET)
const sender = sanitize(process.env.SMS_SENDER_NUMBER)
const admin = sanitize(process.env.ADMIN_PHONE)

const messageService =
  apiKey && apiSecret ? new SolapiMessageService(apiKey, apiSecret) : null

export interface FraudAlertPayload {
  siteSlug: string
  ipAddress: string | null
  riskScore: number
  reasons: string[]
  adSource?: string | null
  adKeyword?: string | null
  utmCampaign?: string | null
  clickCount5min: number
}

export interface FraudAlertResult {
  success: boolean
  skipped?: boolean
  error?: string
}

export async function notifyFraudAlert(
  data: FraudAlertPayload
): Promise<FraudAlertResult> {
  if (!messageService || !sender || !admin) {
    return {
      success: false,
      skipped: true,
      error: 'Solapi env vars missing (SOLAPI_API_KEY/SECRET, SMS_SENDER_NUMBER, ADMIN_PHONE)',
    }
  }

  const source = data.adSource || '직접'
  const keyword = data.adKeyword || data.utmCampaign || '-'
  const ip = data.ipAddress || 'unknown'
  const reasonText = data.reasons.slice(0, 2).join(', ') || '복합 패턴'

  const text =
    `[부정클릭 감지] ${data.siteSlug}\n` +
    `IP: ${ip}\n` +
    `유입: ${source} / ${keyword}\n` +
    `5분 내 클릭: ${data.clickCount5min}회 (점수 ${data.riskScore})\n` +
    `사유: ${reasonText}\n` +
    `네이버 광고 관리자에서 IP 차단 권장`

  try {
    await messageService.sendOne({ to: admin, from: sender, text })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notifyFraudAlert] SMS 발송 실패:', msg)
    return { success: false, error: msg }
  }
}
