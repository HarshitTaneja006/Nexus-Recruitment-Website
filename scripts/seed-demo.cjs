/**
 * Seeds realistic demo applications so the review console has data.
 * Safe to re-run — upserts by email. Run: bun scripts/seed-demo.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const COMMON = {
  common_why_nexus:
    "I want to build things people actually use, not collect certificates. NEXUS is the only place on campus where shipped work is the metric — I want that pressure and the mentors that come with it.",
  common_experience:
    "Organized our school's 24-hour coding marathon (300 participants); owned registrations and the judge dashboard. Learned that logistics is also engineering.",
  common_commitment:
    "About 12 hours a week. Not in any other club — my evenings are free for build nights.",
};

const STUDENTS = [
  {
    email: "priya.sharma2025@vitstudent.ac.in",
    department: "aiml",
    status: "SHORTLISTED",
    statusNote: "Strong ML fundamentals — cleared screening. Panel round on 28 Sep, 5:00 PM, AB1-301. Bring your DistilBERT project.",
    // full clarification loop already played out: asked → answered → shortlisted
    clarification: {
      question: "Your F1 number looks great — was the 87% on a held-out test set or on validation? How did you split?",
      askedHoursAgo: 20,
      answer: "On a stratified 80/10/10 train/val/test split, tuned only on val. Test set was touched exactly once for the final number.",
      answeredHoursAgo: 16,
    },
    links: { github: "github.com/priyasharma", linkedin: "linkedin.com/in/priyasharma", portfolio: "" },
    answers: {
      aiml_supervised_unsupervised:
        "Supervised learning trains on labeled data — spam vs not-spam. Unsupervised finds structure in raw data, like clustering the canteen crowd by spending patterns. First learns with an answer key, second finds the questions itself.",
      aiml_project:
        "Fine-tuned a tiny DistilBERT to classify campus complaint tickets into 6 categories. 4k rows scraped from the portal, 87% F1. It now triages tickets before humans see them.",
      aiml_overfitting:
        "The model memorizes noise instead of learning the signal — training loss keeps dropping while validation loss climbs. Fix: more/augmented data, regularization (dropout, weight decay), early stopping or simpler architectures.",
      aiml_messy_data:
        "Profile first (nulls, ranges, duplicates). Impute missing values (median for skewed numerics, mode/category 'unknown'), cap or flag outliers via IQR, encode categoricals, scale for distance-based models, and always keep a holdout untouched till the end.",
      aiml_excitement:
        "GenAI — not for hype, but because small fine-tuned models doing narrow tasks reliably feels like the real engineering frontier right now. I'd build a course-notes assistant for VIT first.",
    },
  },
  {
    email: "rohan.verma2023@vitstudent.ac.in",
    department: "webdev",
    status: "INTERVIEW",
    statusNote: "Tech interview: 30 Sep, 4:30 PM, Online (meet link emailed). Round 2 with the webdev lead.",
    // slot 2 days out so the live countdown on the receipt is visible
    interviewInDays: 2,
    interviewMode: "GOOGLE_MEET",
    links: { github: "github.com/rohanverma", linkedin: "", portfolio: "rohan.verma.dev" },
    answers: {
      webdev_projects:
        "Full-stack hostel mess feedback app (Next.js + Postgres, 1.2k monthly users) and a realtime DSA duel game with WebSockets. Both repos on my GitHub.",
      webdev_csr_ssr:
        "SSR renders HTML on the server — fast first paint, SEO-friendly, good for content. CSR ships a JS bundle that builds the UI client-side — rich interactivity after load. Content pages: SSR/SSG. Dashboards and tools: CSR, ideally with server components doing the data fetch.",
      webdev_debug:
        "Lighthouse + DevTools performance panel on throttled CPU/network to reproduce. Check the waterfall: bundle size, render-blocking assets, slow API, image weights. Fix the biggest offender first, measure again, iterate. Always confirm with real-user metrics after deploy.",
      webdev_self_rating:
        "HTML/CSS: 8 — I hand-write responsive layouts without frameworks. JS/TS: 8 — comfortable with generics and async patterns. React/Next: 7 — two production apps including one with server components.",
      webdev_mini_task:
        "Static shell prerendered + service worker precache, so the schedule renders instantly offline. Data in IndexedDB with stale-while-revalidate. Images as AVIF with lazy loading, system fonts, and a plain-HTML fallback if JS fails.",
    },
  },
  {
    email: "ishita.rao2025@vitstudent.ac.in",
    department: "design_social",
    status: "ACCEPTED",
    statusNote: "Welcome to Design & Social! Onboarding call: 02 Oct, 7 PM. Your poster pipeline starts with the freshers fest.",
    links: { github: "", linkedin: "linkedin.com/in/ishitarao", portfolio: "behance.net/ishitarao" },
    answers: {
      design_portfolio_links:
        "https://behance.net/ishitarao/fest-poster\nhttps://drive.google.com/nexus-mun-creatives\nhttps://instagram.com/p/design4change",
      design_tools:
        "Figma: 8 — design systems + auto-layout · Photoshop: 7 — posters and retouching · Canva: 9 — fast social kits · After Effects: 4 — basic reels.",
      design_scroll_stopper:
        "Contrast and one idea. A post I admired: black background, single amber word 'BEFORE' struck through, then the event name — 3 seconds to understand, shared 400+ times. Hierarchy first, decoration last.",
      design_campaign_task:
        "₹1,200 on 40 A3 posters at high-traffic points for 5 days, ₹500 on two reel collaborations with campus meme pages, ₹300 reserve for print-on-demand stickers. Success metric: 200+ QR scans to the form, tracked via UTM.",
      design_caption_task:
        "cp: 'Your side projects called. They want a home. NEXUS Recruitments '26 are live — four domains, zero spectators. Link in bio. #NEXUSRecruitments #VITChennai #BuildInPublic #ZeroSpectators #TechClub'",
    },
  },
  {
    email: "kabir.singh2024@vitstudent.ac.in",
    department: "finance",
    status: "NEEDS_INFO",
    statusNote: "Your budget task allocates ₹12.5k to prizes but the plan totals ₹47.5k — where did the remaining ₹2.5k go? Walk us through the gap.",
    clarification: {
      question: "Your budget task allocates ₹12.5k to prizes but the plan totals ₹47.5k — where did the remaining ₹2.5k go? Walk us through the gap.",
      askedHoursAgo: 5,
      answer: null,
      answeredHoursAgo: null,
    },
    links: { github: "", linkedin: "linkedin.com/in/kabirsingh", portfolio: "" },
    answers: {
      finance_why:
        "Tech clubs treat money as an afterthought and then panic before events. I like being the person who makes ambitious plans survivable — budgets are systems, and systems are engineering.",
      finance_concept:
        "Unit economics: what does one unit of activity cost vs earn. Our fest entry ticket isn't '₹150 revenue' until you subtract per-head food, kit and platform fees. Thinking per-unit exposes whether scale helps or hurts.",
      finance_sheets:
        "XLOOKUP, SUMIFS, pivot tables, conditional formatting. Built a personal expense tracker with auto-categorization rules and a monthly burn dashboard with sparklines — three semesters of data.",
      finance_budget_task:
        "Split: 40% venue/tech (₹20k), 25% prizes (₹12.5k), 15% logistics (₹7.5k), 10% publicity (₹5k), 10% contingency locked until week-of. Track in a shared sheet updated after every spend, weekly variance review against plan, and a one-page P&L for core team within 48h of the event.",
      finance_competitions:
        "Runners-up in a national virtual trading simulation (top 5% portfolio return); managed the ₹30k budget for our school's annual day as treasurer.",
    },
  },
  {
    email: "ananya.iyer2023@vitstudent.ac.in",
    department: "aiml",
    links: { github: "github.com/ananyaiyer", linkedin: "", portfolio: "" },
    answers: {
      aiml_supervised_unsupervised:
        "Supervised: learn f(x)→y from labeled examples, e.g. predicting hostel water usage from historical meter data. Unsupervised: no labels, find structure — e.g. grouping similar questions in a doubt forum to find FAQ clusters.",
      aiml_project:
        "Crop-disease classifier on PlantVillage (CNN, 94% val accuracy) for a hackathon; then learned the hard lesson that lab-clean images fail on real farm photos. Rewrote preprocessing to match deployment reality.",
      aiml_overfitting:
        "When the model memorizes training data instead of generalizing — train accuracy high, test accuracy poor. Prevent with: data augmentation, dropout/L2 regularization, early stopping, cross-validation, and choosing right-sized models.",
      aiml_messy_data:
        "EDA → handle missing (impute or flag, never blind-drop) → outlier treatment by domain sense, not just stats → consistent encodings → leakage check → pipeline it in sklearn so train/serve transformations stay identical.",
      aiml_excitement:
        "MLOps. Everyone trains models; almost nobody ships them reliably on a student budget. Docker + fastapi + a tiny monitoring loop would already put NEXUS ahead of most campus projects.",
    },
  },
  {
    email: "dev.patel2025@vitstudent.ac.in",
    department: "finance",
    status: "WAITLISTED",
    statusNote: "Solid budgeting instincts. You're on the reserve list — we'll reach out if a finance seat opens this cycle.",
    links: { github: "github.com/devpatel", linkedin: "", portfolio: "" },
    answers: {
      finance_why:
        "I interned two months at a CA firm and discovered I actually enjoy reconciling chaos into clean numbers. Combine that with a campus club that ships real events and I'm all in.",
      finance_concept:
        "Opportunity cost through a club lens: every ₹10k spent on one more sound system is ₹10k not spent on prizes or travel. Budgeting is really about what you give up, not what you spend.",
      finance_sheets:
        "Sheets daily: pivot tables, QUERY(), ARRAYFORMULA, data validation dropdowns. Built a shared sponsor-pipeline tracker with status rules and auto-email drafts via Apps Script.",
      finance_budget_task:
        "Build the ₹50k plan bottom-up per vendor quote, not top-down guess: venue ₹18k, equipment ₹12k, prizes ₹10k, F&B ₹6k, contingency ₹4k. Every expense logged same-day with receipt photo; weekly reconciliation; post-event report comparing plan vs actual at line level.",
      finance_competitions:
        "Won inter-school stock-pitch competition; manage a family portfolio watchlist with a monthly review memo to my father (his money, my analysis — real stakes).",
    },
  },
  {
    email: "sana.khan2024@vitstudent.ac.in",
    department: "design_social",
    status: "REJECTED",
    statusNote: "Great craft on the reels, but the campaign task showed gaps in funnel thinking. Re-apply next cycle — we mean it.",
    links: { github: "", linkedin: "", portfolio: "instagram.com/sana.makes" },
    answers: {
      design_portfolio_links:
        "https://instagram.com/sana.makes\nhttps://drive.google.com/sana-posters-pack",
      design_tools:
        "Canva: 9 · Figma: 7 · Illustrator: 6 — vector posters · CapCut: 8 — reels edits.",
      design_scroll_stopper:
        "Movement and payoff. A stop-motion post made of paper cutouts announcing a literature fest — the craft itself was the hook. Captions under 12 words, first line does the work.",
      design_campaign_task:
        "Day 1-2: 30 QR-coded posters near canteens and library (₹900). Day 3: reel with a trending audio showing 'POV: your code finally ships' (free, organic). Day 4: classroom announcements with a sticker drop (₹500). Day 5: countdown stories with swipe-up to form. Metric: form starts, not impressions.",
      design_caption_task:
        "cp: 'Bugs fear deadlines. We fear nothing. NEXUS hackathon loading… bring your worst ideas, we'll compile the best one. 🖥️ #NEXUS #HackTheCampus #VITChennai #BuildInPublic'",
    },
  },
];

async function main() {
  const now = new Date();
  let i = 0;
  for (const s of STUDENTS) {
    i += 1;
    const user = await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email },
    });
    const m = /^([a-z]+)\.([a-z]+)(\d{4})@/.exec(s.email);
    const name = `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2][0].toUpperCase()}${m[2].slice(1)}`;
    const joinYear = Number(m[3]);
    const academicStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const yearOfStudy = Math.min(5, Math.max(1, academicStart - joinYear + 1));
    const submittedAt = new Date(now.getTime() - i * 7 * 3600 * 1000); // staggered

    // audit trail: submission + review events
    const history = [
      { status: "SUBMITTED", note: null, by: s.email, at: submittedAt.toISOString() },
    ];
    if (s.clarification) {
      history.push({
        status: "NEEDS_INFO",
        note: s.clarification.question,
        by: "core.nexus2023@vitstudent.ac.in",
        at: new Date(now.getTime() - s.clarification.askedHoursAgo * 3600 * 1000).toISOString(),
      });
      if (s.clarification.answer) {
        history.push({
          status: "NEEDS_INFO",
          note: s.clarification.answer,
          by: "student",
          at: new Date(now.getTime() - s.clarification.answeredHoursAgo * 3600 * 1000).toISOString(),
        });
      }
    }
    if (s.status && s.status !== "SUBMITTED" && s.status !== "NEEDS_INFO") {
      history.push({
        status: s.status,
        note: s.statusNote ?? null,
        by: "core.nexus2023@vitstudent.ac.in",
        at: new Date(now.getTime() - i * 3 * 3600 * 1000).toISOString(),
      });
    }

    const interviewAt = s.interviewInDays
      ? new Date(now.getTime() + s.interviewInDays * 86_400_000)
      : null;

    const askedAt = s.clarification
      ? new Date(now.getTime() - s.clarification.askedHoursAgo * 3600 * 1000)
      : null;
    const answeredAt =
      s.clarification && s.clarification.answer
        ? new Date(now.getTime() - s.clarification.answeredHoursAgo * 3600 * 1000)
        : null;

    const shared = {
      answers: { ...COMMON, ...s.answers },
      links: s.links,
      department: s.department,
      fullName: name,
      yearOfStudy,
      joinYear,
      status: s.status ?? "SUBMITTED",
      statusNote: s.statusNote ?? null,
      reviewedBy: s.status ? "core.nexus2023@vitstudent.ac.in" : null,
      statusUpdatedAt: s.status ? new Date(now.getTime() - i * 3 * 3600 * 1000) : null,
      interviewAt,
      interviewMode: interviewAt ? s.interviewMode ?? "GOOGLE_MEET" : null,
      clarificationQuestion: s.clarification ? s.clarification.question : null,
      clarificationAnswer: s.clarification ? s.clarification.answer ?? null : null,
      clarificationAskedAt: askedAt,
      clarificationAnsweredAt: answeredAt,
      statusHistory: history,
    };

    await db.application.upsert({
      where: { email: s.email },
      update: shared,
      create: {
        userId: user.id,
        email: s.email,
        submittedAt,
        updatedAt: submittedAt,
        ...shared,
      },
    });
    console.log("seeded:", s.email, "→", s.department);
  }
  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
