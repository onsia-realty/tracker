import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'traffic-simulator', 'logs', 'sessions.db');

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const sessions = db.prepare(`
      SELECT
        timestamp,
        device_type,
        device_name,
        status,
        dwell_time_seconds,
        fraud_score,
        referrer_type,
        proxy_ip
      FROM sessions
      ORDER BY timestamp DESC
      LIMIT 100
    `).all();

    db.close();

    return NextResponse.json(sessions);

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
