import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'traffic-simulator', 'logs', 'sessions.db');

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    // 유입경로별 통계
    const referrerStats = db.prepare(`
      SELECT
        referrer_type,
        referrer_keyword,
        COUNT(*) as count,
        AVG(dwell_time_seconds) as avg_dwell_time,
        AVG(fraud_score) as avg_fraud_score,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked_count
      FROM sessions
      WHERE referrer_type IS NOT NULL
      GROUP BY referrer_type, referrer_keyword
      ORDER BY count DESC
    `).all();

    // 유입 타입별 요약
    const typeSummary = db.prepare(`
      SELECT
        referrer_type,
        COUNT(*) as total_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sessions WHERE referrer_type IS NOT NULL), 2) as percentage,
        AVG(dwell_time_seconds) as avg_dwell_time,
        AVG(fraud_score) as avg_fraud_score,
        ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM sessions
      WHERE referrer_type IS NOT NULL
      GROUP BY referrer_type
      ORDER BY total_count DESC
    `).all();

    // 시간대별 유입 분석 (최근 24시간)
    const hourlyReferrers = db.prepare(`
      SELECT
        strftime('%H:00', timestamp) as hour,
        referrer_type,
        COUNT(*) as count
      FROM sessions
      WHERE timestamp >= datetime('now', '-24 hours')
        AND referrer_type IS NOT NULL
      GROUP BY hour, referrer_type
      ORDER BY hour ASC
    `).all();

    // 검색 키워드 랭킹 (네이버 + 구글)
    const keywordRanking = db.prepare(`
      SELECT
        referrer_keyword,
        referrer_type,
        COUNT(*) as count,
        AVG(dwell_time_seconds) as avg_dwell_time,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM sessions
      WHERE referrer_type IN ('naver', 'google')
        AND referrer_keyword IS NOT NULL
      GROUP BY referrer_keyword, referrer_type
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // 소셜 미디어 플랫폼별 통계
    const socialPlatforms = db.prepare(`
      SELECT
        referrer_keyword as platform,
        COUNT(*) as count,
        AVG(dwell_time_seconds) as avg_dwell_time,
        AVG(fraud_score) as avg_fraud_score
      FROM sessions
      WHERE referrer_type = 'social'
        AND referrer_keyword IS NOT NULL
      GROUP BY referrer_keyword
      ORDER BY count DESC
    `).all();

    db.close();

    return NextResponse.json({
      referrerStats,
      typeSummary,
      hourlyReferrers,
      keywordRanking,
      socialPlatforms,
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({
      referrerStats: [],
      typeSummary: [],
      hourlyReferrers: [],
      keywordRanking: [],
      socialPlatforms: [],
    });
  }
}
