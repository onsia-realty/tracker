// User-Agent 파싱 헬퍼
import { UAParser } from 'ua-parser-js';

export interface ParsedDevice {
  deviceType: string;      // mobile, tablet, desktop
  deviceVendor: string;    // Apple, Samsung, Google...
  deviceModel: string;     // iPhone 14 Pro, Galaxy S23...
  browser: string;         // Chrome, Safari, Firefox...
  browserVersion: string;  // 120.0.0.0
  os: string;              // iOS, Android, Windows...
  osVersion: string;       // 17.2, 14.0...
}

export function parseUserAgent(userAgent: string): ParsedDevice {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // 디바이스 타입
  let deviceType = 'desktop';
  if (result.device.type === 'mobile') deviceType = 'mobile';
  else if (result.device.type === 'tablet') deviceType = 'tablet';

  // 벤더 & 모델
  let deviceVendor = result.device.vendor || '';
  let deviceModel = result.device.model || '';

  // 특수 케이스 처리
  if (result.os.name === 'iOS') {
    deviceVendor = 'Apple';
    // iOS 기기 모델 추출 (User-Agent에서)
    deviceModel = extractiOSModel(userAgent);
  } else if (result.os.name === 'Android') {
    // Android 기기 모델 추출
    const extracted = extractAndroidModel(userAgent);
    if (extracted.vendor) deviceVendor = extracted.vendor;
    if (extracted.model) deviceModel = extracted.model;
  }

  // 브라우저 정보
  const browser = result.browser.name || 'Unknown';
  const browserVersion = result.browser.version || '';

  // OS 정보
  const os = result.os.name || 'Unknown';
  const osVersion = result.os.version || '';

  return {
    deviceType,
    deviceVendor: deviceVendor || 'Unknown',
    deviceModel: deviceModel || getDeviceTypeLabel(deviceType),
    browser,
    browserVersion,
    os,
    osVersion
  };
}

// iOS 기기 모델 추출
function extractiOSModel(ua: string): string {
  // iPhone 모델
  if (ua.includes('iPhone')) {
    // iPhone 15 Pro Max, iPhone 14 등 추출
    const match = ua.match(/iPhone\s?(\d+\s?\w*)/i);
    if (match) return `iPhone ${match[1].trim()}`;

    // 기본적으로 iPhone 표시
    return 'iPhone';
  }

  // iPad 모델
  if (ua.includes('iPad')) {
    const match = ua.match(/iPad(\d+,\d+)/);
    if (match) {
      return mapIPadModel(match[1]);
    }
    return 'iPad';
  }

  // iPod
  if (ua.includes('iPod')) return 'iPod touch';

  return 'iOS Device';
}

// Android 기기 모델 추출
function extractAndroidModel(ua: string): { vendor: string; model: string } {
  let vendor = '';
  let model = '';

  // Samsung Galaxy
  if (ua.includes('SM-')) {
    vendor = 'Samsung';
    const match = ua.match(/SM-([A-Z0-9]+)/);
    if (match) {
      model = mapSamsungModel(match[1]);
    }
  }
  // Google Pixel
  else if (ua.includes('Pixel')) {
    vendor = 'Google';
    const match = ua.match(/Pixel\s?(\d+\s?\w*)/i);
    model = match ? `Pixel ${match[1].trim()}` : 'Pixel';
  }
  // LG
  else if (ua.includes('LG-') || ua.includes('LM-')) {
    vendor = 'LG';
    const match = ua.match(/L[GM]-([A-Z0-9]+)/);
    model = match ? `LG ${match[1]}` : 'LG';
  }
  // Xiaomi
  else if (ua.includes('Mi ') || ua.includes('Redmi')) {
    vendor = 'Xiaomi';
    const miMatch = ua.match(/(?:Mi|Redmi)\s?([A-Z0-9\s]+)/i);
    model = miMatch ? miMatch[0].trim() : 'Xiaomi';
  }
  // Huawei
  else if (ua.includes('HUAWEI') || ua.includes('Honor')) {
    vendor = 'Huawei';
    const match = ua.match(/(?:HUAWEI|Honor)\s?([A-Z0-9-]+)/i);
    model = match ? match[0].trim() : 'Huawei';
  }
  // 일반 Android (Build 정보에서 추출)
  else {
    const buildMatch = ua.match(/Build\/([^;)]+)/);
    const modelMatch = ua.match(/;\s*([^;)]+)\s*Build/);

    if (modelMatch) {
      model = modelMatch[1].trim();
      // 벤더 추정
      if (model.includes('Galaxy')) vendor = 'Samsung';
      else if (model.includes('Pixel')) vendor = 'Google';
      else vendor = 'Android';
    }
  }

  return { vendor, model: model || 'Android Device' };
}

// iPad 모델 매핑
function mapIPadModel(identifier: string): string {
  const models: Record<string, string> = {
    // iPad Pro
    '8,1': 'iPad Pro 11" (1st)',
    '8,2': 'iPad Pro 11" (1st)',
    '8,3': 'iPad Pro 11" (1st)',
    '8,4': 'iPad Pro 11" (1st)',
    '13,4': 'iPad Pro 11" (3rd)',
    '13,5': 'iPad Pro 11" (3rd)',
    '13,6': 'iPad Pro 11" (3rd)',
    '13,7': 'iPad Pro 11" (3rd)',

    // iPad Air
    '13,1': 'iPad Air (4th)',
    '13,2': 'iPad Air (4th)',

    // 일반 iPad
    '11,1': 'iPad (8th)',
    '11,2': 'iPad (8th)',
    '12,1': 'iPad (9th)',
    '12,2': 'iPad (9th)',
  };

  return models[identifier] || 'iPad';
}

// Samsung 모델 매핑
function mapSamsungModel(code: string): string {
  // Galaxy S 시리즈
  if (code.startsWith('S9')) return 'Galaxy S23';
  if (code.startsWith('S90')) return 'Galaxy S22';
  if (code.startsWith('S91')) return 'Galaxy S21';

  // Galaxy Note
  if (code.startsWith('N9')) return 'Galaxy Note 20';

  // Galaxy A 시리즈
  if (code.startsWith('A5')) return 'Galaxy A54';
  if (code.startsWith('A3')) return 'Galaxy A34';

  // Galaxy Z (폴더블)
  if (code.startsWith('F9')) return 'Galaxy Z Fold';
  if (code.startsWith('F7')) return 'Galaxy Z Flip';

  return `Galaxy ${code}`;
}

// 디바이스 타입 레이블
function getDeviceTypeLabel(type: string): string {
  switch (type) {
    case 'mobile': return 'Mobile';
    case 'tablet': return 'Tablet';
    case 'desktop': return 'Desktop';
    default: return 'Unknown';
  }
}

// 디바이스 정보를 한국어로 포맷팅
export function formatDeviceInfo(device: ParsedDevice): string {
  const parts: string[] = [];

  // 벤더 + 모델
  if (device.deviceVendor !== 'Unknown' && device.deviceModel) {
    if (device.deviceVendor === 'Apple') {
      parts.push(device.deviceModel); // "iPhone 14 Pro"
    } else {
      parts.push(`${device.deviceVendor} ${device.deviceModel}`);
    }
  } else if (device.deviceModel !== 'Unknown') {
    parts.push(device.deviceModel);
  }

  // OS + 버전
  if (device.os !== 'Unknown') {
    const osInfo = device.osVersion
      ? `${device.os} ${device.osVersion.split('.')[0]}`
      : device.os;
    parts.push(osInfo);
  }

  return parts.length > 0 ? parts.join(' · ') : device.deviceType;
}
