"""
자연스러운 행동 시뮬레이션 모듈
마우스 움직임, 스크롤, 클릭 등 사람처럼 행동
"""

import asyncio
import random


class BehaviorSimulator:
    async def human_scroll(self, page):
        """
        사람처럼 스크롤

        Returns:
            스크롤 깊이 (백분율)
        """
        try:
            # 전체 페이지 높이 확인
            total_height = await page.evaluate("document.body.scrollHeight")
            viewport_height = await page.evaluate("window.innerHeight")

            current_pos = 0
            max_scroll = total_height - viewport_height

            # 스크롤 목표 깊이 (60-100% 사이 무작위)
            target_depth = random.uniform(0.6, 1.0)
            target_pos = max_scroll * target_depth

            print(f"  📜 스크롤 시작: 목표 {target_depth*100:.0f}%")

            # 점진적 스크롤
            while current_pos < target_pos:
                # 무작위 스크롤 양 (300-700px)
                scroll_step = random.randint(300, 700)

                # 남은 거리가 짧으면 조정
                remaining = target_pos - current_pos
                if remaining < scroll_step:
                    scroll_step = int(remaining)

                current_pos += scroll_step

                # 스크롤 실행
                await page.mouse.wheel(0, scroll_step)

                # 무작위 대기 (0.5-2초)
                await asyncio.sleep(random.uniform(0.5, 2.0))

                # 10% 확률로 위로 살짝 스크롤 (뒤로 읽기 시뮬레이션)
                if random.random() < 0.1:
                    back_scroll = random.randint(100, 300)
                    await page.mouse.wheel(0, -back_scroll)
                    current_pos -= back_scroll
                    await asyncio.sleep(random.uniform(0.3, 1.0))

            # 최종 스크롤 깊이 계산
            final_depth = int((current_pos / max_scroll) * 100) if max_scroll > 0 else 100
            print(f"  ✅ 스크롤 완료: {final_depth}%")

            return final_depth

        except Exception as e:
            print(f"  ⚠️ 스크롤 오류: {e}")
            return 50  # 기본값

    async def random_mouse_movements(self, page):
        """
        무작위 마우스 움직임 (100-200회)

        Returns:
            마우스 움직임 횟수
        """
        try:
            viewport = page.viewport_size
            movements = random.randint(100, 200)

            print(f"  🖱️ 마우스 움직임 시작: {movements}회")

            for i in range(movements):
                # 화면 내 무작위 위치
                x = random.randint(0, viewport['width'])
                y = random.randint(0, viewport['height'])

                # 자연스러운 속도로 이동
                await page.mouse.move(x, y)

                # 짧은 대기 (0.05-0.3초)
                await asyncio.sleep(random.uniform(0.05, 0.3))

                # 20회마다 진행상황 출력
                if (i + 1) % 20 == 0:
                    print(f"    진행: {i+1}/{movements}")

            print(f"  ✅ 마우스 움직임 완료: {movements}회")
            return movements

        except Exception as e:
            print(f"  ⚠️ 마우스 움직임 오류: {e}")
            return 0

    async def natural_click(self, page, selector):
        """
        자연스러운 클릭 (좌표 무작위화)

        Args:
            page: Playwright 페이지
            selector: CSS 선택자

        Returns:
            클릭 성공 여부
        """
        try:
            element = await page.query_selector(selector)

            if not element:
                print(f"  ⚠️ 요소를 찾을 수 없음: {selector}")
                return False

            # 요소의 위치와 크기 확인
            box = await element.bounding_box()

            if not box:
                print(f"  ⚠️ 요소의 위치를 확인할 수 없음: {selector}")
                return False

            # 요소 내 무작위 위치 계산 (중앙에서 약간 벗어난 위치)
            offset_x = random.uniform(5, box['width'] - 5) if box['width'] > 10 else box['width'] / 2
            offset_y = random.uniform(5, box['height'] - 5) if box['height'] > 10 else box['height'] / 2

            x = box['x'] + offset_x
            y = box['y'] + offset_y

            # 클릭 전 마우스 이동
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))

            # 클릭
            await page.mouse.click(x, y)
            await asyncio.sleep(random.uniform(0.5, 1.0))

            print(f"  ✅ 클릭 완료: {selector}")
            return True

        except Exception as e:
            print(f"  ⚠️ 클릭 오류: {e}")
            return False

    async def random_page_interaction(self, page):
        """
        페이지와 무작위 상호작용

        Returns:
            클릭 횟수
        """
        clicks = 0

        try:
            # 클릭 가능한 요소 찾기 (링크, 버튼 등)
            clickable_selectors = [
                'a', 'button', '.btn', '.link',
                'nav a', 'header a', 'footer a'
            ]

            # 0-3개의 요소 클릭
            num_clicks = random.randint(0, 3)

            print(f"  🖱️ 무작위 클릭 시작: 최대 {num_clicks}개")

            for _ in range(num_clicks):
                # 무작위로 선택자 선택
                selector = random.choice(clickable_selectors)

                # 해당 선택자의 모든 요소 찾기
                elements = await page.query_selector_all(selector)

                if elements:
                    # 무작위 요소 선택
                    random_index = random.randint(0, len(elements) - 1)
                    element = elements[random_index]

                    # 요소가 화면에 보이는지 확인
                    is_visible = await element.is_visible()

                    if is_visible:
                        # 클릭
                        box = await element.bounding_box()
                        if box:
                            x = box['x'] + box['width'] / 2
                            y = box['y'] + box['height'] / 2

                            await page.mouse.move(x, y)
                            await asyncio.sleep(random.uniform(0.2, 0.5))

                            await page.mouse.click(x, y)
                            clicks += 1

                            # 클릭 후 대기
                            await asyncio.sleep(random.uniform(2.0, 5.0))

                            print(f"    클릭 {clicks}/{num_clicks}")

            print(f"  ✅ 무작위 클릭 완료: {clicks}회")

        except Exception as e:
            print(f"  ⚠️ 무작위 클릭 오류: {e}")

        return clicks

    def get_random_dwell_time(self, min_seconds=30, max_seconds=120):
        """
        무작위 체류 시간 반환 (초)

        Args:
            min_seconds: 최소 체류 시간
            max_seconds: 최대 체류 시간

        Returns:
            체류 시간 (초)
        """
        return random.uniform(min_seconds, max_seconds)
