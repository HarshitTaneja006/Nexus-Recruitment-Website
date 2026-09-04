/**
 * Recruitment drive configuration: departments + interview questions.
 * Shared by the landing page (previews), the application form, and
 * server-side validation - single source of truth.
 *
 * Departments (Round-15 structure):
 *   technical · management · design_social_media
 */

export type QuestionType = "textarea" | "input";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  placeholder: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  hint?: string;
}

export interface Department {
  /** stable key stored in DB */
  id: string;
  /** directory-style label, e.g. "technical" */
  dir: string;
  name: string;
  tagline: string;
  description: string;
  /** stack / focus tags shown on the landing page */
  tags: string[];
  accentClass: string;
  questions: Question[];
}

const CHAR_LIMIT_LONG = 1200;
const CHAR_LIMIT_SHORT = 200;

const commonQuestion = (
  id: string,
  label: string,
  placeholder: string,
  minLength: number,
  hint?: string
): Question => ({
  id,
  label,
  type: "textarea",
  placeholder,
  required: true,
  minLength,
  maxLength: CHAR_LIMIT_LONG,
  hint,
});

export const COMMON_QUESTIONS: Question[] = [
  commonQuestion(
    "common_why_nexus",
    "Why do you want to join NEXUS, and what do you expect to gain from it?",
    "Be honest - what pulls you to a builder collective over a typical club?…",
    80,
    "Concrete intent beats generic praise. Tell us what you want to build."
  ),
  commonQuestion(
    "common_experience",
    "Tell us about a project, event or initiative you contributed to. What was your role and the outcome?",
    "School project, hackathon, MUN, family business spreadsheets - anything counts…",
    80
  ),
  commonQuestion(
    "common_commitment",
    "How many hours per week can you commit to NEXUS, and are you part of any other club or team?",
    "e.g. ~10 hrs/week. I'm in the astronomy club but it meets rarely…",
    20,
    "Zero spectators - we need builders who actually show up."
  ),
];

/**
 * Department accent colors as raw hex - for contexts that can't use Tailwind
 * classes (satori/OG image rendering, canvas, inline SVG). Keep in sync with
 * the accentClass values on DEPARTMENTS.
 */
export const DEPT_HEX: Record<string, string> = {
  technical: "#38bdf8",
  management: "#fbbf24",
  design_social_media: "#e879f9",
};

export function getDepartmentHex(id: string | null | undefined): string {
  return (id && DEPT_HEX[id]) || "#60a5fa";
}

export const DEPARTMENTS: Department[] = [
  {
    id: "technical",
    dir: "technical",
    name: "Technical",
    tagline: "From notebooks to deployed systems",
    description:
      "The builders' bench - web platforms, tools, automation and AI/ML. If it compiles, deploys and gets used by real people, it belongs here.",
    tags: ["React", "Next.js", "TypeScript", "Python", "PyTorch", "APIs"],
    accentClass: "text-sky-300",
    questions: [
      {
        id: "tech_builds",
        label: "What have you built so far - code, models, automations, tools?",
        type: "textarea",
        placeholder:
          "Projects, mini-tools, Kaggle experiments, bots, clones - stack + links if any…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
        hint: "Live links / repos earn bonus points. 'Nothing yet' is fine if you show hunger elsewhere.",
      },
      {
        id: "tech_teach_back",
        label:
          "Explain one technical concept you understand deeply - as if teaching a junior.",
        type: "textarea",
        placeholder:
          "Your own words - analogies welcome, textbook copy is not…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "tech_debug",
        label:
          "Something you shipped suddenly breaks for users. Walk us through how you debug it.",
        type: "textarea",
        placeholder:
          "Step-by-step: what you check first, what tools you use, how you confirm the fix…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "tech_track",
        label:
          "Which track pulls you more right now - web/platform engineering or AI/ML - and what have you done in it?",
        type: "textarea",
        placeholder:
          "Pick a lane, defend it, show evidence - courses, experiments, projects…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "tech_mini_task",
        label:
          "Mini-task: sketch a small tool NEXUS actually needs (e.g. an event RSVP tracker) - stack, data model, and the one part you'd find hardest.",
        type: "textarea",
        placeholder:
          "Architecture in plain words, no code required - show how you think…",
        required: true,
        minLength: 80,
        maxLength: CHAR_LIMIT_LONG,
      },
    ],
  },
  {
    id: "management",
    dir: "management",
    name: "Management",
    tagline: "Ops, finance & the glue that ships",
    description:
      "Budgets, sponsorships, treasury, operations and event strategy for everything NEXUS ships. Spreadsheets are your terminal.",
    tags: ["Budgeting", "Excel/Sheets", "Operations", "Sponsorships", "Strategy"],
    accentClass: "text-amber-300",
    questions: [
      {
        id: "mgmt_why",
        label:
          "Why management inside a tech club - what do you bring to the non-code side of shipping?",
        type: "textarea",
        placeholder:
          "What do ops/finance mean to you, and why inside NEXUS specifically…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "mgmt_concept",
        label:
          "Explain a finance or ops concept you actually use - budgeting, ROI, unit economics, logistics - in simple words.",
        type: "textarea",
        placeholder:
          "Pick one concept and explain it like you would to a first-year…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "mgmt_tools",
        label:
          "Which tools are you comfortable with (Excel/Sheets, Notion, forms, dashboards…)? Describe something non-trivial you built with them.",
        type: "textarea",
        placeholder:
          "XLOOKUP, pivot tables, budget trackers, trackers that people actually used…",
        required: true,
        minLength: 40,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "mgmt_budget_task",
        label:
          "Task: a NEXUS flagship event needs a ₹50,000 budget. How would you plan, allocate and track it?",
        type: "textarea",
        placeholder:
          "Category-wise allocation, contingencies, tracking cadence, reporting…",
        required: true,
        minLength: 80,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "mgmt_track_record",
        label:
          "Tell us about an event, stall, sponsorship or initiative you ran - numbers, mistakes, outcome.",
        type: "textarea",
        placeholder:
          "Anything from school bazaar stalls to a sponsorship you closed yourself…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
    ],
  },
  {
    id: "design_social_media",
    dir: "design_social_media",
    name: "Design and Social Media",
    tagline: "Glyphs that stop the scroll",
    description:
      "Brand, posters, social media and campus storytelling. You turn every ship into a story people actually see.",
    tags: ["Figma", "Canva", "Photoshop", "Copywriting", "Instagram", "Campaigns"],
    accentClass: "text-fuchsia-300",
    questions: [
      {
        id: "design_portfolio_links",
        label:
          "Share 2–3 links to designs you have made (posters, posts, logos, UI). Any public link works.",
        type: "textarea",
        placeholder:
          "Drive/Behance/Instagram/Figma links - one per line…",
        required: true,
        minLength: 20,
        maxLength: CHAR_LIMIT_LONG,
        hint: "No formal portfolio? Sketches and Canva experiments count.",
      },
      {
        id: "design_tools",
        label:
          "Which design tools are you comfortable with (Figma, Canva, Photoshop, Illustrator, Blender…)? Rate your proficiency.",
        type: "textarea",
        placeholder:
          "Figma: 8 - made 10+ event posts · Canva: 9 · Photoshop: 5…",
        required: true,
        minLength: 30,
        maxLength: CHAR_LIMIT_SHORT,
      },
      {
        id: "design_scroll_stopper",
        label:
          "What makes a social media post stop the scroll? Break down one post you admired.",
        type: "textarea",
        placeholder:
          "Hook, hierarchy, color, caption rhythm - dissect it like a designer…",
        required: true,
        minLength: 60,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "design_campaign_task",
        label:
          "Task: plan a campus promotion for NEXUS recruitment with a ₹2,000 budget.",
        type: "textarea",
        placeholder:
          "Channels, creatives, timeline, cost split, success metric…",
        required: true,
        minLength: 80,
        maxLength: CHAR_LIMIT_LONG,
      },
      {
        id: "design_caption_task",
        label:
          "Write a catchy Instagram caption + hashtag set for a NEXUS hackathon announcement.",
        type: "textarea",
        placeholder:
          "The caption is the creative - surprise us. #tags included…",
        required: true,
        minLength: 40,
        maxLength: CHAR_LIMIT_LONG,
      },
    ],
  },
];

/**
 * Labels for question ids that existed in earlier drive structures, so the
 * admin console keeps rendering legacy applications readably.
 */
export const LEGACY_QUESTION_LABELS: Record<string, string> = {
  webdev_projects: "[legacy] What have you built for the web so far?",
  webdev_csr_ssr: "[legacy] Client-side vs server-side rendering?",
  webdev_debug: "[legacy] Debug a slow page in production",
  webdev_self_rating: "[legacy] Rate yourself: HTML/CSS, JS/TS, framework",
  webdev_mini_task: "[legacy] Mini-task: responsive event page on weak Wi-Fi",
  aiml_supervised_unsupervised: "[legacy] Supervised vs unsupervised learning",
  aiml_project: "[legacy] Describe an ML/AI project",
  aiml_overfitting: "[legacy] What is overfitting? Three preventions",
  aiml_messy_data: "[legacy] Messy dataset preprocessing pipeline",
  aiml_excitement: "[legacy] CV / NLP / GenAI / RL / MLOps - which and why",
  finance_why: "[legacy] Why the Finance domain?",
  finance_concept: "[legacy] Explain a financial concept simply",
  finance_sheets: "[legacy] Spreadsheet tools you know",
  finance_budget_task: "[legacy] ₹50,000 event budget task",
  finance_competitions: "[legacy] Case comps / trading / event finance",
};

export function getDepartment(id: string | null | undefined): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}

export function getDepartmentName(id: string | null | undefined): string {
  return getDepartment(id)?.name ?? id ?? "-";
}

/** All question ids that must be answered for a given department (common + dept). */
export function requiredQuestionIds(departmentId: string): string[] {
  const dept = getDepartment(departmentId);
  if (!dept) return COMMON_QUESTIONS.filter((q) => q.required).map((q) => q.id);
  return [
    ...COMMON_QUESTIONS.filter((q) => q.required).map((q) => q.id),
    ...dept.questions.filter((q) => q.required).map((q) => q.id),
  ];
}

export interface Links {
  github: string;
  linkedin: string;
  portfolio: string;
}

export const EMPTY_LINKS: Links = { github: "", linkedin: "", portfolio: "" };
