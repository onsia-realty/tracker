"""
검색 순위 추적 모듈
네이버/구글 검색 순위를 자동으로 체크하고 기록
"""

import asyncio
import sqlite3
import os
from datetime import datetime
from playwright.async_api import async_playwright


class RankTracker:
    def __init__(self, target_url='yongin-honorsville.vercel.app', db_path='logs/rankings.db'):
        self.target_url = target_url
        self.target_domain = target_url.split('//')[- 1] if '//' in target_url else target_url
        self.db_path = db_path

        # logs 디렉토리 생성
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        # 데이터베이스 초기화
        self.init_db()

    def init_db(self):
        """순위 DB 초기화"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rankings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                search_engine TEXT,  -- 'naver', 'google'
                keyword TEXT,
                rank_position INTEGER,  -- 순위 (0 = 찾을 수 없음)
                page_number INTEGER,    -- 몇 페이지에서 발견되었는지
                url TEXT,
                title TEXT,
                description TEXT
            )
        """)

        conn.commit()
        conn.close()

        print(f"✅ 순위 추적 DB 초기화: {self.db_path}")

    async def check_naver_rank(self, keyword):
        """
        네이버 검색 순위 확인

        Args:
            keyword: 검색 키워드

        Returns:
            순위 정보 딕셔너리
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print(f"  🔍 네이버 순위 체크: '{keyword}'")

                # 네이버 검색
                await page.goto(f"https://search.naver.com/search.naver?query={keyword}")
                await page.wait_for_load_state('networkidle')

                # 검색 결과에서 순위 찾기
                results = await page.query_selector_all('.link_tit, .total_tit')

                for idx, result in enumerate(results, start=1):
                    href = await result.get_attribute('href')
                    title = await result.inner_text()

                    if href and self.target_domain in href:
                        # 순위 발견!
                        rank_data = {
                            'search_engine': 'naver',
                            'keyword': keyword,
                            'rank_position': idx,
                            'page_number': 1,
                            'url': href,
                            'title': title,
                            'description': ''
                        }

                        print(f"  ✅ 네이버 순위: {idx}위")
                        await browser.close()
                        return rank_data

                # 1페이지에서 못 찾음
                print(f"  ❌ 네이버 1페이지에서 순위권 밖")
                await browser.close()
                return {
                    'search_engine': 'naver',
                    'keyword': keyword,
                    'rank_position': 0,  # 찾을 수 없음
                    'page_number': 0,
                    'url': '',
                    'title': '',
                    'description': '순위권 밖'
                }

            except Exception as e:
                print(f"  ❌ 네이버 순위 체크 오류: {e}")
                await browser.close()
                return None

    async def check_google_rank(self, keyword):
        """
        구글 검색 순위 확인

        Args:
            keyword: 검색 키워드

        Returns:
            순위 정보 딕셔너리
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print(f"  🔍 구글 순위 체크: '{keyword}'")

                await page.goto(f"https://www.google.com/search?q={keyword}")
                await page.wait_for_load_state('networkidle')

                results = await page.query_selector_all('a h3')

                for idx, result in enumerate(results, start=1):
                    parent = await result.evaluate_handle('el => el.closest("a")')
                    href = await parent.get_attribute('href')
                    title = await result.inner_text()

                    if href and self.target_domain in href:
                        rank_data = {
                            'search_engine': 'google',
                            'keyword': keyword,
                            'rank_position': idx,
                            'page_number': 1,
                            'url': href,
                            'title': title,
                            'description': ''
                        }

                        print(f"  ✅ 구글 순위: {idx}위")
                        await browser.close()
                        return rank_data

                print(f"  ❌ 구글 1페이지에서 순위권 밖")
                await browser.close()
                return {
                    'search_engine': 'google',
                    'keyword': keyword,
                    'rank_position': 0,
                    'page_number': 0,
                    'url': '',
                    'title': '',
                    'description': '순위권 밖'
                }

            except Exception as e:
                print(f"  ❌ 구글 순위 체크 오류: {e}")
                await browser.close()
                return None

    def save_rank(self, rank_data):
        """순위 데이터 저장"""
        if not rank_data:
            return

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO rankings (
                search_engine, keyword, rank_position, page_number,
                url, title, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            rank_data['search_engine'],
            rank_data['keyword'],
            rank_data['rank_position'],
            rank_data['page_number'],
            rank_data['url'],
            rank_data['title'],
            rank_data['description']
        ))

        conn.commit()
        conn.close()

    def get_rank_history(self, keyword, search_engine, days=30):
        """
        순위 변동 히스토리

        Args:
            keyword: 검색 키워드
            search_engine: 'naver' or 'google'
            days: 조회 기간 (일)

        Returns:
            [(날짜, 순위), ...] 리스트
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute(f"""
            SELECT
                DATE(timestamp) as date,
                rank_position
            FROM rankings
            WHERE keyword = ? AND search_engine = ?
                AND timestamp >= datetime('now', '-{days} days')
            ORDER BY timestamp ASC
        """, (keyword, search_engine))

        results = cursor.fetchall()
        conn.close()

        return results

    async def check_all_rankings(self, keywords):
        """
        모든 키워드의 순위 체크

        Args:
            keywords: 키워드 리스트

        Returns:
            결과 리스트
        """
        print(f"\n{'='*60}")
        print("📊 검색 순위 체크 중...")
        print(f"{'='*60}\n")

        results = []

        for keyword in keywords:
            print(f"키워드: '{keyword}'")

            # 네이버 순위
            naver_rank = await self.check_naver_rank(keyword)
            if naver_rank:
                self.save_rank(naver_rank)
                results.append(naver_rank)

            await asyncio.sleep(2)  # 과도한 요청 방지

            # 구글 순위
            google_rank = await self.check_google_rank(keyword)
            if google_rank:
                self.save_rank(google_rank)
                results.append(google_rank)

            await asyncio.sleep(2)  # 과도한 요청 방지

            print()

        print(f"{'='*60}")
        print(f"✅ 순위 체크 완료: {len(results)}개 기록")
        print(f"{'='*60}\n")

        return results
