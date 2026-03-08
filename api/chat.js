// api/chat.js  — Vercel Serverless Function
// WJadlink AI 상담 에이전트 백엔드

const FALLBACK_RESPONSES = {
  price: `💰 **WJadlink 서비스 플랜 안내**\n\n⚙️ **Basic** 비즈니스 자동화 — **150,000원~**\n💻 **Standard** 고성능 랜딩페이지 — **450,000원~**\n💎 **Deluxe** 올인원팩 — **550,000원~** ★Most Popular\n🛠️ **Premium** 하이엔드 커스텀 — **800,000원~**\n\n사장님 상황에 딱 맞는 플랜, 구글 폼으로 신청해 주세요!\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`,

  automation: `⚙️ **비즈니스 자동화 솔루션**\n\n고객 문의가 들어오면 **자동으로** 안내 메일이 발송되고, 데이터가 구글 시트에 기록됩니다.\n\n✅ 구글 폼 구축\n✅ Zapier 자동 메일 발송\n✅ 실시간 DB 시트 기록\n\n**24시간 무인 응대**로 운영 효율 300% 향상!\n\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`,

  website: `💻 **고성능 랜딩페이지 제작**\n\nNext.js + Tailwind CSS 기반으로 **일반 사이트보다 3배 빠른** 로딩 속도를 구현합니다.\n\n✅ SEO 최적화로 검색 상위 노출\n✅ 모바일 완벽 대응 반응형 UI\n✅ 전환율 극대화 설계\n\n📌 레퍼런스: [깜푸디자인](https://www.kkampoo.com/)\n\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`,

  portfolio: `📂 **WJadlink 포트폴리오**\n\n🌐 [공식 포트폴리오](https://wjportfolio.vercel.app/) — 다양한 프로젝트 확인\n🎨 [깜푸디자인](https://www.kkampoo.com/) — 상업 웹 레퍼런스\n📺 [WJadlink 전광판](https://1000wonad.vercel.app/) — 자체 운영 서비스\n\n원하시는 스타일이나 업종을 말씀해 주시면 더 적합한 사례를 안내해 드릴게요!`,

  contact: `📞 **1:1 상담 안내**\n\n**대표 염우진**이 직접 상담해 드립니다.\n\n📱 전화: **010-6376-7604**\n📧 이메일: woojin052501@gmail.com\n\n또는 아래 구글 폼을 작성해 주시면 **24시간 이내** 연락드립니다:\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`,

  default: `안녕하세요! 👋 **WJadlink(우진애드링크)** AI 상담 에이전트입니다.\n\n사장님의 비즈니스에 딱 맞는 **웹 빌드 & 자동화 솔루션**을 찾아드립니다.\n\n궁금한 점을 편하게 말씀해 주세요:\n- 💬 서비스 가격이 궁금해요\n- 💬 홈페이지 제작이 필요해요\n- 💬 업무 자동화를 원해요\n- 💬 포트폴리오를 보고 싶어요`
};

function getFallbackResponse(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('가격') || m.includes('비용') || m.includes('얼마') || m.includes('플랜') || m.includes('요금')) {
    return FALLBACK_RESPONSES.price;
  }
  if (m.includes('자동화') || m.includes('zapier') || m.includes('폼') || m.includes('메일')) {
    return FALLBACK_RESPONSES.automation;
  }
  if (m.includes('랜딩') || m.includes('홈페이지') || m.includes('웹사이트') || m.includes('사이트') || m.includes('제작')) {
    return FALLBACK_RESPONSES.website;
  }
  if (m.includes('포트폴리오') || m.includes('작업물') || m.includes('레퍼런스') || m.includes('예시')) {
    return FALLBACK_RESPONSES.portfolio;
  }
  if (m.includes('연락') || m.includes('상담') || m.includes('전화') || m.includes('문의')) {
    return FALLBACK_RESPONSES.contact;
  }
  return FALLBACK_RESPONSES.default;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const lastMsg = messages[messages.length - 1]?.content || '';
    const reply = getFallbackResponse(lastMsg);
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat API Error:', err);
    return res.status(500).json({
      reply: '일시적인 오류가 발생했습니다. 직접 문의해 주세요! 010-6376-7604'
    });
  }
}
