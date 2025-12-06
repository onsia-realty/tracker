/**
 * 부정클릭 탐지 알고리즘
 *
 * 탐지 레이어:
 * 1. 빈도 기반 - 동일 식별자의 과도한 클릭
 * 2. 행동 패턴 - 비정상적인 사용자 행동
 * 3. 지역/시간 - 의심스러운 접속 패턴
 * 4. 기술 기반 - 봇/자동화 도구 감지
 */

import { prisma } from './prisma';

// ===========================================
// 타입 정의
// ===========================================

export interface FraudCheckContext {
  fingerprint: string;
  ipAddress: string | null;
  sessionId: string;
  landingSiteId: string | null;

  // 클릭 컨텍스트
  eventType: string;
  adSource?: string | null;

  // 행동 데이터
  dwellTimeBeforeClick?: number;
  scrollDepthBeforeClick?: number;
  mouseMovementsBeforeClick?: number;
  clickX?: number;
  clickY?: number;

  // 세션 데이터
  isVpn?: boolean;
  isProxy?: boolean;
  countryCode?: string | null;
}

export interface FraudCheckResult {
  isFraud: boolean;
  riskScore: number;
  reasons: string[];
  action: 'allow' | 'warn' | 'block';
}

// ===========================================
// 탐지 규칙 설정
// ===========================================

const RULES = {
  // 빈도 기반 규칙
  SAME_FINGERPRINT_5MIN_CLICKS: { threshold: 3, score: 30, window: 5 * 60 * 1000 },
  SAME_FINGERPRINT_1HR_CLICKS: { threshold: 5, score: 50, window: 60 * 60 * 1000 },
  SAME_IP_10MIN_CLICKS: { threshold: 5, score: 25, window: 10 * 60 * 1000 },

  // 행동 패턴 규칙
  LOW_DWELL_TIME: { threshold: 3, score: 25 }, // 3초 미만
  NO_SCROLL: { threshold: 10, score: 20 }, // 스크롤 10% 미만
  NO_MOUSE_MOVEMENT: { threshold: 5, score: 35 }, // 마우스 움직임 5회 미만

  // 기술 기반 규칙
  VPN_PROXY: { score: 30 },
  FOREIGN_COUNTRY: { score: 25 },
  BOT_SIGNATURE: { score: 80 },

  // 좌표 기반 규칙
  SAME_COORDINATE_CLICKS: { tolerance: 5, threshold: 3, score: 40 },

  // 시간 기반 규칙
  NIGHT_TIME: { hours: [2, 3, 4, 5], score: 15 },
};

// 액션 임계값
const ACTION_THRESHOLDS = {
  WARN: 50,
  BLOCK: 80,
};

// ===========================================
// 메인 탐지 함수
// ===========================================

export async function checkForFraud(context: FraudCheckContext): Promise<FraudCheckResult> {
  let totalScore = 0;
  const reasons: string[] = [];

  // 1. 빈도 기반 검사
  const frequencyResult = await checkFrequency(context);
  totalScore += frequencyResult.score;
  reasons.push(...frequencyResult.reasons);

  // 2. 행동 패턴 검사
  const behaviorResult = checkBehavior(context);
  totalScore += behaviorResult.score;
  reasons.push(...behaviorResult.reasons);

  // 3. 지역/시간 검사
  const geoTimeResult = checkGeoTime(context);
  totalScore += geoTimeResult.score;
  reasons.push(...geoTimeResult.reasons);

  // 4. 좌표 패턴 검사
  const coordinateResult = await checkCoordinates(context);
  totalScore += coordinateResult.score;
  reasons.push(...coordinateResult.reasons);

  // 최종 판정
  const riskScore = Math.min(totalScore, 100);
  let action: 'allow' | 'warn' | 'block' = 'allow';

  if (riskScore >= ACTION_THRESHOLDS.BLOCK) {
    action = 'block';
  } else if (riskScore >= ACTION_THRESHOLDS.WARN) {
    action = 'warn';
  }

  return {
    isFraud: riskScore >= ACTION_THRESHOLDS.BLOCK,
    riskScore,
    reasons,
    action,
  };
}

// ===========================================
// 빈도 기반 검사
// ===========================================

async function checkFrequency(context: FraudCheckContext): Promise<{ score: number; reasons: string[] }> {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();

  // 동일 핑거프린트 5분 내 클릭 수
  const fingerprint5MinClicks = await prisma.clickEvent.count({
    where: {
      session: { fingerprint: context.fingerprint },
      timestamp: { gte: new Date(now.getTime() - RULES.SAME_FINGERPRINT_5MIN_CLICKS.window) },
      eventType: { in: ['ad_click', 'cta_click'] },
    },
  });

  if (fingerprint5MinClicks >= RULES.SAME_FINGERPRINT_5MIN_CLICKS.threshold) {
    score += RULES.SAME_FINGERPRINT_5MIN_CLICKS.score;
    reasons.push(`동일 핑거프린트 5분내 ${fingerprint5MinClicks}회 클릭`);
  }

  // 동일 핑거프린트 1시간 내 클릭 수
  const fingerprint1HrClicks = await prisma.clickEvent.count({
    where: {
      session: { fingerprint: context.fingerprint },
      timestamp: { gte: new Date(now.getTime() - RULES.SAME_FINGERPRINT_1HR_CLICKS.window) },
      eventType: { in: ['ad_click', 'cta_click'] },
    },
  });

  if (fingerprint1HrClicks >= RULES.SAME_FINGERPRINT_1HR_CLICKS.threshold) {
    score += RULES.SAME_FINGERPRINT_1HR_CLICKS.score;
    reasons.push(`동일 핑거프린트 1시간내 ${fingerprint1HrClicks}회 클릭`);
  }

  // 동일 IP 10분 내 클릭 수
  if (context.ipAddress) {
    const ip10MinClicks = await prisma.clickEvent.count({
      where: {
        session: { ipAddress: context.ipAddress },
        timestamp: { gte: new Date(now.getTime() - RULES.SAME_IP_10MIN_CLICKS.window) },
        eventType: { in: ['ad_click', 'cta_click'] },
      },
    });

    if (ip10MinClicks >= RULES.SAME_IP_10MIN_CLICKS.threshold) {
      score += RULES.SAME_IP_10MIN_CLICKS.score;
      reasons.push(`동일 IP 10분내 ${ip10MinClicks}회 클릭`);
    }
  }

  return { score, reasons };
}

// ===========================================
// 행동 패턴 검사
// ===========================================

function checkBehavior(context: FraudCheckContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 체류시간 검사 (3초 미만)
  if (context.dwellTimeBeforeClick !== undefined && context.dwellTimeBeforeClick < RULES.LOW_DWELL_TIME.threshold) {
    score += RULES.LOW_DWELL_TIME.score;
    reasons.push(`클릭 전 체류시간 ${context.dwellTimeBeforeClick}초 (3초 미만)`);
  }

  // 스크롤 검사 (10% 미만)
  if (context.scrollDepthBeforeClick !== undefined && context.scrollDepthBeforeClick < RULES.NO_SCROLL.threshold) {
    score += RULES.NO_SCROLL.score;
    reasons.push(`클릭 전 스크롤 ${context.scrollDepthBeforeClick}% (10% 미만)`);
  }

  // 마우스 움직임 검사 (5회 미만)
  if (context.mouseMovementsBeforeClick !== undefined && context.mouseMovementsBeforeClick < RULES.NO_MOUSE_MOVEMENT.threshold) {
    score += RULES.NO_MOUSE_MOVEMENT.score;
    reasons.push(`마우스 움직임 ${context.mouseMovementsBeforeClick}회 (5회 미만, 봇 의심)`);
  }

  return { score, reasons };
}

// ===========================================
// 지역/시간 검사
// ===========================================

function checkGeoTime(context: FraudCheckContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // VPN/프록시 검사
  if (context.isVpn || context.isProxy) {
    score += RULES.VPN_PROXY.score;
    reasons.push('VPN 또는 프록시 사용 감지');
  }

  // 해외 접속 검사 (한국 광고인 경우)
  if (context.countryCode && context.countryCode !== 'KR') {
    // 광고 클릭인 경우에만 의심
    if (context.eventType === 'ad_click') {
      score += RULES.FOREIGN_COUNTRY.score;
      reasons.push(`해외 IP에서 광고 클릭 (${context.countryCode})`);
    }
  }

  // 새벽 시간대 검사 (2-6시)
  const hour = new Date().getHours();
  if (RULES.NIGHT_TIME.hours.includes(hour)) {
    score += RULES.NIGHT_TIME.score;
    reasons.push(`새벽 시간대 클릭 (${hour}시)`);
  }

  return { score, reasons };
}

// ===========================================
// 좌표 패턴 검사
// ===========================================

async function checkCoordinates(context: FraudCheckContext): Promise<{ score: number; reasons: string[] }> {
  let score = 0;
  const reasons: string[] = [];

  if (!context.clickX || !context.clickY) {
    return { score, reasons };
  }

  // 최근 10분 내 동일 세션의 클릭 좌표 조회
  const recentClicks = await prisma.clickEvent.findMany({
    where: {
      sessionId: context.sessionId,
      timestamp: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      clickX: { not: null },
      clickY: { not: null },
    },
    select: { clickX: true, clickY: true },
  });

  // 유사 좌표 클릭 횟수 계산
  let sameCoordCount = 0;
  const tolerance = RULES.SAME_COORDINATE_CLICKS.tolerance;

  for (const click of recentClicks) {
    if (click.clickX && click.clickY) {
      const diffX = Math.abs(click.clickX - context.clickX);
      const diffY = Math.abs(click.clickY - context.clickY);
      if (diffX <= tolerance && diffY <= tolerance) {
        sameCoordCount++;
      }
    }
  }

  if (sameCoordCount >= RULES.SAME_COORDINATE_CLICKS.threshold) {
    score += RULES.SAME_COORDINATE_CLICKS.score;
    reasons.push(`동일 좌표 반복 클릭 ${sameCoordCount}회 (자동화 도구 의심)`);
  }

  return { score, reasons };
}

// ===========================================
// 블랙리스트 검사
// ===========================================

export async function isBlacklisted(fingerprint: string, ipAddress: string | null): Promise<boolean> {
  // 핑거프린트로 블랙리스트 검색
  const fpBlacklist = await prisma.blacklist.findUnique({
    where: { fingerprint },
  });

  if (fpBlacklist) {
    if (!fpBlacklist.expiresAt || fpBlacklist.expiresAt >= new Date()) {
      return true;
    }
  }

  if (ipAddress) {
    const ipBlacklist = await prisma.blacklist.findFirst({
      where: { ipAddress },
    });
    if (ipBlacklist) {
      if (!ipBlacklist.expiresAt || ipBlacklist.expiresAt >= new Date()) {
        return true;
      }
    }
  }

  return false;
}

// ===========================================
// 블랙리스트 추가
// ===========================================

export async function addToBlacklist(
  fingerprint: string,
  ipAddress: string | null,
  reason: string,
  evidence: object,
  permanent: boolean = false
): Promise<void> {
  const expiresAt = permanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일

  await prisma.blacklist.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      ipAddress,
      reason,
      evidence: JSON.stringify(evidence),
      expiresAt,
    },
    update: {
      reason,
      evidence: JSON.stringify(evidence),
      expiresAt,
    },
  });
}

// ===========================================
// 세션 리스크 스코어 업데이트
// ===========================================

export async function updateSessionRisk(sessionId: string, riskScore: number, reasons: string[]): Promise<void> {
  const isSuspicious = riskScore >= ACTION_THRESHOLDS.WARN;
  const isBlocked = riskScore >= ACTION_THRESHOLDS.BLOCK;

  await prisma.visitorSession.update({
    where: { id: sessionId },
    data: {
      riskScore: Math.max(riskScore), // 최고 점수 유지
      isSuspicious,
      isBlocked,
      blockReason: isBlocked ? reasons.join(', ') : null,
      blockedAt: isBlocked ? new Date() : null,
    },
  });
}

// ===========================================
// 공유 IP 판별 (스마트로그 핵심 기능)
// ===========================================

export async function isSharedIP(ipAddress: string): Promise<boolean> {
  if (!ipAddress) return false;

  // 해당 IP에서 접속한 고유 핑거프린트 수 조회
  const uniqueFingerprints = await prisma.visitorSession.groupBy({
    by: ['fingerprint'],
    where: {
      ipAddress,
      firstVisit: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24시간 내
    },
  });

  // 3개 이상의 다른 핑거프린트가 같은 IP를 사용하면 공유 IP로 판단
  // (카페, 회사, 학교 등)
  return uniqueFingerprints.length >= 3;
}

// ===========================================
// 정상 행동 판별
// ===========================================

export function hasNormalBehavior(context: FraudCheckContext): boolean {
  // 체류시간 10초 이상
  if (context.dwellTimeBeforeClick && context.dwellTimeBeforeClick >= 10) {
    // 스크롤 30% 이상
    if (context.scrollDepthBeforeClick && context.scrollDepthBeforeClick >= 30) {
      // 마우스 움직임 10회 이상
      if (context.mouseMovementsBeforeClick && context.mouseMovementsBeforeClick >= 10) {
        return true;
      }
    }
  }
  return false;
}

// ===========================================
// 통합 판정 함수 (공유 IP 고려)
// ===========================================

export async function smartFraudCheck(context: FraudCheckContext): Promise<FraudCheckResult> {
  // 1. 블랙리스트 체크
  const blacklisted = await isBlacklisted(context.fingerprint, context.ipAddress);
  if (blacklisted) {
    return {
      isFraud: true,
      riskScore: 100,
      reasons: ['블랙리스트에 등록된 사용자'],
      action: 'block',
    };
  }

  // 2. 기본 부정클릭 검사
  const result = await checkForFraud(context);

  // 3. 공유 IP 보정 (스마트로그 핵심)
  // 공유 IP이고 정상 행동 패턴이면 점수 감점
  if (context.ipAddress) {
    const isShared = await isSharedIP(context.ipAddress);
    if (isShared && hasNormalBehavior(context)) {
      // 공유 IP에서 정상 행동이면 리스크 점수 50% 감소
      result.riskScore = Math.floor(result.riskScore * 0.5);
      result.reasons.push('공유 IP + 정상 행동: 리스크 점수 보정됨');

      // 액션 재판정
      if (result.riskScore < ACTION_THRESHOLDS.WARN) {
        result.action = 'allow';
        result.isFraud = false;
      } else if (result.riskScore < ACTION_THRESHOLDS.BLOCK) {
        result.action = 'warn';
        result.isFraud = false;
      }
    }
  }

  return result;
}
