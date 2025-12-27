"""
Flask 웹 대시보드
실시간 통계 및 검색 순위 모니터링
"""

import sys
import os

# 상위 디렉토리의 modules를 import할 수 있도록 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, render_template, jsonify
from flask_cors import CORS
from modules.session_logger import SessionLogger
from modules.rank_tracker import RankTracker


app = Flask(__name__)
CORS(app)  # CORS 허용

# 프로젝트 루트 경로
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(BASE_DIR, 'logs')

# logs 디렉토리 생성
os.makedirs(LOGS_DIR, exist_ok=True)

# 로거 및 트래커 초기화 (절대 경로 사용)
logger = SessionLogger(db_path=os.path.join(LOGS_DIR, 'sessions.db'))
tracker = RankTracker(db_path=os.path.join(LOGS_DIR, 'rankings.db'))


@app.route('/')
def index():
    """메인 대시보드"""
    return render_template('dashboard.html')


@app.route('/api/stats')
def get_stats():
    """실시간 통계 API"""
    stats_today = logger.get_statistics('today')
    stats_week = logger.get_statistics('week')
    stats_month = logger.get_statistics('month')

    return jsonify({
        'today': stats_today,
        'week': stats_week,
        'month': stats_month
    })


@app.route('/api/rankings')
def get_rankings():
    """검색 순위 API"""
    keywords = ['용인 아파트', '용인 클러스터', '경남 아너스빌']
    rankings = []

    for keyword in keywords:
        naver_history = tracker.get_rank_history(keyword, 'naver', days=7)
        google_history = tracker.get_rank_history(keyword, 'google', days=7)

        rankings.append({
            'keyword': keyword,
            'naver': naver_history,
            'google': google_history
        })

    return jsonify(rankings)


@app.route('/api/sessions/recent')
def get_recent_sessions():
    """최근 세션 로그"""
    sessions = logger.get_recent_sessions(limit=100)
    return jsonify(sessions)


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Flask 대시보드 시작")
    print("="*60)
    print(f"\n📁 프로젝트 루트: {BASE_DIR}")
    print(f"📁 로그 디렉토리: {LOGS_DIR}")
    print(f"📊 세션 DB: {os.path.join(LOGS_DIR, 'sessions.db')}")
    print(f"📊 순위 DB: {os.path.join(LOGS_DIR, 'rankings.db')}")
    print(f"\n📊 대시보드 URL: http://localhost:5000")
    print("   브라우저에서 위 URL로 접속하세요\n")
    print("="*60 + "\n")

    try:
        app.run(host='0.0.0.0', port=5000, debug=True)
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        print("\n가능한 해결 방법:")
        print("  1. 포트 5000이 이미 사용 중일 수 있습니다")
        print("  2. 다른 프로그램을 종료하고 다시 시도하세요")
        print("  3. 또는 app.py에서 포트 번호를 변경하세요 (예: 5001)")
        input("\nEnter를 눌러 종료...")
