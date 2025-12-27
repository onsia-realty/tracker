"""
디바이스 에뮬레이션 모듈
모바일/PC 자동 전환 및 실제 디바이스 프로필 제공
"""

import random


class DeviceEmulator:
    # 실제 디바이스 데이터베이스
    MOBILE_DEVICES = [
        # Samsung Galaxy 시리즈
        {
            "name": "Galaxy S23 Ultra",
            "user_agent": "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
            "viewport": {"width": 412, "height": 915},
            "device_scale_factor": 3.5,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Samsung",
            "os": "Android 13"
        },
        {
            "name": "Galaxy S22",
            "user_agent": "Mozilla/5.0 (Linux; Android 12; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36",
            "viewport": {"width": 360, "height": 800},
            "device_scale_factor": 3.0,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Samsung",
            "os": "Android 12"
        },
        {
            "name": "Galaxy A54",
            "user_agent": "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Mobile Safari/537.36",
            "viewport": {"width": 412, "height": 915},
            "device_scale_factor": 2.5,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Samsung",
            "os": "Android 13"
        },
        # LG 시리즈
        {
            "name": "LG V50 ThinQ",
            "user_agent": "Mozilla/5.0 (Linux; Android 11; LM-V500N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36",
            "viewport": {"width": 412, "height": 869},
            "device_scale_factor": 3.0,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "LG",
            "os": "Android 11"
        },
        # Google Pixel 시리즈
        {
            "name": "Pixel 7 Pro",
            "user_agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
            "viewport": {"width": 412, "height": 915},
            "device_scale_factor": 3.5,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Google",
            "os": "Android 13"
        },
        {
            "name": "Pixel 6",
            "user_agent": "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36",
            "viewport": {"width": 412, "height": 915},
            "device_scale_factor": 2.625,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Google",
            "os": "Android 12"
        },
        # iPhone 시리즈
        {
            "name": "iPhone 14 Pro Max",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            "viewport": {"width": 430, "height": 932},
            "device_scale_factor": 3.0,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Apple",
            "os": "iOS 16"
        },
        {
            "name": "iPhone 13",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
            "viewport": {"width": 390, "height": 844},
            "device_scale_factor": 3.0,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Apple",
            "os": "iOS 15"
        },
        {
            "name": "iPhone 12",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
            "viewport": {"width": 390, "height": 844},
            "device_scale_factor": 3.0,
            "is_mobile": True,
            "has_touch": True,
            "manufacturer": "Apple",
            "os": "iOS 14"
        },
    ]

    DESKTOP_DEVICES = [
        {
            "name": "Windows Desktop - Chrome",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "viewport": {"width": 1920, "height": 1080},
            "device_scale_factor": 1.0,
            "is_mobile": False,
            "has_touch": False,
            "manufacturer": "PC",
            "os": "Windows 10"
        },
        {
            "name": "Windows Desktop - Edge",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
            "viewport": {"width": 1920, "height": 1080},
            "device_scale_factor": 1.0,
            "is_mobile": False,
            "has_touch": False,
            "manufacturer": "PC",
            "os": "Windows 10"
        },
        {
            "name": "Mac Desktop - Safari",
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
            "viewport": {"width": 1440, "height": 900},
            "device_scale_factor": 2.0,
            "is_mobile": False,
            "has_touch": False,
            "manufacturer": "Apple",
            "os": "macOS"
        },
        {
            "name": "Mac Desktop - Chrome",
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "viewport": {"width": 1440, "height": 900},
            "device_scale_factor": 2.0,
            "is_mobile": False,
            "has_touch": False,
            "manufacturer": "Apple",
            "os": "macOS"
        },
        {
            "name": "Laptop - 1366x768",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "viewport": {"width": 1366, "height": 768},
            "device_scale_factor": 1.0,
            "is_mobile": False,
            "has_touch": False,
            "manufacturer": "PC",
            "os": "Windows 10"
        },
        {
            "name": "Desktop - 2560x1440",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "viewport": {"width": 2560, "height": 1440},
            "device_scale_factor": 1.0,
            "is_mobile": False,
            "has_touch": False,
            "manufacturer": "PC",
            "os": "Windows 10"
        },
    ]

    def get_random_device(self, device_type=None):
        """
        무작위 디바이스 선택

        Args:
            device_type: 'mobile', 'desktop', None (자동 선택)

        Returns:
            디바이스 프로필 딕셔너리
        """
        if device_type == 'mobile':
            return random.choice(self.MOBILE_DEVICES)
        elif device_type == 'desktop':
            return random.choice(self.DESKTOP_DEVICES)
        else:
            # 모바일 60%, 데스크톱 40% 비율
            if random.random() < 0.6:
                return random.choice(self.MOBILE_DEVICES)
            else:
                return random.choice(self.DESKTOP_DEVICES)

    def get_device_info_string(self, device):
        """디바이스 정보를 보기 좋은 문자열로 반환"""
        device_type = "모바일" if device['is_mobile'] else "데스크톱"
        return f"{device_type} | {device['name']} ({device['os']}) | {device['viewport']['width']}x{device['viewport']['height']}"

    async def apply_device(self, page, device):
        """
        Playwright 페이지에 디바이스 설정 적용

        Args:
            page: Playwright 페이지 객체
            device: 디바이스 프로필

        Returns:
            적용된 디바이스 프로필
        """
        # User-Agent 설정
        await page.set_extra_http_headers({
            'User-Agent': device['user_agent']
        })

        # 뷰포트 설정
        await page.set_viewport_size(device['viewport'])

        # 모바일 터치 에뮬레이션
        if device['is_mobile']:
            await page.emulate_media(media='screen')

        return device
