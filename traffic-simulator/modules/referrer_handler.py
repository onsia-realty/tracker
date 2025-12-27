"""
Referrer 처리 모듈
네이버/구글 검색, 소셜 미디어 등 다양한 유입 경로 시뮬레이션
"""

import asyncio
import random


class ReferrerHandler:
    def __init__(self, target_url='yongin-honorsville.vercel.app'):
        self.target_url = target_url
        self.target_domain = target_url.split('//')[- 1] if '//' in target_url else target_url

    async def visit_from_naver(self, page, keyword):
        """
        네이버 검색 → 결과 클릭 → 사이트 유입

        Args:
            page: Playwright 페이지
            keyword: 검색 키워드

        Returns:
            성공 여부
        """
        try:
            print(f"  🔍 네이버 검색: '{keyword}'")

            # 1. 네이버 검색
            await page.goto(f"https://search.naver.com/search.naver?query={keyword}")
            await asyncio.sleep(random.uniform(2, 4))

            # 2. 검색 결과에서 사이트 찾기
            results = await page.query_selector_all('.link_tit, .total_tit')

            if not results:
                print("  ⚠️ 검색 결과를 찾을 수 없음")
                # 직접 이동으로 폴백
                await self.visit_direct(page)
                return True

            # 3. 사이트 링크 찾기
            found = False
            for result in results:
                href = await result.get_attribute('href')

                if href and self.target_domain in href:
                    # 클릭 (자연스러운 referrer 생성)
                    print(f"  ✅ 검색 결과에서 사이트 발견!")
                    await result.click()
                    await page.wait_for_load_state('networkidle', timeout=30000)
                    found = True
                    break

            if not found:
                print("  ⚠️ 검색 결과에 사이트 없음, 직접 이동")
                # 직접 이동으로 폴백
                await self.visit_direct(page)

            return True

        except Exception as e:
            print(f"  ❌ 네이버 검색 오류: {e}")
            # 오류 시 직접 이동
            await self.visit_direct(page)
            return True

    async def visit_from_google(self, page, keyword):
        """
        구글 검색 → 결과 클릭

        Args:
            page: Playwright 페이지
            keyword: 검색 키워드

        Returns:
            성공 여부
        """
        try:
            print(f"  🔍 구글 검색: '{keyword}'")

            # 1. 구글 검색
            await page.goto(f"https://www.google.com/search?q={keyword}")
            await asyncio.sleep(random.uniform(2, 4))

            # 2. 검색 결과에서 사이트 찾기
            results = await page.query_selector_all('a h3')

            if not results:
                print("  ⚠️ 검색 결과를 찾을 수 없음")
                await self.visit_direct(page)
                return True

            # 3. 사이트 링크 찾기
            found = False
            for result in results:
                parent = await result.evaluate_handle('el => el.closest("a")')
                href = await parent.get_attribute('href')

                if href and self.target_domain in href:
                    print(f"  ✅ 검색 결과에서 사이트 발견!")
                    await result.click()
                    await page.wait_for_load_state('networkidle', timeout=30000)
                    found = True
                    break

            if not found:
                print("  ⚠️ 검색 결과에 사이트 없음, 직접 이동")
                await self.visit_direct(page)

            return True

        except Exception as e:
            print(f"  ❌ 구글 검색 오류: {e}")
            await self.visit_direct(page)
            return True

    async def visit_from_social(self, page, platform='facebook'):
        """
        소셜 미디어 유입 시뮬레이션

        Args:
            page: Playwright 페이지
            platform: 'facebook', 'instagram', 'kakaotalk'

        Returns:
            성공 여부
        """
        try:
            referrers = {
                'facebook': 'https://www.facebook.com/',
                'instagram': 'https://www.instagram.com/',
                'kakaotalk': 'https://open.kakao.com/',
                'naver_blog': 'https://blog.naver.com/',
                'naver_cafe': 'https://cafe.naver.com/'
            }

            referrer_url = referrers.get(platform, 'https://www.facebook.com/')

            print(f"  📱 소셜 미디어 유입: {platform}")

            # Referrer 헤더 설정
            await page.set_extra_http_headers({
                'Referer': referrer_url
            })

            # 사이트 이동
            full_url = f"https://{self.target_domain}" if not self.target_url.startswith('http') else self.target_url
            await page.goto(full_url)
            await page.wait_for_load_state('networkidle', timeout=30000)

            print(f"  ✅ 소셜 미디어 유입 완료")
            return True

        except Exception as e:
            print(f"  ❌ 소셜 미디어 유입 오류: {e}")
            return False

    async def visit_direct(self, page):
        """
        직접 유입 (북마크, URL 입력)

        Args:
            page: Playwright 페이지

        Returns:
            성공 여부
        """
        try:
            print(f"  🔗 직접 유입")

            # Referrer 없이 직접 이동
            full_url = f"https://{self.target_domain}" if not self.target_url.startswith('http') else self.target_url
            await page.goto(full_url)
            await page.wait_for_load_state('networkidle', timeout=30000)

            print(f"  ✅ 직접 유입 완료")
            return True

        except Exception as e:
            print(f"  ❌ 직접 유입 오류: {e}")
            return False

    def get_random_referrer_type(self):
        """
        무작위 referrer 타입 선택

        비율:
        - 네이버 검색: 40%
        - 구글 검색: 30%
        - 소셜 미디어: 20%
        - 직접 유입: 10%

        Returns:
            (타입, 키워드/플랫폼)
        """
        rand = random.random()

        if rand < 0.4:
            # 네이버 검색 (40%)
            keywords = ['용인 아파트', '용인 클러스터', '경남 아너스빌', '용인 분양']
            return ('naver', random.choice(keywords))

        elif rand < 0.7:
            # 구글 검색 (30%)
            keywords = ['용인 분양', '클러스터 용인', '경남 아너스빌 용인']
            return ('google', random.choice(keywords))

        elif rand < 0.9:
            # 소셜 미디어 (20%)
            platforms = ['facebook', 'instagram', 'kakaotalk', 'naver_blog', 'naver_cafe']
            return ('social', random.choice(platforms))

        else:
            # 직접 유입 (10%)
            return ('direct', None)

    async def execute_referrer(self, page):
        """
        referrer 타입에 따라 실행

        Args:
            page: Playwright 페이지

        Returns:
            (referrer_type, referrer_keyword/platform)
        """
        referrer_type, param = self.get_random_referrer_type()

        try:
            if referrer_type == 'naver':
                await self.visit_from_naver(page, param)
                return (referrer_type, param)

            elif referrer_type == 'google':
                await self.visit_from_google(page, param)
                return (referrer_type, param)

            elif referrer_type == 'social':
                await self.visit_from_social(page, param)
                return (referrer_type, param)

            else:  # direct
                await self.visit_direct(page)
                return (referrer_type, None)

        except Exception as e:
            print(f"  ❌ Referrer 실행 오류: {e}")
            # 폴백: 직접 이동
            await self.visit_direct(page)
            return ('direct', None)
