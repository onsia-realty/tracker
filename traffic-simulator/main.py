"""
웹사이트 트래픽 시뮬레이터 (휴대폰 USB 테더링 모드)
자연스러운 트래픽 생성 및 IP 자동 변경
"""

import asyncio
import random
from datetime import datetime
from playwright.async_api import async_playwright

from modules.phone_tethering import PhoneTethering
from modules.device_emulator import DeviceEmulator
from modules.behavior_simulator import BehaviorSimulator
from modules.referrer_handler import ReferrerHandler
from modules.session_logger import SessionLogger
from modules.rank_tracker import RankTracker


class TrafficSimulator:
    def __init__(self, mode='tethering', max_sessions_per_ip=10):
        """
        Args:
            mode: 'tethering' (휴대폰 테더링) 또는 'proxy' (유료 프록시)
            max_sessions_per_ip: IP당 최대 세션 수 (기본: 10)
        """
        self.mode = mode
        self.phone = PhoneTethering(max_sessions=max_sessions_per_ip)
        self.device_emulator = DeviceEmulator()
        self.behavior = BehaviorSimulator()
        self.referrer = ReferrerHandler(target_url='yongin-honorsville.vercel.app')
        self.logger = SessionLogger()
        self.rank_tracker = RankTracker(target_url='yongin-honorsville.vercel.app')

        print(f"\n{'='*60}")
        print(f"🚀 트래픽 시뮬레이터 초기화")
        print(f"{'='*60}")
        print(f"  모드: {'휴대폰 USB 테더링' if mode == 'tethering' else '유료 프록시'}")
        print(f"  IP당 세션 수: {max_sessions_per_ip}")
        print(f"{'='*60}\n")

    async def run_session(self):
        """한 번의 세션 실행"""
        session_data = {}
        session_start = datetime.now()

        try:
            # 1. IP 리셋 필요 확인
            if self.phone.should_reset_ip():
                print(f"\n{'='*60}")
                print(f"🔄 IP 변경 필요 (현재: {self.phone.session_count}/{self.phone.max_sessions_per_ip})")
                print(f"{'='*60}\n")

                success = self.phone.reset_ip_via_airplane_mode()
                if not success:
                    print("⚠️ IP 리셋 실패, 계속 진행...")

            # 현재 IP 기록
            current_ip = self.phone.get_current_ip()
            session_data['proxy_ip'] = current_ip
            session_data['proxy_country'] = 'kr'
            session_data['proxy_session_id'] = f"tethering_{current_ip}"

            # 2. 디바이스 선택 (모바일 60% / 데스크톱 40%)
            device = self.device_emulator.get_random_device()
            device_info = self.device_emulator.get_device_info_string(device)

            session_data['device_type'] = 'mobile' if device['is_mobile'] else 'desktop'
            session_data['device_name'] = device['name']
            session_data['user_agent'] = device['user_agent']
            session_data['viewport_width'] = device['viewport']['width']
            session_data['viewport_height'] = device['viewport']['height']

            print(f"\n{'='*60}")
            print(f"📱 세션 시작")
            print(f"{'='*60}")
            print(f"  IP: {current_ip}")
            print(f"  디바이스: {device_info}")
            print(f"{'='*60}\n")

            # 3. 브라우저 실행
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=False,  # 브라우저 창 보이도록
                    args=['--disable-blink-features=AutomationControlled']
                )

                context = await browser.new_context(
                    user_agent=device['user_agent'],
                    viewport=device['viewport'],
                    device_scale_factor=device['device_scale_factor'],
                    is_mobile=device['is_mobile'],
                    has_touch=device['has_touch']
                )

                page = await context.new_page()

                # 4. Referrer 실행 (네이버/구글/소셜/직접)
                referrer_type, referrer_param = await self.referrer.execute_referrer(page)
                session_data['referrer_type'] = referrer_type
                session_data['referrer_keyword'] = referrer_param

                # 5. 페이지 로드 대기
                await asyncio.sleep(random.uniform(3, 6))

                # 6. 행동 시뮬레이션
                print("  🎬 행동 시뮬레이션 시작\n")

                # 마우스 움직임
                mouse_count = await self.behavior.random_mouse_movements(page)
                session_data['mouse_movements'] = mouse_count

                # 스크롤
                scroll_depth = await self.behavior.human_scroll(page)
                session_data['scroll_depth_percent'] = scroll_depth

                # 무작위 클릭
                clicks = await self.behavior.random_page_interaction(page)
                session_data['clicks'] = clicks
                session_data['pages_visited'] = clicks + 1  # 메인 페이지 + 클릭한 페이지

                # 체류 시간 (30-120초)
                dwell_time = self.behavior.get_random_dwell_time(30, 120)
                print(f"\n  ⏳ 체류 중... ({dwell_time:.1f}초)")
                await asyncio.sleep(dwell_time)
                session_data['dwell_time_seconds'] = int(dwell_time)

                # 7. 부정클릭 스코어 (실제로는 네트워크 리스너로 구현 필요)
                fraud_score = random.randint(10, 45)
                session_data['fraud_score'] = fraud_score
                session_data['is_blocked'] = fraud_score >= 80

                if session_data['is_blocked']:
                    session_data['status'] = 'blocked'
                    session_data['block_reason'] = 'High fraud score'
                    print(f"\n  🚨 차단됨! 부정클릭 점수: {fraud_score}\n")
                else:
                    session_data['status'] = 'success'
                    print(f"\n  ✅ 성공! 부정클릭 점수: {fraud_score}\n")

                # 브라우저 종료
                await browser.close()

            # 세션 카운터 증가
            self.phone.increment_session()

        except Exception as e:
            print(f"\n❌ 오류 발생: {e}\n")
            session_data['status'] = 'failed'
            session_data['error_message'] = str(e)

        finally:
            # 다음 실행까지 대기 시간 (5-10분)
            next_delay = random.randint(300, 600)
            session_data['next_run_delay_seconds'] = next_delay

            # 세션 로그 저장
            self.logger.log_session(session_data)

            print(f"{'='*60}")
            print(f"💾 세션 기록 저장 완료")
            print(f"⏰ 다음 실행까지 {next_delay/60:.1f}분 대기...")
            print(f"{'='*60}\n")

            return next_delay

    async def run_manual_mode(self):
        """수동 모드 (휴대폰 연결 시에만)"""
        # 휴대폰 연결 대기
        self.phone.wait_for_phone_connection()

        # 휴대폰 정보 출력
        device_info = self.phone.get_device_info()
        if device_info:
            print(f"📱 연결된 기기: {device_info['model']} (Android {device_info['android_version']})")
            print()

        session_count = 0
        last_rank_check = datetime.now()

        while True:
            try:
                # 휴대폰 연결 확인
                if not self.phone.is_phone_connected():
                    print("\n❌ 휴대폰 연결 끊김!")
                    print("다시 연결해주세요...\n")
                    self.phone.wait_for_phone_connection()

                session_count += 1

                # 세션 실행
                next_delay = await self.run_session()

                # 하루에 1번 순위 체크 (24시간마다)
                hours_since_rank_check = (datetime.now() - last_rank_check).total_seconds() / 3600
                if hours_since_rank_check >= 24:
                    print("\n📊 검색 순위 체크 시작...\n")
                    keywords = ['용인 아파트', '용인 클러스터', '경남 아너스빌']
                    await self.rank_tracker.check_all_rankings(keywords)
                    last_rank_check = datetime.now()

                # 통계 출력
                self.logger.print_statistics('today')

                # 대기
                await asyncio.sleep(next_delay)

            except KeyboardInterrupt:
                print("\n⛔ 사용자에 의해 중지됨\n")
                break
            except Exception as e:
                print(f"\n❌ 예상치 못한 오류: {e}")
                print("60초 후 재시도...\n")
                await asyncio.sleep(60)


async def main():
    print("\n" + "="*60)
    print("🚀 웹사이트 트래픽 시뮬레이터")
    print("="*60)
    print("\n⚠️  중요 경고:")
    print("   이 도구는 교육 및 자체 웹사이트 테스트 목적으로만 사용하세요.")
    print("   검색 엔진 조작 목적의 사용은 정책 위반입니다.\n")
    print("="*60 + "\n")

    # 휴대폰 테더링 모드로 실행
    simulator = TrafficSimulator(mode='tethering', max_sessions_per_ip=10)
    await simulator.run_manual_mode()


if __name__ == "__main__":
    asyncio.run(main())
