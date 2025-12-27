import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

// SQLite DB 경로
const DB_PATH = path.join(process.cwd(), '..', 'traffic-simulator', 'logs', 'sessions.db');

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    // 오늘 통계
    const todayStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked_count,
        AVG(dwell_time_seconds) as avg_dwell_time,
        AVG(fraud_score) as avg_fraud_score,
        AVG(pages_visited) as avg_pages_visited,
        AVG(scroll_depth_percent) as avg_scroll_depth,
        AVG(mouse_movements) as avg_mouse_movements
      FROM sessions
      WHERE DATE(timestamp) = DATE('now')
    `).get();

    // 주간 통계
    const weekStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        AVG(dwell_time_seconds) as avg_dwell_time,
        AVG(fraud_score) as avg_fraud_score
      FROM sessions
      WHERE timestamp >= datetime('now', '-7 days')
    `).get();

    db.close();

    return NextResponse.json({
      today: {
        total_sessions: todayStats.total_sessions || 0,
        success_count: todayStats.success_count || 0,
        failed_count: todayStats.failed_count || 0,
        blocked_count: todayStats.blocked_count || 0,
        success_rate: todayStats.total_sessions > 0
          ? `${((todayStats.success_count / todayStats.total_sessions) * 100).toFixed(2)}%`
          : '0%',
        avg_dwell_time: `${(todayStats.avg_dwell_time || 0).toFixed(1)}초`,
        avg_fraud_score: `${(todayStats.avg_fraud_score || 0).toFixed(1)}점`,
        avg_pages_visited: `${(todayStats.avg_pages_visited || 0).toFixed(1)}개`,
        avg_scroll_depth: `${(todayStats.avg_scroll_depth || 0).toFixed(1)}%`,
        avg_mouse_movements: `${(todayStats.avg_mouse_movements || 0).toFixed(1)}회`,
      },
      week: {
        total_sessions: weekStats.total_sessions || 0,
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database not found or empty' }, { status: 500 });
  }
}
