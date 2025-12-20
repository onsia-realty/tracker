// app/test/page.tsx
'use client';

import { TrackerProvider, useTrackerContext } from '@/components/tracker/TrackerProvider';

function TestLandingContent() {
  const { trackConversion, track } = useTrackerContext();

  const handleConsultation = () => {
    trackConversion('consultation_request');
    alert('상담 신청이 접수되었습니다!');
  };

  const handlePhoneClick = () => {
    track('phone_click', { phone: '010-1234-5678' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            힐스테이트 용인
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            프리미엄 주거의 새로운 기준
          </p>
          <button
            onClick={handleConsultation}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors cta"
          >
            상담 신청하기
          </button>
        </div>
      </header>

      {/* Content Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold mb-4">편리한 교통</h3>
            <p className="text-gray-600">
              지하철역 도보 5분, 고속도로 진입 3분 거리의 최고 입지
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold mb-4">프리미엄 설계</h3>
            <p className="text-gray-600">
              84㎡~114㎡ 다양한 평형, 남향 위주 설계
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold mb-4">특화 단지</h3>
            <p className="text-gray-600">
              어린이 놀이터, 피트니스, 독서실 등 커뮤니티 시설
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            지금 바로 상담받으세요
          </h2>
          <p className="text-xl mb-8">
            전문 상담사가 친절하게 안내해드립니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleConsultation}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors cta"
            >
              온라인 상담 신청
            </button>
            <a
              href="tel:010-1234-5678"
              onClick={handlePhoneClick}
              className="bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-800 transition-colors phone-button"
            >
              📞 전화 상담
            </a>
          </div>
        </div>
      </section>

      {/* Long Content for Scroll Testing */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8">단지 안내</h2>
        <div className="space-y-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-2xl font-bold mb-4">특징 {i}</h3>
              <p className="text-gray-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Debug Info */}
      <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-sm">
        <p className="font-bold mb-2">🔍 Tracker Debug</p>
        <p>Open DevTools Console to see tracking events</p>
        <p className="text-xs text-gray-300 mt-2">
          Try: Scroll, Click buttons, Stay on page
        </p>
      </div>
    </div>
  );
}

export default function TestLandingPage() {
  return (
    <TrackerProvider siteId="test-hillstate-yongin" debug={true}>
      <TestLandingContent />
    </TrackerProvider>
  );
}
