/**
 * ONSIA 방문자 추적 SDK
 * - 체류시간 (dwell time)
 * - 스크롤 깊이 (scroll depth)
 * - 마우스 움직임 (mouse movements)
 * - 클릭 이벤트 (click tracking)
 * - 핑거프린팅 (browser fingerprint)
 */

interface TrackerConfig {
  endpoint: string;          // API 서버 URL
  siteId: string;            // 분양현장 식별자
  debug?: boolean;           // 디버그 모드
  heartbeatInterval?: number; // 체류시간 업데이트 주기 (ms)
  scrollThreshold?: number;  // 스크롤 기록 단위 (%)
}

interface SessionData {
  sessionId: string;
  fingerprint: string;
  startTime: number;
  lastActiveTime: number;
  pageviews: PageviewData[];
  currentPageview: PageviewData | null;
}

interface PageviewData {
  pageviewId: string;
  path: string;
  title: string;
  enterTime: number;
  exitTime?: number;
  dwellTime: number;         // 초
  maxScrollDepth: number;    // %
  scrollMilestones: number[]; // 도달한 스크롤 지점들 [25, 50, 75, 100]
  mouseMovements: number;
  clicks: ClickData[];
  isActive: boolean;         // 탭이 활성 상태인지
  hiddenTime: number;        // 숨겨져 있던 총 시간
}

interface ClickData {
  timestamp: number;
  x: number;
  y: number;
  target: string;            // 클릭한 요소 selector
  targetText?: string;       // 버튼 텍스트 등
  eventType: 'click' | 'phone_click' | 'cta_click' | 'ad_click';
}

interface FingerprintData {
  canvas: string;
  webgl: string;
  audio: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  userAgent: string;
  touchSupport: boolean;
}

class OnsiaTracker {
  private config: TrackerConfig;
  private session: SessionData | null = null;
  private heartbeatTimer: number | null = null;
  private scrollTimer: number | null = null;
  private lastScrollDepth: number = 0;
  private mouseCount: number = 0;
  private hiddenStartTime: number | null = null;

  constructor(config: TrackerConfig) {
    this.config = {
      heartbeatInterval: 5000,  // 5초마다 체류시간 업데이트
      scrollThreshold: 10,      // 10% 단위로 스크롤 기록
      debug: false,
      ...config
    };
  }

  // ========== 초기화 ==========
  async init(): Promise<void> {
    // 핑거프린트 생성
    const fingerprint = await this.generateFingerprint();
    
    // 세션 생성/복원
    this.session = this.getOrCreateSession(fingerprint);
    
    // 이벤트 리스너 등록
    this.setupEventListeners();
    
    // 페이지뷰 시작
    this.startPageview();
    
    // 하트비트 시작
    this.startHeartbeat();
    
    this.log('Tracker initialized', { fingerprint: fingerprint.substring(0, 8) + '...' });
  }

  // ========== 핑거프린팅 ==========
  private async generateFingerprint(): Promise<string> {
    const components: FingerprintData = {
      canvas: await this.getCanvasFingerprint(),
      webgl: this.getWebGLFingerprint(),
      audio: await this.getAudioFingerprint(),
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}x${window.devicePixelRatio}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
      userAgent: navigator.userAgent,
      touchSupport: 'ontouchstart' in window
    };

    // 해시 생성
    const str = JSON.stringify(components);
    const hash = await this.sha256(str);
    return 'fp_' + hash.substring(0, 32);
  }

  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      canvas.width = 200;
      canvas.height = 50;
      
      // 텍스트 렌더링 (GPU/드라이버마다 미세하게 다름)
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('ONSIA Tracker 🏠', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('fingerprint', 4, 17);

      return await this.sha256(canvas.toDataURL());
    } catch {
      return 'canvas-error';
    }
  }

  private getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';

      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return 'no-debug-info';

      const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      
      return `${vendor}|${renderer}`;
    } catch {
      return 'webgl-error';
    }
  }

  private async getAudioFingerprint(): Promise<string> {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return 'no-audio';

      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gain = context.createGain();
      const processor = context.createScriptProcessor(4096, 1, 1);

      gain.gain.value = 0; // 무음
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(processor);
      processor.connect(gain);
      gain.connect(context.destination);
      oscillator.start(0);

      const buffer = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(buffer);
      
      oscillator.disconnect();
      processor.disconnect();
      context.close();

      return await this.sha256(buffer.slice(0, 30).toString());
    } catch {
      return 'audio-error';
    }
  }

  private async sha256(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ========== 세션 관리 ==========
  private getOrCreateSession(fingerprint: string): SessionData {
    const storageKey = `onsia_session_${this.config.siteId}`;
    const stored = sessionStorage.getItem(storageKey);
    
    if (stored) {
      const session = JSON.parse(stored) as SessionData;
      // 30분 이내면 기존 세션 유지
      if (Date.now() - session.lastActiveTime < 30 * 60 * 1000) {
        session.fingerprint = fingerprint; // 핑거프린트 업데이트
        return session;
      }
    }

    // 새 세션 생성
    const newSession: SessionData = {
      sessionId: this.generateId(),
      fingerprint,
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      pageviews: [],
      currentPageview: null
    };

    this.saveSession(newSession);
    
    // 서버에 세션 시작 알림
    this.sendEvent('session_start', {
      sessionId: newSession.sessionId,
      fingerprint,
      referrer: document.referrer,
      utm: this.getUTMParams()
    });

    return newSession;
  }

  private saveSession(session: SessionData): void {
    const storageKey = `onsia_session_${this.config.siteId}`;
    sessionStorage.setItem(storageKey, JSON.stringify(session));
  }

  private generateId(): string {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () => 
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  private getUTMParams(): Record<string, string> {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || ''
    };
  }

  // ========== 페이지뷰 추적 ==========
  private startPageview(): void {
    if (!this.session) return;

    const pageview: PageviewData = {
      pageviewId: this.generateId(),
      path: window.location.pathname + window.location.search,
      title: document.title,
      enterTime: Date.now(),
      dwellTime: 0,
      maxScrollDepth: 0,
      scrollMilestones: [],
      mouseMovements: 0,
      clicks: [],
      isActive: true,
      hiddenTime: 0
    };

    this.session.currentPageview = pageview;
    this.saveSession(this.session);

    this.sendEvent('pageview_start', {
      pageviewId: pageview.pageviewId,
      path: pageview.path,
      title: pageview.title
    });
  }

  // ========== 이벤트 리스너 ==========
  private setupEventListeners(): void {
    // 스크롤 추적
    window.addEventListener('scroll', this.throttle(() => this.trackScroll(), 200), { passive: true });

    // 마우스 움직임 추적
    document.addEventListener('mousemove', this.throttle(() => this.trackMouseMove(), 100), { passive: true });

    // 클릭 추적
    document.addEventListener('click', (e) => this.trackClick(e), true);

    // 페이지 가시성 변화 (탭 전환)
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // 페이지 이탈
    window.addEventListener('beforeunload', () => this.handlePageExit());
    
    // SPA 라우팅 대응
    window.addEventListener('popstate', () => this.handleRouteChange());
  }

  private trackScroll(): void {
    if (!this.session?.currentPageview) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
    
    const scrollDepth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
    
    // 최대 스크롤 깊이 업데이트
    if (scrollDepth > this.session.currentPageview.maxScrollDepth) {
      this.session.currentPageview.maxScrollDepth = scrollDepth;
      
      // 마일스톤 체크 (25%, 50%, 75%, 100%)
      [25, 50, 75, 100].forEach(milestone => {
        if (scrollDepth >= milestone && 
            !this.session!.currentPageview!.scrollMilestones.includes(milestone)) {
          this.session!.currentPageview!.scrollMilestones.push(milestone);
          
          this.sendEvent('scroll_milestone', {
            milestone,
            scrollDepth
          });
          
          this.log(`Scroll milestone: ${milestone}%`);
        }
      });
    }
  }

  private trackMouseMove(): void {
    if (!this.session?.currentPageview) return;
    this.session.currentPageview.mouseMovements++;
    this.mouseCount++;
  }

  private trackClick(e: MouseEvent): void {
    if (!this.session?.currentPageview) return;

    const target = e.target as HTMLElement;
    const clickData: ClickData = {
      timestamp: Date.now(),
      x: e.clientX,
      y: e.clientY,
      target: this.getSelector(target),
      targetText: target.innerText?.substring(0, 50),
      eventType: this.classifyClick(target)
    };

    this.session.currentPageview.clicks.push(clickData);

    // 중요 클릭 이벤트는 즉시 전송
    if (clickData.eventType !== 'click') {
      this.sendEvent('click', clickData);
    }

    this.log('Click tracked', clickData);
  }

  private classifyClick(target: HTMLElement): ClickData['eventType'] {
    const href = target.closest('a')?.getAttribute('href') || '';
    const text = target.innerText?.toLowerCase() || '';
    const classes = target.className?.toLowerCase() || '';

    // 전화 클릭
    if (href.startsWith('tel:')) return 'phone_click';
    
    // CTA 버튼
    if (classes.includes('cta') || classes.includes('contact') || 
        text.includes('상담') || text.includes('문의') || text.includes('신청')) {
      return 'cta_click';
    }

    // 광고 클릭 (외부 링크)
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      return 'ad_click';
    }

    return 'click';
  }

  private getSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.className) return `${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')}`;
    return el.tagName.toLowerCase();
  }

  // ========== 페이지 가시성 & 체류시간 ==========
  private handleVisibilityChange(): void {
    if (!this.session?.currentPageview) return;

    if (document.hidden) {
      // 탭 비활성화
      this.session.currentPageview.isActive = false;
      this.hiddenStartTime = Date.now();
      this.log('Page hidden');
    } else {
      // 탭 활성화
      this.session.currentPageview.isActive = true;
      if (this.hiddenStartTime) {
        this.session.currentPageview.hiddenTime += Date.now() - this.hiddenStartTime;
        this.hiddenStartTime = null;
      }
      this.log('Page visible');
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      this.updateDwellTime();
    }, this.config.heartbeatInterval!);
  }

  private updateDwellTime(): void {
    if (!this.session?.currentPageview) return;

    // 활성 상태일 때만 체류시간 증가
    if (this.session.currentPageview.isActive) {
      const totalTime = Date.now() - this.session.currentPageview.enterTime;
      const activeTime = totalTime - this.session.currentPageview.hiddenTime;
      this.session.currentPageview.dwellTime = Math.round(activeTime / 1000);
    }

    this.session.lastActiveTime = Date.now();
    this.saveSession(this.session);

    // 주기적으로 서버에 업데이트 전송
    this.sendEvent('heartbeat', {
      dwellTime: this.session.currentPageview.dwellTime,
      maxScrollDepth: this.session.currentPageview.maxScrollDepth,
      mouseMovements: this.mouseCount,
      clickCount: this.session.currentPageview.clicks.length
    });
  }

  // ========== 페이지 이탈 ==========
  private handlePageExit(): void {
    if (!this.session?.currentPageview) return;

    // 마지막 체류시간 계산
    this.updateDwellTime();
    this.session.currentPageview.exitTime = Date.now();

    // 페이지뷰 종료 데이터
    const exitData = {
      pageviewId: this.session.currentPageview.pageviewId,
      dwellTime: this.session.currentPageview.dwellTime,
      maxScrollDepth: this.session.currentPageview.maxScrollDepth,
      scrollMilestones: this.session.currentPageview.scrollMilestones,
      mouseMovements: this.session.currentPageview.mouseMovements,
      clickCount: this.session.currentPageview.clicks.length,
      clicks: this.session.currentPageview.clicks.filter(c => c.eventType !== 'click')
    };

    // Beacon API로 확실하게 전송 (페이지 닫혀도 전송됨)
    this.sendBeacon('pageview_end', exitData);

    // 타이머 정리
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  private handleRouteChange(): void {
    // 현재 페이지뷰 종료
    this.handlePageExit();
    
    // 새 페이지뷰 시작
    setTimeout(() => this.startPageview(), 100);
  }

  // ========== 데이터 전송 ==========
  private sendEvent(eventType: string, data: any): void {
    const payload = {
      eventType,
      siteId: this.config.siteId,
      sessionId: this.session?.sessionId,
      fingerprint: this.session?.fingerprint,
      timestamp: Date.now(),
      url: window.location.href,
      ...data
    };

    // fetch로 전송
    fetch(`${this.config.endpoint}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true // 페이지 닫혀도 전송 시도
    }).catch(err => this.log('Send error', err));

    this.log(`Event: ${eventType}`, data);
  }

  private sendBeacon(eventType: string, data: any): void {
    const payload = {
      eventType,
      siteId: this.config.siteId,
      sessionId: this.session?.sessionId,
      fingerprint: this.session?.fingerprint,
      timestamp: Date.now(),
      url: window.location.href,
      ...data
    };

    // Navigator.sendBeacon - 페이지 닫혀도 확실하게 전송
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(`${this.config.endpoint}/api/track`, blob);
  }

  // ========== 수동 이벤트 ==========
  // 커스텀 이벤트 전송 (개발자가 직접 호출)
  public track(eventName: string, properties?: Record<string, any>): void {
    this.sendEvent('custom', {
      eventName,
      properties
    });
  }

  // 전환 이벤트 (상담신청 완료 등)
  public trackConversion(conversionType: string, value?: number): void {
    this.sendEvent('conversion', {
      conversionType,
      value,
      dwellTimeBeforeConversion: this.session?.currentPageview?.dwellTime
    });
  }

  // ========== 유틸 ==========
  private throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let lastCall = 0;
    return ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    }) as T;
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[ONSIA Tracker]', ...args);
    }
  }

  // ========== 디버그 & 상태 확인 ==========
  public getSession(): SessionData | null {
    return this.session;
  }

  public getCurrentStats(): any {
    if (!this.session?.currentPageview) return null;
    
    return {
      sessionId: this.session.sessionId,
      fingerprint: this.session.fingerprint.substring(0, 12) + '...',
      currentPage: {
        path: this.session.currentPageview.path,
        dwellTime: this.session.currentPageview.dwellTime + 's',
        maxScrollDepth: this.session.currentPageview.maxScrollDepth + '%',
        scrollMilestones: this.session.currentPageview.scrollMilestones,
        mouseMovements: this.session.currentPageview.mouseMovements,
        clicks: this.session.currentPageview.clicks.length,
        isActive: this.session.currentPageview.isActive
      }
    };
  }
}

// ========== 글로벌 인스턴스 ==========
declare global {
  interface Window {
    OnsiaTracker: typeof OnsiaTracker;
    onsiaTracker: OnsiaTracker | undefined;
  }
}

window.OnsiaTracker = OnsiaTracker;

export default OnsiaTracker;
export { OnsiaTracker, TrackerConfig, SessionData, PageviewData, ClickData };
