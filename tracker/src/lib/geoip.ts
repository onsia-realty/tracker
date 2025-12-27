/**
 * IP 지역 정보 조회
 *
 * 무료 API 사용:
 * - ip-api.com (1분당 45요청, 상업용은 pro 필요)
 * - ipinfo.io (월 50,000 무료)
 */

// ===========================================
// 타입 정의
// ===========================================

export interface GeoIPInfo {
  ip: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  isVpn: boolean;
  isProxy: boolean;
  isHosting: boolean;
}

// ===========================================
// ip-api.com (무료, 상업용은 pro 필요)
// ===========================================

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  isp: string;
  org: string;
  as: string;
  hosting: boolean;
  proxy: boolean;
  query: string;
}

export async function getGeoIPFromIpApi(ip: string): Promise<GeoIPInfo | null> {
  try {
    // 로컬 IP는 스킵
    if (isLocalIP(ip)) {
      return {
        ip,
        country: '대한민국',
        countryCode: 'KR',
        region: '경기도',
        city: '로컬',
        isp: null,
        isVpn: false,
        isProxy: false,
        isHosting: false,
      };
    }

    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,isp,org,as,hosting,proxy,query&lang=ko`,
      { next: { revalidate: 86400 } } // 24시간 캐시
    );

    if (!response.ok) {
      console.error('ip-api.com error:', response.status);
      return null;
    }

    const data: IpApiResponse = await response.json();

    if (data.status !== 'success') {
      return null;
    }

    return {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      isp: data.isp,
      isVpn: false, // ip-api 무료 버전에서는 VPN 감지 불가
      isProxy: data.proxy,
      isHosting: data.hosting,
    };
  } catch (error) {
    console.error('GeoIP lookup failed:', error);
    return null;
  }
}

// ===========================================
// ipinfo.io (월 50,000 무료)
// ===========================================

interface IpInfoResponse {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  postal: string;
  timezone: string;
  privacy?: {
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    relay: boolean;
    hosting: boolean;
  };
}

export async function getGeoIPFromIpInfo(ip: string): Promise<GeoIPInfo | null> {
  const token = process.env.IPINFO_TOKEN;

  try {
    // 로컬 IP는 스킵
    if (isLocalIP(ip)) {
      return {
        ip,
        country: '대한민국',
        countryCode: 'KR',
        region: '경기도',
        city: '로컬',
        isp: null,
        isVpn: false,
        isProxy: false,
        isHosting: false,
      };
    }

    const url = token
      ? `https://ipinfo.io/${ip}?token=${token}`
      : `https://ipinfo.io/${ip}/json`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // 24시간 캐시
    });

    if (!response.ok) {
      console.error('ipinfo.io error:', response.status);
      return null;
    }

    const data: IpInfoResponse = await response.json();

    return {
      ip: data.ip,
      country: getCountryName(data.country),
      countryCode: data.country,
      region: data.region,
      city: data.city,
      isp: data.org,
      isVpn: data.privacy?.vpn || false,
      isProxy: data.privacy?.proxy || data.privacy?.tor || data.privacy?.relay || false,
      isHosting: data.privacy?.hosting || false,
    };
  } catch (error) {
    console.error('GeoIP lookup failed:', error);
    return null;
  }
}

// ===========================================
// 통합 조회 함수
// ===========================================

export async function getGeoIP(ip: string): Promise<GeoIPInfo | null> {
  // ipinfo.io 토큰이 있으면 ipinfo 사용, 없으면 ip-api 사용
  if (process.env.IPINFO_TOKEN) {
    return getGeoIPFromIpInfo(ip);
  }
  return getGeoIPFromIpApi(ip);
}

// ===========================================
// 유틸리티
// ===========================================

function isLocalIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  );
}

function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    KR: 'Korea',
    US: 'United States',
    JP: 'Japan',
    CN: 'China',
    TW: 'Taiwan',
    HK: 'Hong Kong',
    SG: 'Singapore',
    VN: 'Vietnam',
    TH: 'Thailand',
    ID: 'Indonesia',
    PH: 'Philippines',
    MY: 'Malaysia',
    IN: 'India',
    AU: 'Australia',
    GB: 'United Kingdom',
    DE: 'Germany',
    FR: 'France',
    CA: 'Canada',
    RU: 'Russia',
  };
  return countries[code] || code;
}

// ===========================================
// 클라이언트 IP 추출
// ===========================================

export function getClientIP(request: Request): string | null {
  // Vercel/Cloudflare 등의 프록시 헤더
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0] || null;
  }

  // Cloudflare
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  // Real IP
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  return null;
}
