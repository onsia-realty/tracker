"""
세션 로깅 모듈
SQLite를 사용하여 세션 데이터 기록 및 통계 제공
"""

import sqlite3
import os
from datetime import datetime


class SessionLogger:
    def __init__(self, db_path='logs/sessions.db'):
        self.db_path = db_path

        # logs 디렉토리 생성
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        # 데이터베이스 초기화
        self.init_db()

    def init_db(self):
        """SQLite DB 초기화"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

                -- 프록시/IP 정보
                proxy_ip TEXT,
                proxy_country TEXT,
                proxy_session_id TEXT,

                -- 디바이스 정보
                device_type TEXT,  -- 'mobile' or 'desktop'
                device_name TEXT,  -- 'Galaxy S23', 'iPhone 14', 'Desktop'
                user_agent TEXT,
                viewport_width INTEGER,
                viewport_height INTEGER,

                -- 세션 결과
                status TEXT,  -- 'success', 'failed', 'blocked'
                error_message TEXT,

                -- 행동 데이터
                dwell_time_seconds INTEGER,
                pages_visited INTEGER,
                scroll_depth_percent INTEGER,
                mouse_movements INTEGER,
                clicks INTEGER,

                -- Referrer 정보
                referrer_type TEXT,  -- 'naver', 'google', 'social', 'direct'
                referrer_keyword TEXT,

                -- 부정클릭 탐지 결과
                fraud_score INTEGER,
                is_blocked BOOLEAN,
                block_reason TEXT,

                -- 재접속 정보
                next_run_delay_seconds INTEGER
            )
        """)

        conn.commit()
        conn.close()

        print(f"✅ 세션 로그 DB 초기화: {self.db_path}")

    def log_session(self, session_data):
        """
        세션 기록 저장

        Args:
            session_data: 세션 정보 딕셔너리
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO sessions (
                proxy_ip, proxy_country, proxy_session_id,
                device_type, device_name, user_agent, viewport_width, viewport_height,
                status, error_message,
                dwell_time_seconds, pages_visited, scroll_depth_percent,
                mouse_movements, clicks,
                referrer_type, referrer_keyword,
                fraud_score, is_blocked, block_reason,
                next_run_delay_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_data.get('proxy_ip'),
            session_data.get('proxy_country'),
            session_data.get('proxy_session_id'),
            session_data.get('device_type'),
            session_data.get('device_name'),
            session_data.get('user_agent'),
            session_data.get('viewport_width'),
            session_data.get('viewport_height'),
            session_data.get('status'),
            session_data.get('error_message'),
            session_data.get('dwell_time_seconds'),
            session_data.get('pages_visited'),
            session_data.get('scroll_depth_percent'),
            session_data.get('mouse_movements'),
            session_data.get('clicks'),
            session_data.get('referrer_type'),
            session_data.get('referrer_keyword'),
            session_data.get('fraud_score', 0),
            session_data.get('is_blocked', False),
            session_data.get('block_reason'),
            session_data.get('next_run_delay_seconds')
        ))

        conn.commit()
        conn.close()

    def get_statistics(self, period='today'):
        """
        통계 조회

        Args:
            period: 'today', 'week', 'month', 'all'

        Returns:
            통계 딕셔너리
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 기간 필터
        if period == 'today':
            date_filter = "DATE(timestamp) = DATE('now')"
        elif period == 'week':
            date_filter = "timestamp >= datetime('now', '-7 days')"
        elif period == 'month':
            date_filter = "timestamp >= datetime('now', '-30 days')"
        else:
            date_filter = "1=1"  # all

        # 전체 통계
        cursor.execute(f"""
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
            WHERE {date_filter}
        """)

        stats = cursor.fetchone()

        conn.close()

        if stats[0] == 0:  # 데이터 없음
            return {
                'total_sessions': 0,
                'success_count': 0,
                'failed_count': 0,
                'blocked_count': 0,
                'success_rate': "0%",
                'avg_dwell_time': "0초",
                'avg_fraud_score': "0점",
                'avg_pages_visited': "0개",
                'avg_scroll_depth': "0%",
                'avg_mouse_movements': "0회"
            }

        return {
            'total_sessions': stats[0],
            'success_count': stats[1],
            'failed_count': stats[2],
            'blocked_count': stats[3],
            'success_rate': f"{(stats[1] / stats[0] * 100):.2f}%",
            'avg_dwell_time': f"{stats[4]:.1f}초" if stats[4] else "0초",
            'avg_fraud_score': f"{stats[5]:.1f}점" if stats[5] else "0점",
            'avg_pages_visited': f"{stats[6]:.1f}개" if stats[6] else "0개",
            'avg_scroll_depth': f"{stats[7]:.1f}%" if stats[7] else "0%",
            'avg_mouse_movements': f"{stats[8]:.1f}회" if stats[8] else "0회"
        }

    def get_recent_sessions(self, limit=100):
        """
        최근 세션 조회

        Args:
            limit: 조회할 세션 수

        Returns:
            세션 리스트
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                timestamp, device_type, device_name,
                status, dwell_time_seconds, fraud_score,
                referrer_type, proxy_ip
            FROM sessions
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))

        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'timestamp': row[0],
                'device_type': row[1],
                'device_name': row[2],
                'status': row[3],
                'dwell_time': row[4],
                'fraud_score': row[5],
                'referrer': row[6],
                'ip': row[7]
            })

        conn.close()

        return sessions

    def print_statistics(self, period='today'):
        """통계 출력"""
        stats = self.get_statistics(period)

        print(f"\n{'='*60}")
        print(f"📊 통계 ({period})")
        print(f"{'='*60}")
        print(f"  총 세션: {stats['total_sessions']}")
        print(f"  성공: {stats['success_count']} | 실패: {stats['failed_count']} | 차단: {stats['blocked_count']}")
        print(f"  성공률: {stats['success_rate']}")
        print(f"  평균 체류시간: {stats['avg_dwell_time']}")
        print(f"  평균 부정클릭 점수: {stats['avg_fraud_score']}")
        print(f"  평균 페이지 방문: {stats['avg_pages_visited']}")
        print(f"  평균 스크롤 깊이: {stats['avg_scroll_depth']}")
        print(f"  평균 마우스 움직임: {stats['avg_mouse_movements']}")
        print(f"{'='*60}\n")
