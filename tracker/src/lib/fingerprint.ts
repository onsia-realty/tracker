/**
 * 브라우저 핑거프린트 라이브러리
 *
 * 4레이어 추적:
 * 1. IP 주소 (서버에서 수집)
 * 2. 쿠키 ID (보조 식별자)
 * 3. 브라우저 핑거프린트 (핵심)
 * 4. 행동 패턴 (부정클릭 탐지용)
 */

import * as UAParser from 'ua-parser-js';

// ===========================================
// 타입 정의
// ===========================================

export interface FingerprintData {
  // 핑거프린트 해시
  hash: string;

  // 디바이스 정보
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;

  // Canvas/WebGL (핵심 식별자)
  canvasHash: string;
  webglHash: string;
  audioHash: string;

  // 기타 속성
  timezone: string;
  language: string;
  languages: string[];
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  touchSupport: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;

  // 폰트 (간접 감지)
  fontsHash: string;
}

export interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  deviceVendor: string | null; // Apple, Samsung, Google, Xiaomi...
  deviceModel: string | null;  // iPhone 14 Pro, Galaxy S23, Pixel 7...
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

// ===========================================
// 해시 유틸리티
// ===========================================

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ===========================================
// 디바이스/브라우저 감지
// ===========================================

// getDeviceInfo는 detectDevice의 alias
export const getDeviceInfo = (): Promise<DeviceInfo> => detectDevice();

export async function detectDevice(): Promise<DeviceInfo> {
  const ua = navigator.userAgent;

  // 1. 먼저 User-Agent Client Hints 시도 (최신 Chrome/Edge)
  let deviceVendor: string | null = null;
  let deviceModel: string | null = null;

  if ('userAgentData' in navigator) {
    try {
      const uaData = (navigator as any).userAgentData;
      const highEntropy = await uaData.getHighEntropyValues([
        'model',
        'platform',
        'platformVersion'
      ]);

      if (highEntropy.model && highEntropy.model !== '') {
        deviceModel = highEntropy.model;
        // 벤더 추정 (플랫폼 기반)
        if (highEntropy.platform === 'Android') {
          // 안드로이드는 모델명으로 벤더 추정
          if (deviceModel.toLowerCase().includes('sm-')) deviceVendor = 'Samsung';
          else if (deviceModel.toLowerCase().includes('pixel')) deviceVendor = 'Google';
          else deviceVendor = 'Android';
        }
      }
    } catch (err) {
      console.warn('Client Hints failed:', err);
    }
  }

  // 2. UAParser 폴백 (모든 브라우저 지원)
  const parser = new UAParser.UAParser(ua);
  const result = parser.getResult();

  // Client Hints로 못 가져왔으면 UAParser 결과 사용
  if (!deviceVendor) deviceVendor = result.device.vendor || null;
  if (!deviceModel) deviceModel = result.device.model || null;

  // 디바이스 타입 감지
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (result.device.type === 'tablet') {
    deviceType = 'tablet';
  } else if (result.device.type === 'mobile') {
    deviceType = 'mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // 브라우저/OS 감지
  const browser = result.browser.name || 'Unknown';
  const browserVersion = result.browser.version || '';
  const os = result.os.name || 'Unknown';
  const osVersion = result.os.version || '';

  return {
    deviceType,
    deviceVendor,
    deviceModel,
    browser,
    browserVersion,
    os,
    osVersion,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    userAgent: ua,
  };
}

// ===========================================
// Canvas 핑거프린트
// ===========================================

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;

    // 텍스트 그리기 (GPU/드라이버에 따라 미세하게 다름)
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('ONSIA Tracker', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('ONSIA Tracker', 4, 17);

    // 도형 그리기
    ctx.beginPath();
    ctx.arc(50, 25, 20, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

// ===========================================
// WebGL 핑거프린트
// ===========================================

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const webgl = gl as WebGLRenderingContext;
    const debugInfo = webgl.getExtension('WEBGL_debug_renderer_info');

    if (debugInfo) {
      const vendor = webgl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return `${vendor}~${renderer}`;
    }

    return webgl.getParameter(webgl.VERSION) || 'webgl-basic';
  } catch {
    return 'webgl-error';
  }
}

// ===========================================
// Audio 핑거프린트
// ===========================================

async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return 'no-audio';

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    const processor = context.createScriptProcessor(4096, 1, 1);

    gain.gain.value = 0; // 음소거
    oscillator.type = 'triangle';
    oscillator.connect(analyser);
    analyser.connect(processor);
    processor.connect(gain);
    gain.connect(context.destination);
    oscillator.start(0);

    return new Promise((resolve) => {
      processor.onaudioprocess = function(event) {
        const data = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += Math.abs(data[i]);
        }
        oscillator.disconnect();
        processor.disconnect();
        context.close();
        resolve(sum.toString());
      };

      // 타임아웃
      setTimeout(() => {
        try {
          oscillator.disconnect();
          processor.disconnect();
          context.close();
        } catch { /* ignore */ }
        resolve('audio-timeout');
      }, 500);
    });
  } catch {
    return 'audio-error';
  }
}

// ===========================================
// 폰트 핑거프린트 (간접 감지)
// ===========================================

function getFontsFingerprint(): string {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
    'Georgia', 'Impact', 'Times New Roman', 'Trebuchet MS',
    'Verdana', 'Malgun Gothic', 'Dotum', 'Gulim', 'Batang'
  ];

  const testString = 'mmmmmmmmlli';
  const testSize = '72px';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'no-font-canvas';

  const getWidth = (font: string): number => {
    ctx.font = `${testSize} ${font}`;
    return ctx.measureText(testString).width;
  };

  const baseWidths: Record<string, number> = {};
  baseFonts.forEach(font => {
    baseWidths[font] = getWidth(font);
  });

  const detected: string[] = [];
  testFonts.forEach(font => {
    for (const baseFont of baseFonts) {
      const width = getWidth(`'${font}', ${baseFont}`);
      if (width !== baseWidths[baseFont]) {
        detected.push(font);
        break;
      }
    }
  });

  return detected.join(',');
}

// ===========================================
// 메인 핑거프린트 생성
// ===========================================

export async function generateFingerprint(): Promise<FingerprintData> {
  const device = await detectDevice();

  // 각종 핑거프린트 수집
  const canvasRaw = getCanvasFingerprint();
  const webglRaw = getWebGLFingerprint();
  const audioRaw = await getAudioFingerprint();
  const fontsRaw = getFontsFingerprint();

  // 해시 생성
  const canvasHash = simpleHash(canvasRaw);
  const webglHash = simpleHash(webglRaw);
  const audioHash = simpleHash(audioRaw);
  const fontsHash = simpleHash(fontsRaw);

  // 기타 속성 수집
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  const languages = Array.from(navigator.languages);
  const colorDepth = window.screen.colorDepth;
  const pixelRatio = window.devicePixelRatio;
  const hardwareConcurrency = navigator.hardwareConcurrency || 0;
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || null;
  const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const cookiesEnabled = navigator.cookieEnabled;
  const doNotTrack = navigator.doNotTrack === '1';

  // 최종 해시 생성 (모든 속성 조합)
  const components = [
    canvasHash,
    webglHash,
    audioHash,
    fontsHash,
    timezone,
    language,
    colorDepth.toString(),
    pixelRatio.toString(),
    hardwareConcurrency.toString(),
    deviceMemory?.toString() || '',
    device.screenWidth.toString(),
    device.screenHeight.toString(),
    device.browser,
    device.os,
    touchSupport.toString(),
  ].join('|');

  const hash = await sha256(components);

  return {
    hash: `fp_${hash.substring(0, 32)}`, // 32자로 축약
    deviceType: device.deviceType,
    browser: device.browser,
    browserVersion: device.browserVersion,
    os: device.os,
    osVersion: device.osVersion,
    screenWidth: device.screenWidth,
    screenHeight: device.screenHeight,
    canvasHash,
    webglHash,
    audioHash,
    fontsHash,
    timezone,
    language,
    languages,
    colorDepth,
    pixelRatio,
    hardwareConcurrency,
    deviceMemory,
    touchSupport,
    cookiesEnabled,
    doNotTrack,
  };
}

// ===========================================
// 쿠키 ID 관리 (보조 식별자)
// ===========================================

const COOKIE_NAME = '_onsia_cid';
const COOKIE_EXPIRY_DAYS = 365;

export function getCookieId(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
  return match ? match[2] : null;
}

export function setCookieId(id: string): void {
  if (typeof document === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  document.cookie = `${COOKIE_NAME}=${id};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

export function generateCookieId(): string {
  return `cid_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// ===========================================
// UTM 파라미터 파싱
// ===========================================

export interface UTMParams {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

export function parseUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return { source: null, medium: null, campaign: null, content: null, term: null };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
  };
}

// ===========================================
// 유입 경로 분석
// ===========================================

export function analyzeReferrer(): { referrer: string | null; domain: string | null; source: string } {
  if (typeof document === 'undefined') {
    return { referrer: null, domain: null, source: 'direct' };
  }

  const referrer = document.referrer || null;
  if (!referrer) {
    return { referrer: null, domain: null, source: 'direct' };
  }

  try {
    const url = new URL(referrer);
    const domain = url.hostname;

    // 소스 분류
    let source = 'other';
    if (domain.includes('naver.com') || domain.includes('search.naver')) {
      source = 'naver';
    } else if (domain.includes('google.com') || domain.includes('google.co.kr')) {
      source = 'google';
    } else if (domain.includes('daum.net') || domain.includes('search.daum')) {
      source = 'daum';
    } else if (domain.includes('facebook.com') || domain.includes('instagram.com')) {
      source = 'social';
    } else if (domain.includes('kakao.com')) {
      source = 'kakao';
    }

    return { referrer, domain, source };
  } catch {
    return { referrer, domain: null, source: 'other' };
  }
}
