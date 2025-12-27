"""
휴대폰 USB 테더링을 통한 IP 변경 모듈
ADB (Android Debug Bridge)를 사용하여 비행기 모드를 제어하고 IP를 초기화합니다.
"""

import subprocess
import time
import requests


class PhoneTethering:
    def __init__(self, max_sessions=10):
        """
        Args:
            max_sessions: 몇 건의 세션 후 IP를 변경할지 (기본: 10)
        """
        self.session_count = 0
        self.max_sessions_per_ip = max_sessions
        self.current_ip = None

    def is_phone_connected(self):
        """휴대폰 USB 연결 확인"""
        try:
            result = subprocess.run(
                ['adb', 'devices'],
                capture_output=True,
                text=True,
                timeout=5
            )

            # 연결된 디바이스가 있는지 확인
            lines = result.stdout.strip().split('\n')
            devices = [line for line in lines[1:] if '\tdevice' in line]

            return len(devices) > 0

        except FileNotFoundError:
            print("❌ ADB가 설치되지 않았습니다!")
            print("   다운로드: https://developer.android.com/studio/releases/platform-tools")
            print("   설치 후 시스템 PATH에 추가하세요.")
            return False
        except Exception as e:
            print(f"ADB 오류: {e}")
            return False

    def get_current_ip(self):
        """현재 IP 주소 확인"""
        try:
            response = requests.get('https://api.ipify.org?format=json', timeout=10)
            if response.status_code == 200:
                return response.json()['ip']
        except:
            pass
        return None

    def reset_ip_via_airplane_mode(self):
        """비행기 모드로 IP 초기화"""
        try:
            print("\n📡 비행기 모드로 IP 초기화 중...")

            # 1. 비행기 모드 ON
            result = subprocess.run(
                ['adb', 'shell', 'cmd', 'connectivity', 'airplane-mode', 'enable'],
                capture_output=True,
                timeout=10
            )

            if result.returncode != 0:
                print("  ⚠️ 비행기 모드 활성화 실패 (권한 문제일 수 있음)")
                print("  수동으로 휴대폰에서 비행기 모드를 켜고 10초 후 꺼주세요.")
                input("  Enter를 눌러 계속...")
                return self._manual_ip_check()

            print("  ✈️ 비행기 모드 ON")
            time.sleep(5)  # 5초 대기

            # 2. 비행기 모드 OFF
            subprocess.run(
                ['adb', 'shell', 'cmd', 'connectivity', 'airplane-mode', 'disable'],
                capture_output=True,
                timeout=10
            )
            print("  📶 비행기 모드 OFF")
            time.sleep(10)  # 네트워크 재연결 대기

            # 3. 새 IP 확인
            new_ip = self.get_current_ip()

            if new_ip and new_ip != self.current_ip:
                print(f"  ✅ IP 변경 성공: {self.current_ip} → {new_ip}")
                self.current_ip = new_ip
                self.session_count = 0  # 카운터 리셋
                return True
            else:
                print(f"  ⚠️ IP 변경 실패 (동일 IP: {new_ip})")
                print("  재시도 중...")
                return self._retry_ip_reset()

        except Exception as e:
            print(f"❌ 비행기 모드 오류: {e}")
            return False

    def _retry_ip_reset(self, max_retries=2):
        """IP 리셋 재시도"""
        for i in range(max_retries):
            print(f"  🔄 재시도 {i+1}/{max_retries}...")
            time.sleep(5)

            # 비행기 모드 다시 ON/OFF
            subprocess.run(['adb', 'shell', 'cmd', 'connectivity', 'airplane-mode', 'enable'], capture_output=True)
            time.sleep(5)
            subprocess.run(['adb', 'shell', 'cmd', 'connectivity', 'airplane-mode', 'disable'], capture_output=True)
            time.sleep(10)

            new_ip = self.get_current_ip()
            if new_ip and new_ip != self.current_ip:
                print(f"  ✅ IP 변경 성공: {self.current_ip} → {new_ip}")
                self.current_ip = new_ip
                self.session_count = 0
                return True

        return False

    def _manual_ip_check(self):
        """수동 IP 확인"""
        new_ip = self.get_current_ip()
        if new_ip and new_ip != self.current_ip:
            print(f"  ✅ IP 변경 확인: {self.current_ip} → {new_ip}")
            self.current_ip = new_ip
            self.session_count = 0
            return True
        return False

    def should_reset_ip(self):
        """IP 리셋이 필요한지 확인"""
        return self.session_count >= self.max_sessions_per_ip

    def increment_session(self):
        """세션 카운터 증가"""
        self.session_count += 1
        remaining = self.max_sessions_per_ip - self.session_count
        print(f"📊 세션 카운터: {self.session_count}/{self.max_sessions_per_ip} (IP 변경까지 {remaining}회 남음)")

    def wait_for_phone_connection(self):
        """휴대폰 연결 대기"""
        print("\n" + "="*60)
        print("⏳ 휴대폰 USB 연결 대기 중...")
        print("="*60)
        print("\n📱 설정 방법:")
        print("  1. USB 케이블로 휴대폰과 PC 연결")
        print("  2. 휴대폰 설정 → 휴대폰 정보 → 빌드번호 7번 탭")
        print("  3. 개발자 옵션 → USB 디버깅 ON")
        print("  4. USB 디버깅 허용 팝업에서 '확인'")
        print("  5. 설정 → 네트워크 → 핫스팟 및 테더링 → USB 테더링 ON")
        print("\n")

        while not self.is_phone_connected():
            time.sleep(5)
            print("  ⏳ 연결 대기 중... (5초마다 재확인)")

        print("✅ 휴대폰 연결 확인!")
        print("="*60)

        # 초기 IP 확인
        self.current_ip = self.get_current_ip()
        if self.current_ip:
            print(f"📱 현재 IP: {self.current_ip}\n")
        else:
            print("⚠️ IP 주소를 확인할 수 없습니다. 인터넷 연결을 확인하세요.\n")

    def get_device_info(self):
        """연결된 휴대폰 정보 확인"""
        try:
            # 디바이스 모델명
            model = subprocess.run(
                ['adb', 'shell', 'getprop', 'ro.product.model'],
                capture_output=True,
                text=True,
                timeout=5
            ).stdout.strip()

            # Android 버전
            android_version = subprocess.run(
                ['adb', 'shell', 'getprop', 'ro.build.version.release'],
                capture_output=True,
                text=True,
                timeout=5
            ).stdout.strip()

            return {
                'model': model,
                'android_version': android_version
            }
        except:
            return None
