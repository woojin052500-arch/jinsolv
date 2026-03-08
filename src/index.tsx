import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// ──────────────────────────────────────────────
// AI 상담 에이전트 API
// ──────────────────────────────────────────────
const SYSTEM_PROMPT = `
당신은 고성능 웹 빌드 및 비즈니스 자동화 전문 기업 'WJadlink(우진애드링크)'의 공식 AI 상담 에이전트입니다.

[페르소나]
- 신뢰감 있는(Professional), 혁신적인(Innovative), 결과 중심적인(Result-oriented) 태도를 유지하세요.
- 단순 안내자가 아닌 '전략적 파트너'로서 고객의 비즈니스를 분석하고 솔루션을 제시하세요.
- 친근하되 전문적인 어조를 사용하세요. 사장님이라는 호칭을 적절히 활용하세요.

[핵심 서비스 플랜]
1. ⚙️ [Basic] 비즈니스 자동화 (150,000 KRW~)
   - 대상: 고객 응대·데이터 관리에 시간을 뺏기는 1인 사업자
   - 기능: 전용 구글 폼 + Zapier 자동 안내 메일 + DB 실시간 시트 기록
   - 강점: 24시간 무인 응대 시스템으로 운영 효율 300% 향상

2. 💻 [Standard] 고성능 랜딩페이지 (450,000 KRW~)
   - 대상: 브랜드 신뢰도가 필요한 전문직·소상공인·스타트업
   - 기능: Next.js & Tailwind CSS 초고속 웹 빌드 + SEO + 반응형 UI
   - 강점: 일반 사이트보다 3배 빠른 로딩 속도로 이탈률 최소화

3. 💎 [Deluxe] 비즈니스 올인원팩 (550,000 KRW~) ★Most Popular★
   - 대상: 웹사이트 제작과 자동 고객 관리를 한 번에 해결하고 싶은 사장님
   - 기능: Standard 웹빌드 + Basic 자동화 시스템 완벽 통합
   - 강점: 마케팅부터 고객 데이터 수집까지 '자동 수익 파이프라인' 완성

4. 🛠️ [Premium] 하이엔드 커스텀 (800,000 KRW~)
   - 대상: 복잡한 로직·API 연동·관리자 페이지가 필요한 기업
   - 기능: 외부 데이터 연동 + 전용 어드민 대시보드 + 브랜딩 전략 컨설팅

[포트폴리오 & 레퍼런스]
- 공식 포트폴리오: https://wjportfolio.vercel.app/
- 상업 웹 레퍼런스(깜푸디자인): https://www.kkampoo.com/
- 자체 운영 서비스(WJadlink 전광판): https://1000wonad.vercel.app/

[전환 전략 - 상담의 최종 목표]
대화의 마무리는 항상 '상세 진단 신청'으로 유도하세요.
고객이 고민하는 기색이면 반드시 아래 문구와 링크를 제공하세요:
"사장님의 비즈니스에 가장 적합한 시스템을 1:1로 진단해 드립니다. 아래 폼을 작성해 주시면 대표가 직접 검토 후 24시간 이내에 연락드립니다."
🔗 상세 문의 폼: https://forms.gle/6NHjfdNv8xNHuzCG7

[연락처]
- 대표: 염우진 (WJadlink)
- 전화: 010-6376-7604
- 이메일: woojin052501@gmail.com

[응답 규칙]
1. 항상 한국어로 응답하세요.
2. 답변은 간결하고 핵심 중심으로 작성하세요 (너무 길지 않게).
3. 고객의 업종/상황을 파악한 후 가장 적합한 플랜을 추천하세요.
4. 마크다운 형식(볼드, 이모지 등)을 적극 활용해 가독성을 높이세요.
5. 3번 이상 대화가 오가면 상세 진단 신청을 자연스럽게 유도하세요.
`.trim()

app.post('/api/chat', async (c) => {
  try {
    const { messages } = await c.req.json()

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'Invalid request' }, 400)
    }

    // Cloudflare AI Workers AI (llama 모델) 사용
    // 환경변수로 AI 바인딩 사용
    const env = c.env as any

    // AI 바인딩이 없을 경우 fallback 응답
    if (!env?.AI) {
      const fallbackResponses = getFallbackResponse(messages[messages.length - 1]?.content || '')
      return c.json({ reply: fallbackResponses })
    }

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-10) // 최근 10개 메시지만 전송
      ],
      max_tokens: 512,
      temperature: 0.7
    })

    return c.json({ reply: response.response || '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.' })
  } catch (err) {
    console.error('Chat API Error:', err)
    // fallback
    const body = await c.req.text().catch(() => '')
    let lastMsg = ''
    try { lastMsg = JSON.parse(body)?.messages?.at(-1)?.content || '' } catch {}
    return c.json({ reply: getFallbackResponse(lastMsg) })
  }
})

// ──────────────────────────────────────────────
// Fallback 응답 (AI 바인딩 없을 때)
// ──────────────────────────────────────────────
function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase()

  if (msg.includes('가격') || msg.includes('비용') || msg.includes('얼마')) {
    return `💰 **WJadlink 서비스 플랜 안내**\n\n⚙️ **Basic** 비즈니스 자동화 — **150,000원~**\n💻 **Standard** 고성능 랜딩페이지 — **450,000원~**\n💎 **Deluxe** 올인원팩 — **550,000원~** ⭐Most Popular\n🛠️ **Premium** 하이엔드 커스텀 — **800,000원~**\n\n사장님의 상황에 맞는 플랜을 구글 폼으로 신청해 주세요!\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`
  }

  if (msg.includes('자동화') || msg.includes('zapier') || msg.includes('폼')) {
    return `⚙️ **비즈니스 자동화 솔루션**\n\n고객 문의가 들어오면 **자동으로** 안내 메일이 발송되고, 데이터가 구글 시트에 기록됩니다.\n\n✅ 구글 폼 구축\n✅ Zapier 자동 메일 발송\n✅ 실시간 DB 시트 기록\n\n**24시간 무인 응대**로 운영 효율 300% 향상! 🚀\n\n👉 구글 폼으로 신청: [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`
  }

  if (msg.includes('랜딩') || msg.includes('홈페이지') || msg.includes('웹사이트') || msg.includes('사이트')) {
    return `💻 **고성능 랜딩페이지 제작**\n\nNext.js + Tailwind CSS 기반으로 **일반 사이트보다 3배 빠른** 로딩 속도를 구현합니다.\n\n✅ SEO 최적화로 검색 상위 노출\n✅ 모바일 완벽 대응 반응형 UI\n✅ 전환율 극대화 설계\n\n📌 레퍼런스: [깜푸디자인](https://www.kkampoo.com/)\n\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`
  }

  if (msg.includes('포트폴리오') || msg.includes('작업물') || msg.includes('레퍼런스')) {
    return `📂 **WJadlink 포트폴리오**\n\n🌐 [공식 포트폴리오](https://wjportfolio.vercel.app/) — 다양한 프로젝트 확인\n🎨 [깜푸디자인](https://www.kkampoo.com/) — 상업 웹 레퍼런스\n📺 [WJadlink 전광판](https://1000wonad.vercel.app/) — 자체 운영 서비스\n\n원하시는 스타일이나 업종을 말씀해 주시면 더 적합한 사례를 안내해 드릴게요!`
  }

  if (msg.includes('연락') || msg.includes('상담') || msg.includes('전화') || msg.includes('문의')) {
    return `📞 **1:1 무료 상담 안내**\n\n**대표 염우진**이 직접 상담해 드립니다.\n\n📱 전화: **010-6376-7604**\n📧 이메일: woojin052501@gmail.com\n\n아래 구글 폼을 작성해 주시면 **24시간 이내** 연락드립니다:\n👉 [구글 폼 신청](https://forms.gle/6NHjfdNv8xNHuzCG7)`
  }

  // 기본 인삿말
  return `안녕하세요! 👋 **WJadlink(우진애드링크)** AI 상담 에이전트입니다.\n\n저는 사장님의 비즈니스에 딱 맞는 **웹 빌드 & 자동화 솔루션**을 찾아드립니다.\n\n궁금하신 점을 편하게 말씀해 주세요:\n- 💬 서비스 가격이 궁금해요\n- 💬 홈페이지 제작이 필요해요\n- 💬 업무 자동화를 원해요\n- 💬 포트폴리오를 보고 싶어요`
}

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
app.get('/', (c) => {
  return c.html(getMainPage())
})

// catch-all
app.get('*', (c) => {
  return c.html(getMainPage())
})

// ──────────────────────────────────────────────
// 메인 HTML
// ──────────────────────────────────────────────
function getMainPage(): string {
  return /* html */`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WJadlink | 고성능 웹 빌드 & 비즈니스 자동화</title>
  <meta name="description" content="WJadlink(우진애드링크) - Next.js 기반 초고속 웹 빌드, Zapier 비즈니스 자동화, AI 상담 에이전트. 매출을 일으키는 전략적 파트너.">
  <meta name="keywords" content="웹제작, 랜딩페이지, 비즈니스자동화, Zapier, Next.js, SEO, 소상공인">

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"/>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">

  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Noto Sans KR', 'sans-serif'] },
          colors: {
            brand: {
              DEFAULT: '#6366f1',
              dark:    '#4f46e5',
              light:   '#818cf8'
            },
            accent: '#10b981',
            dark: {
              900: '#0a0a0f',
              800: '#12121a',
              700: '#1a1a27',
              600: '#22223a',
              500: '#2e2e50'
            }
          },
          animation: {
            'float': 'float 6s ease-in-out infinite',
            'glow':  'glow 2s ease-in-out infinite alternate',
            'slide-up': 'slideUp 0.6s ease-out forwards',
            'fade-in': 'fadeIn 0.8s ease-out forwards',
            'pulse-slow': 'pulse 3s ease-in-out infinite',
          },
          keyframes: {
            float:   { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
            glow:    { from: { boxShadow: '0 0 20px rgba(99,102,241,0.3)' }, to: { boxShadow: '0 0 40px rgba(99,102,241,0.7), 0 0 80px rgba(99,102,241,0.3)' } },
            slideUp: { from: { opacity: '0', transform: 'translateY(30px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
            fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
          }
        }
      }
    }
  </script>

  <style>
    body { font-family: 'Noto Sans KR', sans-serif; background: #0a0a0f; color: #e2e8f0; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #12121a; }
    ::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 3px; }

    .gradient-text {
      background: linear-gradient(135deg, #6366f1, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .gradient-border {
      border: 1px solid transparent;
      background: linear-gradient(#12121a, #12121a) padding-box,
                  linear-gradient(135deg, #6366f1, #10b981) border-box;
    }
    .card-glass {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .hero-bg {
      background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%),
                  radial-gradient(ellipse 60% 40% at 80% 80%, rgba(16,185,129,0.10) 0%, transparent 60%),
                  #0a0a0f;
    }
    .plan-popular {
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.10));
      border: 1px solid rgba(99,102,241,0.4);
      box-shadow: 0 0 30px rgba(99,102,241,0.15);
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      transition: all 0.3s ease;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #818cf8, #6366f1);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(99,102,241,0.4);
    }
    .chat-bubble-bot {
      background: rgba(99,102,241,0.12);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 0 16px 16px 16px;
    }
    .chat-bubble-user {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 16px 0 16px 16px;
    }
    .typing-dot {
      width: 8px; height: 8px;
      background: #6366f1;
      border-radius: 50%;
      animation: typingBounce 1.2s infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-8px); opacity: 1; }
    }
    #chatMessages { scroll-behavior: smooth; }
    .nav-blur { backdrop-filter: blur(20px); background: rgba(10,10,15,0.8); }

    /* Particle BG */
    .particle { position: absolute; border-radius: 50%; pointer-events: none; }

    /* Section reveal animation */
    .reveal { opacity: 0; transform: translateY(40px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
  </style>
</head>

<body class="hero-bg min-h-screen">

<!-- ═══════════════════ NAV ═══════════════════ -->
<nav class="fixed top-0 w-full z-50 nav-blur border-b border-white/5">
  <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
    <a href="#" class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
        <i class="fas fa-bolt text-white text-sm"></i>
      </div>
      <span class="font-bold text-lg text-white">WJadlink</span>
      <span class="text-xs text-white/40 font-light hidden sm:block">우진애드링크</span>
    </a>
    <div class="hidden md:flex items-center gap-8 text-sm text-white/60">
      <a href="#services" class="hover:text-white transition-colors">서비스</a>
      <a href="#portfolio" class="hover:text-white transition-colors">포트폴리오</a>
      <a href="#process" class="hover:text-white transition-colors">진행 방식</a>
      <a href="#contact" class="hover:text-white transition-colors">상담</a>
    </div>
    <a href="https://forms.gle/6NHjfdNv8xNHuzCG7" target="_blank"
       class="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
      구글 폼 신청
    </a>
  </div>
</nav>

<!-- ═══════════════════ HERO ═══════════════════ -->
<section class="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden" id="home">
  <!-- 파티클 배경 -->
  <div id="particles" class="absolute inset-0 overflow-hidden pointer-events-none"></div>

  <div class="relative z-10 text-center max-w-5xl mx-auto px-4">
    <!-- 뱃지 -->
    <div class="inline-flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-full px-4 py-1.5 mb-8 text-sm text-brand-light animate-fade-in">
      <span class="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
      AI 기반 비즈니스 자동화 전문 기업
    </div>

    <h1 class="text-5xl md:text-7xl font-black text-white mb-6 leading-tight animate-slide-up">
      매출을 일으키는<br>
      <span class="gradient-text">전략적 파트너</span>
    </h1>

    <p class="text-xl md:text-2xl text-white/60 mb-10 max-w-3xl mx-auto leading-relaxed animate-slide-up" style="animation-delay:0.1s">
      Next.js 초고속 웹 빌드 + Zapier 비즈니스 자동화.<br>
      <strong class="text-white/80">24시간 자동 수익 파이프라인</strong>을 구축해 드립니다.
    </p>

    <div class="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style="animation-delay:0.2s">
      <a href="https://forms.gle/6NHjfdNv8xNHuzCG7" target="_blank"
         class="btn-primary text-white font-bold px-10 py-4 rounded-2xl text-lg flex items-center justify-center gap-2">
        <i class="fas fa-rocket"></i>
        구글 폼 신청하기
      </a>
      <a href="#services"
         class="card-glass text-white/80 hover:text-white font-semibold px-10 py-4 rounded-2xl text-lg flex items-center justify-center gap-2 transition-all hover:border-brand/40">
        <i class="fas fa-play-circle"></i>
        서비스 살펴보기
      </a>
    </div>

    <!-- 통계 -->
    <div class="grid grid-cols-3 gap-6 mt-20 max-w-xl mx-auto animate-fade-in" style="animation-delay:0.4s">
      <div class="text-center">
        <div class="text-3xl font-black gradient-text">3x</div>
        <div class="text-sm text-white/40 mt-1">빠른 로딩 속도</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-black gradient-text">24h</div>
        <div class="text-sm text-white/40 mt-1">무인 자동 응대</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-black gradient-text">300%</div>
        <div class="text-sm text-white/40 mt-1">운영 효율 향상</div>
      </div>
    </div>
  </div>

  <!-- 스크롤 인디케이터 -->
  <div class="absolute bottom-10 left-1/2 -translate-x-1/2 animate-float opacity-40">
    <i class="fas fa-chevron-down text-white text-xl"></i>
  </div>
</section>

<!-- ═══════════════════ SERVICES ═══════════════════ -->
<section class="py-28 px-4 reveal" id="services">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <span class="text-brand text-sm font-semibold tracking-widest uppercase">Services</span>
      <h2 class="text-4xl md:text-5xl font-black text-white mt-3">
        사장님에게 딱 맞는<br><span class="gradient-text">솔루션을 선택하세요</span>
      </h2>
      <p class="text-white/50 mt-4 text-lg">모든 플랜은 무제한 수정을 포함합니다</p>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">

      <!-- Basic -->
      <div class="card-glass rounded-2xl p-6 hover:border-brand/30 transition-all hover:-translate-y-1 group">
        <div class="text-3xl mb-4">⚙️</div>
        <div class="text-xs font-bold text-white/30 tracking-widest uppercase mb-2">Basic</div>
        <h3 class="text-xl font-bold text-white mb-2">비즈니스 자동화</h3>
        <div class="text-brand-light font-black text-2xl mb-4">150,000원<span class="text-sm font-normal text-white/40">~</span></div>
        <ul class="space-y-2 text-sm text-white/60 mb-6">
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>전용 구글 폼 구축</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>Zapier 자동 안내 메일</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>실시간 DB 시트 기록</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>24시간 무인 응대</li>
        </ul>
        <div class="text-xs text-white/30 bg-white/5 rounded-lg px-3 py-2">운영 효율 300% 향상</div>
      </div>

      <!-- Standard -->
      <div class="card-glass rounded-2xl p-6 hover:border-brand/30 transition-all hover:-translate-y-1 group">
        <div class="text-3xl mb-4">💻</div>
        <div class="text-xs font-bold text-white/30 tracking-widest uppercase mb-2">Standard</div>
        <h3 class="text-xl font-bold text-white mb-2">고성능 랜딩페이지</h3>
        <div class="text-brand-light font-black text-2xl mb-4">450,000원<span class="text-sm font-normal text-white/40">~</span></div>
        <ul class="space-y-2 text-sm text-white/60 mb-6">
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>Next.js 초고속 빌드</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>SEO 검색 최적화</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>반응형 UI 디자인</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>Tailwind CSS 스타일링</li>
        </ul>
        <div class="text-xs text-white/30 bg-white/5 rounded-lg px-3 py-2">일반 대비 3배 빠른 로딩</div>
      </div>

      <!-- Deluxe (Most Popular) -->
      <div class="plan-popular rounded-2xl p-6 relative hover:-translate-y-2 transition-all animate-glow">
        <div class="absolute -top-3 left-1/2 -translate-x-1/2">
          <span class="bg-gradient-to-r from-brand to-accent text-white text-xs font-bold px-4 py-1 rounded-full">⭐ Most Popular</span>
        </div>
        <div class="text-3xl mb-4 mt-2">💎</div>
        <div class="text-xs font-bold text-brand-light tracking-widest uppercase mb-2">Deluxe</div>
        <h3 class="text-xl font-bold text-white mb-2">비즈니스 올인원팩</h3>
        <div class="text-brand-light font-black text-2xl mb-4">550,000원<span class="text-sm font-normal text-white/40">~</span></div>
        <ul class="space-y-2 text-sm text-white/70 mb-6">
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>Standard 웹빌드 포함</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>Basic 자동화 포함</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>고객 데이터 자동 수집</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>자동 수익 파이프라인</li>
        </ul>
        <div class="text-xs text-brand-light/70 bg-brand/10 rounded-lg px-3 py-2">마케팅 → 수집 완전 자동화</div>
      </div>

      <!-- Premium -->
      <div class="card-glass rounded-2xl p-6 hover:border-brand/30 transition-all hover:-translate-y-1 group">
        <div class="text-3xl mb-4">🛠️</div>
        <div class="text-xs font-bold text-white/30 tracking-widest uppercase mb-2">Premium</div>
        <h3 class="text-xl font-bold text-white mb-2">하이엔드 커스텀</h3>
        <div class="text-brand-light font-black text-2xl mb-4">800,000원<span class="text-sm font-normal text-white/40">~</span></div>
        <ul class="space-y-2 text-sm text-white/60 mb-6">
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>외부 API 연동</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>전용 어드민 대시보드</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>브랜딩 전략 컨설팅</li>
          <li class="flex items-start gap-2"><i class="fas fa-check text-accent mt-0.5 text-xs"></i>복잡한 로직 구현</li>
        </ul>
        <div class="text-xs text-white/30 bg-white/5 rounded-lg px-3 py-2">기업급 풀스택 솔루션</div>
      </div>

    </div>

    <div class="text-center mt-10">
      <a href="https://forms.gle/6NHjfdNv8xNHuzCG7" target="_blank"
         class="btn-primary text-white font-bold px-10 py-4 rounded-2xl text-lg inline-flex items-center gap-2">
        <i class="fas fa-clipboard-list"></i>
        구글 폼으로 플랜 신청하기
      </a>
    </div>
  </div>
</section>

<!-- ═══════════════════ PORTFOLIO ═══════════════════ -->
<section class="py-28 px-4 reveal" id="portfolio">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <span class="text-accent text-sm font-semibold tracking-widest uppercase">Portfolio</span>
      <h2 class="text-4xl md:text-5xl font-black text-white mt-3">
        검증된 <span class="gradient-text">레퍼런스</span>
      </h2>
      <p class="text-white/50 mt-4">실제 운영 중인 프로젝트를 직접 확인하세요</p>
    </div>

    <div class="grid md:grid-cols-3 gap-6">

      <!-- 포트폴리오 1 -->
      <a href="https://wjportfolio.vercel.app/" target="_blank"
         class="card-glass rounded-2xl overflow-hidden group hover:border-brand/30 transition-all hover:-translate-y-1">
        <div class="h-48 bg-gradient-to-br from-brand/20 to-dark-700 flex items-center justify-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-accent/10"></div>
          <div class="text-center relative z-10">
            <i class="fas fa-briefcase text-5xl text-brand-light mb-3"></i>
            <div class="text-white font-semibold">공식 포트폴리오</div>
          </div>
          <div class="absolute top-3 right-3 bg-brand/20 text-brand-light text-xs px-2 py-1 rounded-full">Live ●</div>
        </div>
        <div class="p-5">
          <h3 class="text-white font-bold text-lg mb-1">WJadlink Portfolio</h3>
          <p class="text-white/50 text-sm mb-3">Next.js 기반 고성능 포트폴리오 사이트. 다양한 프로젝트 레퍼런스 수록.</p>
          <span class="text-brand-light text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
            방문하기 <i class="fas fa-arrow-right text-xs"></i>
          </span>
        </div>
      </a>

      <!-- 포트폴리오 2 -->
      <a href="https://www.kkampoo.com/" target="_blank"
         class="card-glass rounded-2xl overflow-hidden group hover:border-accent/30 transition-all hover:-translate-y-1">
        <div class="h-48 bg-gradient-to-br from-accent/20 to-dark-700 flex items-center justify-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-brand/10"></div>
          <div class="text-center relative z-10">
            <i class="fas fa-palette text-5xl text-accent mb-3"></i>
            <div class="text-white font-semibold">상업 웹 레퍼런스</div>
          </div>
          <div class="absolute top-3 right-3 bg-accent/20 text-accent text-xs px-2 py-1 rounded-full">Live ●</div>
        </div>
        <div class="p-5">
          <h3 class="text-white font-bold text-lg mb-1">깜푸디자인</h3>
          <p class="text-white/50 text-sm mb-3">실제 운영 중인 상업용 웹사이트. SEO + 반응형 UI 적용 완료.</p>
          <span class="text-accent text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
            방문하기 <i class="fas fa-arrow-right text-xs"></i>
          </span>
        </div>
      </a>

      <!-- 포트폴리오 3 -->
      <a href="https://1000wonad.vercel.app/" target="_blank"
         class="card-glass rounded-2xl overflow-hidden group hover:border-brand/30 transition-all hover:-translate-y-1">
        <div class="h-48 bg-gradient-to-br from-purple-500/20 to-dark-700 flex items-center justify-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-brand/10"></div>
          <div class="text-center relative z-10">
            <i class="fas fa-tv text-5xl text-purple-400 mb-3"></i>
            <div class="text-white font-semibold">자체 운영 서비스</div>
          </div>
          <div class="absolute top-3 right-3 bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded-full">Live ●</div>
        </div>
        <div class="p-5">
          <h3 class="text-white font-bold text-lg mb-1">WJadlink 전광판</h3>
          <p class="text-white/50 text-sm mb-3">자체 개발·운영 중인 온라인 전광판 서비스. 자동화 파이프라인 탑재.</p>
          <span class="text-purple-400 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
            방문하기 <i class="fas fa-arrow-right text-xs"></i>
          </span>
        </div>
      </a>

    </div>
  </div>
</section>

<!-- ═══════════════════ PROCESS ═══════════════════ -->
<section class="py-28 px-4 reveal" id="process">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-16">
      <span class="text-brand text-sm font-semibold tracking-widest uppercase">Process</span>
      <h2 class="text-4xl md:text-5xl font-black text-white mt-3">
        신청부터 완성까지<br><span class="gradient-text">4단계</span>
      </h2>
    </div>

    <div class="space-y-4">
      <div class="flex gap-5 card-glass rounded-2xl p-6 items-start group hover:border-brand/30 transition-all">
        <div class="w-12 h-12 min-w-[3rem] bg-brand/20 rounded-xl flex items-center justify-center text-brand-light font-black text-lg">01</div>
        <div>
          <h3 class="text-white font-bold text-lg mb-1">구글 폼 신청</h3>
          <p class="text-white/50 text-sm">폼 작성 → 대표 직접 검토 → 24시간 이내 연락. 비즈니스 현황과 목표를 파악합니다.</p>
        </div>
      </div>
      <div class="flex gap-5 card-glass rounded-2xl p-6 items-start group hover:border-brand/30 transition-all">
        <div class="w-12 h-12 min-w-[3rem] bg-accent/20 rounded-xl flex items-center justify-center text-accent font-black text-lg">02</div>
        <div>
          <h3 class="text-white font-bold text-lg mb-1">전략 기획 & 견적 확정</h3>
          <p class="text-white/50 text-sm">맞춤 기획안과 상세 견적서 제출. 범위 확정 후 계약 진행.</p>
        </div>
      </div>
      <div class="flex gap-5 card-glass rounded-2xl p-6 items-start group hover:border-brand/30 transition-all">
        <div class="w-12 h-12 min-w-[3rem] bg-brand/20 rounded-xl flex items-center justify-center text-brand-light font-black text-lg">03</div>
        <div>
          <h3 class="text-white font-bold text-lg mb-1">개발 & 실시간 피드백</h3>
          <p class="text-white/50 text-sm">개발 중 중간 결과물 공유. 무제한 수정으로 100% 만족 보장.</p>
        </div>
      </div>
      <div class="flex gap-5 card-glass rounded-2xl p-6 items-start group hover:border-brand/30 transition-all">
        <div class="w-12 h-12 min-w-[3rem] bg-accent/20 rounded-xl flex items-center justify-center text-accent font-black text-lg">04</div>
        <div>
          <h3 class="text-white font-bold text-lg mb-1">배포 & 운영 지원</h3>
          <p class="text-white/50 text-sm">라이브 배포 완료 후 사용법 가이드 제공. 런칭 후 1개월 무료 지원.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════ CTA ═══════════════════ -->
<section class="py-28 px-4 reveal" id="contact">
  <div class="max-w-4xl mx-auto">
    <div class="gradient-border rounded-3xl p-12 text-center" style="background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.05)); backdrop-filter: blur(20px);">
      <div class="text-5xl mb-6">🚀</div>
      <h2 class="text-4xl md:text-5xl font-black text-white mb-4">
        지금 바로 시작하세요
      </h2>
      <p class="text-white/60 text-lg mb-8 max-w-2xl mx-auto">
        사장님의 비즈니스에 가장 적합한 시스템을 <strong class="text-white">1:1로 안내</strong>해 드립니다.<br>
        아래 구글 폼을 작성해 주시면 대표가 직접 검토 후 <strong class="text-brand-light">24시간 이내</strong>에 연락드립니다.
      </p>
      <a href="https://forms.gle/6NHjfdNv8xNHuzCG7" target="_blank"
         class="btn-primary text-white font-bold px-12 py-5 rounded-2xl text-xl inline-flex items-center gap-3">
        <i class="fas fa-clipboard-check"></i>
        WJadlink 프로젝트 상세 문의
        <i class="fas fa-arrow-right"></i>
      </a>

      <div class="flex flex-col sm:flex-row gap-6 justify-center mt-10 text-white/50 text-sm">
        <a href="tel:010-6376-7604" class="flex items-center gap-2 hover:text-white transition-colors">
          <i class="fas fa-phone text-brand-light"></i>
          010-6376-7604
        </a>
        <a href="mailto:woojin052501@gmail.com" class="flex items-center gap-2 hover:text-white transition-colors">
          <i class="fas fa-envelope text-accent"></i>
          woojin052501@gmail.com
        </a>
        <span class="flex items-center gap-2">
          <i class="fas fa-user text-purple-400"></i>
          대표 염우진
        </span>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════ FOOTER ═══════════════════ -->
<footer class="border-t border-white/5 py-8 px-4 text-center text-white/30 text-sm">
  <div class="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
    <div class="flex items-center gap-2">
      <i class="fas fa-bolt text-brand"></i>
      <span class="text-white/50 font-semibold">WJadlink</span>
      <span>— 우진애드링크</span>
    </div>
    <div>© 2025 WJadlink. All rights reserved. 대표 염우진</div>
    <div class="flex gap-4">
      <a href="https://wjportfolio.vercel.app/" target="_blank" class="hover:text-white transition-colors">포트폴리오</a>
      <a href="https://forms.gle/6NHjfdNv8xNHuzCG7" target="_blank" class="hover:text-white transition-colors">문의</a>
    </div>
  </div>
</footer>

<!-- ═══════════════════ CHAT WIDGET ═══════════════════ -->
<!-- 채팅 버튼 -->
<button id="chatToggle"
  class="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full btn-primary text-white shadow-2xl flex items-center justify-center text-2xl transition-all hover:scale-110 animate-glow"
  aria-label="AI 상담">
  <i class="fas fa-robot" id="chatIcon"></i>
</button>

<!-- 채팅창 -->
<div id="chatWindow"
  class="fixed bottom-28 right-6 z-50 w-[370px] max-w-[calc(100vw-2rem)] h-[520px] flex flex-col card-glass rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 opacity-0 scale-95 pointer-events-none"
  style="border: 1px solid rgba(99,102,241,0.3); box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.1);">

  <!-- 헤더 -->
  <div class="flex items-center gap-3 px-5 py-4 border-b border-white/5"
       style="background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.1));">
    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center">
      <i class="fas fa-robot text-white text-sm"></i>
    </div>
    <div class="flex-1">
      <div class="text-white font-bold text-sm">WJadlink AI 상담</div>
      <div class="text-accent text-xs flex items-center gap-1">
        <span class="w-1.5 h-1.5 bg-accent rounded-full inline-block animate-pulse"></span>
        온라인 · 즉시 응답
      </div>
    </div>
    <button id="chatClose" class="text-white/40 hover:text-white transition-colors text-lg">
      <i class="fas fa-times"></i>
    </button>
  </div>

  <!-- 메시지 영역 -->
  <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-4">
    <!-- 웰컴 메시지 -->
    <div class="flex gap-3">
      <div class="w-8 h-8 min-w-[2rem] rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center">
        <i class="fas fa-robot text-white text-xs"></i>
      </div>
      <div class="chat-bubble-bot p-3 max-w-[85%]">
        <p class="text-white/90 text-sm leading-relaxed">안녕하세요! 👋 <strong>WJadlink AI 상담 에이전트</strong>입니다.<br><br>사장님의 비즈니스에 딱 맞는 솔루션을 찾아드릴게요. 편하게 질문해 주세요!</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button class="quick-btn bg-brand/20 text-brand-light text-xs px-2.5 py-1 rounded-full hover:bg-brand/30 transition-colors border border-brand/20">💰 가격 문의</button>
          <button class="quick-btn bg-brand/20 text-brand-light text-xs px-2.5 py-1 rounded-full hover:bg-brand/30 transition-colors border border-brand/20">🌐 홈페이지 제작</button>
          <button class="quick-btn bg-brand/20 text-brand-light text-xs px-2.5 py-1 rounded-full hover:bg-brand/30 transition-colors border border-brand/20">⚙️ 자동화 문의</button>
          <button class="quick-btn bg-brand/20 text-brand-light text-xs px-2.5 py-1 rounded-full hover:bg-brand/30 transition-colors border border-brand/20">📂 포트폴리오</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 입력창 -->
  <div class="p-4 border-t border-white/5">
    <div class="flex gap-2 items-end">
      <textarea id="chatInput"
        class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand/50 transition-colors"
        placeholder="궁금한 것을 입력하세요..."
        rows="1"
        style="max-height: 100px;"></textarea>
      <button id="chatSend"
        class="btn-primary w-10 h-10 min-w-[2.5rem] rounded-xl flex items-center justify-center text-white hover:scale-105 transition-transform">
        <i class="fas fa-paper-plane text-sm"></i>
      </button>
    </div>
    <p class="text-white/20 text-xs mt-2 text-center">AI 응답 · 복잡한 상담은 <a href="https://forms.gle/6NHjfdNv8xNHuzCG7" target="_blank" class="text-brand-light hover:underline">직접 문의</a> 권장</p>
  </div>
</div>

<!-- ═══════════════════ JavaScript ═══════════════════ -->
<script>
// ─── 마크다운 파서 (정규식 없이 수동 파싱) ───
function parseMarkdown(text) {
  // 1) Bold: **text** → <strong>text</strong>
  let boldResult = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '*' && text[i+1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) {
        boldResult += '<strong class="text-white">' + text.slice(i + 2, end) + '</strong>'
        i = end + 2
        continue
      }
    }
    boldResult += text[i]
    i++
  }
  // 2) Links: [label](url) → <a href="url">label</a>
  let linkResult = ''
  let j = 0
  while (j < boldResult.length) {
    if (boldResult[j] === '[') {
      const closeBracket = boldResult.indexOf(']', j)
      if (closeBracket !== -1 && boldResult[closeBracket + 1] === '(') {
        const closeParen = boldResult.indexOf(')', closeBracket + 2)
        if (closeParen !== -1) {
          const lbl = boldResult.slice(j + 1, closeBracket)
          const url = boldResult.slice(closeBracket + 2, closeParen)
          if (url.indexOf('http') === 0) {
            linkResult += '<a href="' + url + '" target="_blank" class="text-brand-light underline hover:text-white">' + lbl + '</a>'
            j = closeParen + 1
            continue
          }
        }
      }
    }
    linkResult += boldResult[j]
    j++
  }
  // 3) Newlines (charCode 10 = LF)
  let out = ''
  for (let k = 0; k < linkResult.length; k++) {
    out += linkResult.charCodeAt(k) === 10 ? '<br>' : linkResult[k]
  }
  return out
}

// ─── 파티클 생성 ───
(function createParticles() {
  const container = document.getElementById('particles')
  if (!container) return
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div')
    const size = Math.random() * 3 + 1
    p.className = 'particle'
    p.style.cssText = [
      'width:' + size + 'px',
      'height:' + size + 'px',
      'left:' + (Math.random() * 100) + '%',
      'top:' + (Math.random() * 100) + '%',
      'background:rgba(' + (Math.random() > 0.5 ? '99,102,241' : '16,185,129') + ',' + (Math.random() * 0.4 + 0.1) + ')',
      'animation:pulse ' + (Math.random() * 3 + 2) + 's ease-in-out infinite',
      'animation-delay:' + (Math.random() * 3) + 's'
    ].join(';')
    container.appendChild(p)
  }
})()

// ─── Scroll Reveal ───
const reveals = document.querySelectorAll('.reveal')
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
}, { threshold: 0.1 })
reveals.forEach(el => observer.observe(el))

// ─── 챗봇 ───
const chatToggle  = document.getElementById('chatToggle')
const chatWindow  = document.getElementById('chatWindow')
const chatClose   = document.getElementById('chatClose')
const chatInput   = document.getElementById('chatInput')
const chatSend    = document.getElementById('chatSend')
const chatMessages= document.getElementById('chatMessages')
const chatIcon    = document.getElementById('chatIcon')
let isOpen = false
const conversationHistory = []

function openChat() {
  isOpen = true
  chatWindow.classList.remove('opacity-0', 'scale-95', 'pointer-events-none')
  chatWindow.classList.add('opacity-100', 'scale-100')
  chatIcon.className = 'fas fa-times'
  chatInput.focus()
}
function closeChat() {
  isOpen = false
  chatWindow.classList.add('opacity-0', 'scale-95', 'pointer-events-none')
  chatWindow.classList.remove('opacity-100', 'scale-100')
  chatIcon.className = 'fas fa-robot'
}

chatToggle.addEventListener('click', () => isOpen ? closeChat() : openChat())
chatClose.addEventListener('click', closeChat)

// 빠른 버튼
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('quick-btn')) {
    const txt = e.target.textContent || ''
    // 이모지/특수문자 앞부분 제거 (공백 뒤 텍스트만 사용)
    const spaceIdx = txt.indexOf(' ')
    chatInput.value = spaceIdx !== -1 ? txt.slice(spaceIdx + 1).trim() : txt.trim()
    sendMessage()
  }
})

// 자동 높이 조절
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto'
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px'
})

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
})
chatSend.addEventListener('click', sendMessage)

function addMessage(role, text) {
  const isUser = role === 'user'
  const wrap = document.createElement('div')
  wrap.className = 'flex gap-3 ' + (isUser ? 'flex-row-reverse' : '')

  const avatar = document.createElement('div')
  avatar.className = 'w-8 h-8 min-w-[2rem] rounded-full flex items-center justify-center ' +
    (isUser ? 'bg-white/10' : 'bg-gradient-to-br from-brand to-accent')
  avatar.innerHTML = '<i class="fas fa-' + (isUser ? 'user' : 'robot') + ' text-white text-xs"></i>'

  const bubble = document.createElement('div')
  bubble.className = (isUser ? 'chat-bubble-user' : 'chat-bubble-bot') + ' p-3 max-w-[85%]'

  // 마크다운 기본 파싱
  const formatted = parseMarkdown(text)

  bubble.innerHTML = '<p class="text-white/90 text-sm leading-relaxed">' + formatted + '</p>'
  wrap.appendChild(avatar)
  wrap.appendChild(bubble)
  chatMessages.appendChild(wrap)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function showTyping() {
  const wrap = document.createElement('div')
  wrap.id = 'typingIndicator'
  wrap.className = 'flex gap-3'

  const avatar = document.createElement('div')
  avatar.className = 'w-8 h-8 min-w-[2rem] rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center'
  avatar.innerHTML = '<i class="fas fa-robot text-white text-xs"></i>'

  const bubble = document.createElement('div')
  bubble.className = 'chat-bubble-bot p-3'

  const dots = document.createElement('div')
  dots.className = 'flex gap-1 items-center h-4'
  for (let di = 0; di < 3; di++) {
    const d = document.createElement('div')
    d.className = 'typing-dot'
    dots.appendChild(d)
  }
  bubble.appendChild(dots)

  wrap.appendChild(avatar)
  wrap.appendChild(bubble)
  chatMessages.appendChild(wrap)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function removeTyping() {
  const t = document.getElementById('typingIndicator')
  if (t) t.remove()
}

async function sendMessage() {
  const text = chatInput.value.trim()
  if (!text) return

  addMessage('user', text)
  conversationHistory.push({ role: 'user', content: text })
  chatInput.value = ''
  chatInput.style.height = 'auto'
  chatSend.disabled = true

  showTyping()

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory })
    })
    const data = await res.json()
    removeTyping()
    const reply = data.reply || '죄송합니다. 잠시 후 다시 시도해 주세요.'
    addMessage('assistant', reply)
    conversationHistory.push({ role: 'assistant', content: reply })
  } catch(err) {
    removeTyping()
    addMessage('assistant', '일시적인 오류가 발생했습니다. 직접 문의 주시면 빠르게 답변 드리겠습니다! 010-6376-7604')
  } finally {
    chatSend.disabled = false
    chatInput.focus()
  }
}
</script>

</body>
</html>`
}

export default app
