import { parse, type HTMLElement } from "node-html-parser";

/**
 * Website audit analyzer — pure function over a fetched page.
 *
 * It produces itemized checks (what passed / failed and why), five 0–100
 * scores and a ranked list of commercial opportunities mapped to WIRE
 * services. Heuristics are deliberately transparent: every score can be
 * traced back to the checks that produced it.
 */
export const AUDIT_ENGINE_VERSION = "2026.10-1";

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type ScoreDimension = "performance" | "seo" | "ux" | "conversion" | "mobile";
export type CheckGroup = "technical" | "ux" | "commercial";

export type AuditCheck = {
  id: string;
  group: CheckGroup;
  dimension: ScoreDimension;
  label: string;
  status: CheckStatus;
  detail?: string;
  weight: number;
};

export type Impact = "high" | "medium" | "low";

export type AuditOpportunity = {
  key: string;
  title: string;
  detail: string;
  impact: Impact;
  /** Slug of the WIRE service that solves it (see lib/defaults/services). */
  service: string;
};

export type AuditSignalsDetail = {
  https: boolean;
  hasViewport: boolean;
  hasCta: boolean;
  ctaCount: number;
  hasBooking: boolean;
  bookingProvider: string | null;
  hasWhatsapp: boolean;
  hasForm: boolean;
  hasLeadCapture: boolean;
  hasTel: boolean;
  hasEmail: boolean;
  hasPricing: boolean;
  trustSignals: string[];
  outdated: boolean;
  outdatedReasons: string[];
  copyrightYear: number | null;
  wordCount: number;
  title: string | null;
  description: string | null;
  h1: string | null;
};

export type AuditScores = Record<ScoreDimension, number> & { overall: number };

export type AuditResult = {
  scores: AuditScores;
  checks: AuditCheck[];
  opportunities: AuditOpportunity[];
  signals: AuditSignalsDetail;
  tech: { cms: string | null; analytics: string[]; generator: string | null };
};

export type AnalyzeInput = {
  html: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  responseTimeMs: number;
  bytes: number;
  robotsTxt?: string | null;
  sitemapFound?: boolean | null;
  brokenLinks?: { checked: number; broken: string[] } | null;
  /** Booking is only an opportunity in sectors where customers book (clinics, gyms…). */
  bookingRelevant?: boolean;
  /** Lighthouse performance score (0–100) if PageSpeed Insights is configured. */
  lighthousePerformance?: number | null;
  now?: Date;
};

const BOOKING_PROVIDERS: [RegExp, string][] = [
  [/calendly\.com/i, "Calendly"],
  [/booksy\.com/i, "Booksy"],
  [/treatwell\./i, "Treatwell"],
  [/doctoralia\./i, "Doctoralia"],
  [/(thefork|eltenedor)\./i, "TheFork"],
  [/opentable\./i, "OpenTable"],
  [/simplybook\./i, "SimplyBook"],
  [/setmore\.com/i, "Setmore"],
  [/acuityscheduling\.com/i, "Acuity"],
  [/squareup\.com\/appointments/i, "Square"],
  [/reservio\./i, "Reservio"],
  [/bookitit\./i, "Bookitit"],
  [/cal\.com\//i, "Cal.com"],
  [/timify\./i, "Timify"],
  [/covermanager\./i, "CoverManager"],
  [/zenchef\./i, "Zenchef"],
  [/sevenrooms\./i, "SevenRooms"],
  [/glofox\./i, "Glofox"],
  [/mindbodyonline\./i, "Mindbody"],
  [/trainingym\./i, "Trainingym"],
  [/youcanbook\.me/i, "YouCanBookMe"],
  [/picktime\./i, "Picktime"],
  [/google\.com\/maps\/reserve/i, "Reserve with Google"],
];

const CTA_TEXT = /\b(contact|contacta|contáctanos|contactar|llama|llámanos|llamar|pide|pedir|solicita|solicitar|presupuesto|reserva|reservar|cita|book|call|quote|empieza|comenzar|comprar|compra|matric|inscr|apúntate|apuntate|request|demo|prueba|try|get started|hablemos|escríbenos|escribenos|whatsapp)\w*/i;
const BOOKING_TEXT = /\b(reserv|pedir cita|pide cita|cita previa|cita online|book now|book online|booking|agenda tu|agendar)\w*/i;
const TRUST_PATTERNS: [RegExp, string][] = [
  [/testimoni|lo que dicen|opiniones de (nuestros )?clientes/i, "Testimonials"],
  [/reseñas|resenas|reviews|valoraciones/i, "Reviews"],
  [/años de experiencia|years of experience|desde 19\d\d|desde 20\d\d|since (19|20)\d\d/i, "Experience"],
  [/certificad|certified|acreditad|homologad|colegiad/i, "Certifications"],
  [/garant[ií]a|guarantee/i, "Guarantee"],
  [/premio|award|galardon/i, "Awards"],
  [/trustpilot|trustindex|elfsight|google-reviews|g-review/i, "Review widget"],
  [/clientes satisfechos|happy clients|\+\s?\d{2,}\s?(clientes|alumnos|pacientes)/i, "Customer count"],
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function textOf(root: HTMLElement): string {
  const clone = parse(root.toString());
  clone.querySelectorAll("script, style, noscript, svg, template").forEach((n) => n.remove());
  return (clone.querySelector("body") ?? clone).text.replace(/\s+/g, " ").trim();
}

function attr(el: HTMLElement | null, name: string): string | null {
  const v = el?.getAttribute(name);
  return v ? v.trim() : null;
}

function detectTech(html: string, root: HTMLElement) {
  const generator = attr(root.querySelector('meta[name="generator"]'), "content");
  const markers: [RegExp, string][] = [
    [/wp-content|wp-includes|wordpress/i, "WordPress"],
    [/static\.wixstatic\.com|wix\.com|_wixCIDX/i, "Wix"],
    [/squarespace/i, "Squarespace"],
    [/cdn\.shopify\.com|shopify/i, "Shopify"],
    [/webflow/i, "Webflow"],
    [/joomla/i, "Joomla"],
    [/prestashop/i, "PrestaShop"],
    [/jimdo/i, "Jimdo"],
    [/img1\.wsimg\.com|godaddy/i, "GoDaddy Builder"],
    [/sites\.google\.com/i, "Google Sites"],
    [/__next|_next\/static/i, "Next.js"],
    [/framer/i, "Framer"],
  ];
  const cms = (generator && markers.find(([re]) => re.test(generator))?.[1]) ?? markers.find(([re]) => re.test(html))?.[1] ?? null;
  const analytics: string[] = [];
  if (/googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/.test(html)) analytics.push("Google Tag Manager");
  if (/gtag\(|google-analytics\.com|G-[A-Z0-9]{6,}/.test(html)) analytics.push("Google Analytics");
  if (/fbq\(|connect\.facebook\.net/.test(html)) analytics.push("Meta Pixel");
  if (/hotjar/i.test(html)) analytics.push("Hotjar");
  return { cms, analytics, generator };
}

export function analyzeHtml(input: AnalyzeInput): AuditResult {
  const now = input.now ?? new Date();
  const html = input.html ?? "";
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true } });
  const head = root.querySelector("head") ?? root;
  const finalUrl = new URL(input.finalUrl);
  const checks: AuditCheck[] = [];
  const add = (c: AuditCheck) => checks.push(c);

  const links = root.querySelectorAll("a");
  const hrefs = links.map((a) => (a.getAttribute("href") ?? "").trim());
  const bodyText = textOf(root);
  const lowerHtml = html.toLowerCase();

  // ---------------------------------------------------------------- signals
  const https = finalUrl.protocol === "https:";
  const viewport = attr(head.querySelector('meta[name="viewport"]'), "content");
  const hasViewport = Boolean(viewport && /width\s*=\s*device-width/i.test(viewport));
  const title = root.querySelector("title")?.text.trim() || null;
  const description = attr(head.querySelector('meta[name="description"]'), "content");
  const h1s = root.querySelectorAll("h1").map((h) => h.text.replace(/\s+/g, " ").trim()).filter(Boolean);
  const h2Count = root.querySelectorAll("h2").length;
  const canonical = attr(head.querySelector('link[rel="canonical"]'), "href");
  const robotsMeta = attr(head.querySelector('meta[name="robots"]'), "content");
  const lang = attr(root.querySelector("html"), "lang");
  const ogTitle = attr(head.querySelector('meta[property="og:title"]'), "content");
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').map((s) => s.text);
  const hasLocalBusinessSchema = jsonLd.some((j) => /LocalBusiness|Organization|MedicalClinic|Dentist|Restaurant|AutoRepair|HealthClub|Store/i.test(j));
  const images = root.querySelectorAll("img");
  const imagesWithAlt = images.filter((img) => (img.getAttribute("alt") ?? "").trim().length > 0).length;
  const favicon = head.querySelector('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  const forms = root.querySelectorAll("form");
  const hasForm = forms.length > 0;
  const hasLeadCapture = forms.some((f) => f.querySelector('input[type="email"], input[type="tel"], input[name*="mail"], input[name*="phone"], input[name*="tel"], textarea'));
  const hasTel = hrefs.some((h) => h.toLowerCase().startsWith("tel:"));
  const hasEmail = hrefs.some((h) => h.toLowerCase().startsWith("mailto:"));
  const hasWhatsapp = /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/|joinchat|wa-chat|whatsapp-button|wpp-button/i.test(html);

  const ctaElements = [...root.querySelectorAll("a, button, input[type=submit]")].filter((el) => {
    const label = (el.text || el.getAttribute("value") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    return label.length > 0 && label.length <= 60 && CTA_TEXT.test(label);
  });
  const ctaCount = ctaElements.length;
  const hasCta = ctaCount > 0;

  const providerHit = BOOKING_PROVIDERS.find(([re]) => re.test(html));
  const bookingLink = links.some((a) => {
    const label = a.text.replace(/\s+/g, " ").trim();
    const href = (a.getAttribute("href") ?? "").toLowerCase();
    return BOOKING_TEXT.test(label) && !href.startsWith("tel:") && !href.startsWith("mailto:") && href.length > 1;
  });
  const bookingForm = forms.some((f) => f.querySelector('input[type="date"], input[type="datetime-local"], input[type="time"]'));
  const hasBooking = Boolean(providerHit) || bookingLink || bookingForm;

  const hasPricing = /(\d[\d.,]*\s?€|€\s?\d|\bdesde\s+\d+|\bprecios?\b|\btarifas?\b|\bpricing\b)/i.test(bodyText);
  const trustSignals = TRUST_PATTERNS.filter(([re]) => re.test(bodyText) || re.test(lowerHtml)).map(([, label]) => label);

  const words = bodyText ? bodyText.split(/\s+/).filter((w) => /\p{L}/u.test(w)) : [];
  const sentences = bodyText.split(/[.!?]+\s/).filter((s) => s.trim().split(/\s+/).length > 3);
  const avgSentence = sentences.length ? words.length / sentences.length : 0;

  // Outdated-site heuristics
  const outdatedReasons: string[] = [];
  const copyrightYears = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]));
  const copyrightYear = copyrightYears.length ? Math.max(...copyrightYears) : null;
  const currentYear = now.getFullYear();
  if (copyrightYear && copyrightYear <= currentYear - 4) outdatedReasons.push(`Copyright ${copyrightYear}`);
  if (!/^\s*<!doctype html>/i.test(html) && /<!doctype/i.test(html)) outdatedReasons.push("Legacy doctype");
  if (/<(font|center|marquee|frameset)\b/i.test(html)) outdatedReasons.push("Legacy HTML tags");
  if (/\.swf\b|shockwave-flash/i.test(html)) outdatedReasons.push("Flash content");
  if (/jquery[-.]?1\.[0-9]\b|jquery\/1\.[0-9]\./i.test(html)) outdatedReasons.push("jQuery 1.x");
  if (!hasViewport) outdatedReasons.push("Not built for mobile");
  if (root.querySelectorAll("table").length > 4 && !root.querySelector("main, section, article")) outdatedReasons.push("Table-based layout");
  const strong = outdatedReasons.filter((r) => r !== `Copyright ${copyrightYear}`).length;
  const outdated = strong >= 2 || (strong >= 1 && Boolean(copyrightYear && copyrightYear <= currentYear - 3)) || Boolean(copyrightYear && copyrightYear <= currentYear - 6);

  // ---------------------------------------------------------------- performance
  const t = input.responseTimeMs;
  add({ id: "response_time", group: "technical", dimension: "performance", weight: 3, label: "Server response time",
    status: t < 800 ? "pass" : t < 2000 ? "warn" : "fail", detail: `${(t / 1000).toFixed(2)}s to load the HTML` });
  const kb = input.bytes / 1024;
  add({ id: "page_weight", group: "technical", dimension: "performance", weight: 2, label: "HTML weight",
    status: kb < 300 ? "pass" : kb < 1000 ? "warn" : "fail", detail: `${Math.round(kb)} KB of HTML` });
  const scripts = root.querySelectorAll("script[src]").length;
  add({ id: "script_count", group: "technical", dimension: "performance", weight: 2, label: "External scripts",
    status: scripts <= 15 ? "pass" : scripts <= 30 ? "warn" : "fail", detail: `${scripts} external scripts` });
  const enc = input.headers["content-encoding"];
  add({ id: "compression", group: "technical", dimension: "performance", weight: 1, label: "Compression",
    status: enc ? "pass" : kb > 30 ? "warn" : "pass", detail: enc ? `Served with ${enc}` : "No gzip/brotli compression" });
  const lazy = images.filter((img) => img.getAttribute("loading") === "lazy").length;
  add({ id: "lazy_images", group: "technical", dimension: "performance", weight: 1, label: "Image lazy-loading",
    status: images.length <= 8 || lazy >= images.length / 2 ? "pass" : "warn", detail: `${lazy}/${images.length} images lazy-loaded` });

  // ---------------------------------------------------------------- SEO / technical
  add({ id: "https", group: "technical", dimension: "seo", weight: 3, label: "HTTPS",
    status: https ? "pass" : "fail", detail: https ? "Served over HTTPS" : "Browsers flag the site as 'Not secure'" });
  add({ id: "meta_title", group: "technical", dimension: "seo", weight: 3, label: "Meta title",
    status: !title ? "fail" : title.length >= 10 && title.length <= 65 ? "pass" : "warn",
    detail: title ? `"${title.slice(0, 80)}" (${title.length} chars)` : "Missing <title>" });
  add({ id: "meta_description", group: "technical", dimension: "seo", weight: 3, label: "Meta description",
    status: !description ? "fail" : description.length >= 50 && description.length <= 170 ? "pass" : "warn",
    detail: description ? `${description.length} chars` : "Missing meta description" });
  add({ id: "h1", group: "technical", dimension: "seo", weight: 2, label: "Main heading (H1)",
    status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn",
    detail: h1s.length ? `${h1s.length} H1: "${h1s[0].slice(0, 60)}"` : "No H1 heading" });
  add({ id: "headings", group: "technical", dimension: "seo", weight: 1, label: "Heading structure",
    status: h2Count > 0 ? "pass" : "warn", detail: `${h2Count} H2 headings` });
  add({ id: "canonical", group: "technical", dimension: "seo", weight: 1, label: "Canonical URL",
    status: canonical ? "pass" : "warn", detail: canonical ?? "No canonical link" });
  if (input.robotsTxt !== undefined) {
    add({ id: "robots", group: "technical", dimension: "seo", weight: 1, label: "robots.txt",
      status: input.robotsTxt ? "pass" : "warn", detail: input.robotsTxt ? "Present" : "Missing" });
  }
  if (input.sitemapFound !== undefined && input.sitemapFound !== null) {
    add({ id: "sitemap", group: "technical", dimension: "seo", weight: 2, label: "XML sitemap",
      status: input.sitemapFound ? "pass" : "warn", detail: input.sitemapFound ? "Found" : "No sitemap found" });
  }
  add({ id: "structured_data", group: "technical", dimension: "seo", weight: 2, label: "Structured data",
    status: hasLocalBusinessSchema ? "pass" : jsonLd.length ? "warn" : "fail",
    detail: hasLocalBusinessSchema ? "Business schema present" : jsonLd.length ? "JSON-LD without business schema" : "No structured data" });
  add({ id: "lang", group: "technical", dimension: "seo", weight: 1, label: "Language attribute",
    status: lang ? "pass" : "warn", detail: lang ?? "Missing <html lang>" });
  add({ id: "image_alt", group: "technical", dimension: "seo", weight: 1, label: "Image alt text",
    status: images.length === 0 || imagesWithAlt / images.length >= 0.8 ? "pass" : "warn",
    detail: `${imagesWithAlt}/${images.length} images with alt text` });
  add({ id: "open_graph", group: "technical", dimension: "seo", weight: 1, label: "Social sharing tags",
    status: ogTitle ? "pass" : "warn", detail: ogTitle ? "Open Graph present" : "No Open Graph tags" });
  if (robotsMeta && /noindex/i.test(robotsMeta)) {
    add({ id: "noindex", group: "technical", dimension: "seo", weight: 4, label: "Indexable", status: "fail", detail: "Page is set to noindex" });
  }

  // ---------------------------------------------------------------- UX
  const hasNav = Boolean(root.querySelector("nav, [role=navigation], header ul, .menu, #menu, .navbar"));
  add({ id: "navigation", group: "ux", dimension: "ux", weight: 2, label: "Navigation", status: hasNav ? "pass" : "warn",
    detail: hasNav ? "Navigation menu found" : "No clear navigation" });
  const contactOptions = [hasTel, hasEmail, hasForm, hasWhatsapp].filter(Boolean).length;
  add({ id: "contact_options", group: "ux", dimension: "ux", weight: 3, label: "Contact options",
    status: contactOptions >= 2 ? "pass" : contactOptions === 1 ? "warn" : "fail",
    detail: `${contactOptions} channel(s): ${[hasTel && "phone", hasEmail && "email", hasForm && "form", hasWhatsapp && "WhatsApp"].filter(Boolean).join(", ") || "none"}` });
  add({ id: "content_depth", group: "ux", dimension: "ux", weight: 2, label: "Content depth",
    status: words.length >= 250 ? "pass" : words.length >= 100 ? "warn" : "fail", detail: `${words.length} words on the page` });
  add({ id: "readability", group: "ux", dimension: "ux", weight: 1, label: "Readability",
    status: avgSentence === 0 || avgSentence <= 22 ? "pass" : avgSentence <= 30 ? "warn" : "fail",
    detail: avgSentence ? `${avgSentence.toFixed(0)} words per sentence on average` : "Not enough text" });
  add({ id: "favicon", group: "ux", dimension: "ux", weight: 1, label: "Favicon", status: favicon ? "pass" : "warn" });
  if (input.brokenLinks) {
    const n = input.brokenLinks.broken.length;
    add({ id: "broken_links", group: "technical", dimension: "ux", weight: 2, label: "Broken links",
      status: n === 0 ? "pass" : n <= 2 ? "warn" : "fail", detail: `${n} broken of ${input.brokenLinks.checked} checked` });
  }
  add({ id: "modern_site", group: "ux", dimension: "ux", weight: 2, label: "Modern website",
    status: outdated ? "fail" : outdatedReasons.length ? "warn" : "pass",
    detail: outdatedReasons.length ? outdatedReasons.join(", ") : "No legacy signals" });

  // ---------------------------------------------------------------- Mobile
  add({ id: "viewport", group: "ux", dimension: "mobile", weight: 4, label: "Mobile viewport",
    status: hasViewport ? "pass" : "fail", detail: hasViewport ? "Responsive viewport set" : "Page is not configured for mobile screens" });
  const fixedWidth = /width\s*:\s*(9[6-9]\d|1\d{3})px/i.test(html) || root.querySelectorAll("table[width]").some((tb) => Number(tb.getAttribute("width")) >= 900);
  add({ id: "fixed_width", group: "ux", dimension: "mobile", weight: 2, label: "Fluid layout",
    status: fixedWidth ? "warn" : "pass", detail: fixedWidth ? "Fixed desktop widths detected" : "No fixed desktop widths" });
  add({ id: "tap_to_call", group: "ux", dimension: "mobile", weight: 2, label: "Tap-to-call",
    status: hasTel ? "pass" : "warn", detail: hasTel ? "tel: link present" : "Phone number is not clickable" });
  const responsiveImages = images.length === 0 || root.querySelector("img[srcset], picture, source[srcset]") !== null;
  add({ id: "responsive_images", group: "ux", dimension: "mobile", weight: 1, label: "Responsive images", status: responsiveImages ? "pass" : "warn" });
  add({ id: "mobile_whatsapp", group: "ux", dimension: "mobile", weight: 1, label: "Mobile messaging",
    status: hasWhatsapp ? "pass" : "warn", detail: hasWhatsapp ? "WhatsApp link present" : "No WhatsApp shortcut" });

  // ---------------------------------------------------------------- Conversion / commercial
  add({ id: "cta", group: "commercial", dimension: "conversion", weight: 4, label: "Clear call-to-action",
    status: ctaCount >= 2 ? "pass" : ctaCount === 1 ? "warn" : "fail", detail: `${ctaCount} call-to-action element(s)` });
  add({ id: "booking", group: "commercial", dimension: "conversion", weight: input.bookingRelevant ? 4 : 1, label: "Online booking",
    status: hasBooking ? "pass" : input.bookingRelevant ? "fail" : "info",
    detail: hasBooking ? `Booking available${providerHit ? ` (${providerHit[1]})` : ""}` : "Customers cannot book online" });
  add({ id: "whatsapp", group: "commercial", dimension: "conversion", weight: 2, label: "WhatsApp CTA",
    status: hasWhatsapp ? "pass" : "warn", detail: hasWhatsapp ? "WhatsApp contact available" : "No WhatsApp CTA" });
  add({ id: "lead_capture", group: "commercial", dimension: "conversion", weight: 3, label: "Lead capture",
    status: hasLeadCapture ? "pass" : hasForm ? "warn" : "fail", detail: hasLeadCapture ? "Contact form present" : "No form to capture leads" });
  add({ id: "trust", group: "commercial", dimension: "conversion", weight: 3, label: "Trust signals",
    status: trustSignals.length >= 2 ? "pass" : trustSignals.length === 1 ? "warn" : "fail",
    detail: trustSignals.length ? trustSignals.join(", ") : "No testimonials, reviews or credentials" });
  const clearOffer = Boolean(h1s[0] && h1s[0].split(/\s+/).length >= 3 && description);
  add({ id: "clear_offer", group: "commercial", dimension: "conversion", weight: 2, label: "Clear offer",
    status: clearOffer ? "pass" : h1s[0] ? "warn" : "fail", detail: clearOffer ? "Headline and summary explain the offer" : "Visitors can't tell what is offered" });
  add({ id: "pricing", group: "commercial", dimension: "conversion", weight: 1, label: "Pricing visibility",
    status: hasPricing ? "pass" : "info", detail: hasPricing ? "Prices or rates visible" : "No pricing information" });
  const conversionPoints = ctaCount + (hasForm ? 1 : 0) + (hasWhatsapp ? 1 : 0) + (hasTel ? 1 : 0) + (hasBooking ? 1 : 0);
  add({ id: "conversion_points", group: "commercial", dimension: "conversion", weight: 2, label: "Conversion points",
    status: conversionPoints >= 4 ? "pass" : conversionPoints >= 2 ? "warn" : "fail", detail: `${conversionPoints} ways to convert` });

  // ---------------------------------------------------------------- scores
  const dims: ScoreDimension[] = ["performance", "seo", "ux", "conversion", "mobile"];
  const value: Record<CheckStatus, number | null> = { pass: 1, warn: 0.5, fail: 0, info: null };
  const scores = Object.fromEntries(
    dims.map((d) => {
      const scored = checks.filter((c) => c.dimension === d && value[c.status] !== null);
      const total = scored.reduce((a, c) => a + c.weight, 0);
      const got = scored.reduce((a, c) => a + c.weight * (value[c.status] as number), 0);
      return [d, total ? clamp((got / total) * 100) : 50];
    }),
  ) as Record<ScoreDimension, number>;
  if (typeof input.lighthousePerformance === "number") scores.performance = clamp(input.lighthousePerformance);
  if (!https) scores.seo = clamp(scores.seo - 10);
  const overall = clamp(scores.performance * 0.2 + scores.seo * 0.2 + scores.ux * 0.2 + scores.conversion * 0.25 + scores.mobile * 0.15);

  const signals: AuditSignalsDetail = {
    https,
    hasViewport,
    hasCta,
    ctaCount,
    hasBooking,
    bookingProvider: providerHit?.[1] ?? null,
    hasWhatsapp,
    hasForm,
    hasLeadCapture,
    hasTel,
    hasEmail,
    hasPricing,
    trustSignals,
    outdated,
    outdatedReasons,
    copyrightYear,
    wordCount: words.length,
    title,
    description,
    h1: h1s[0] ?? null,
  };

  return {
    scores: { ...scores, overall },
    checks,
    opportunities: deriveOpportunities(checks, signals, scores, Boolean(input.bookingRelevant)),
    signals,
    tech: detectTech(html, root),
  };
}

const IMPACT_RANK: Record<Impact, number> = { high: 3, medium: 2, low: 1 };

export function deriveOpportunities(
  checks: AuditCheck[],
  signals: AuditSignalsDetail,
  scores: Record<ScoreDimension, number>,
  bookingRelevant: boolean,
): AuditOpportunity[] {
  const failed = (id: string) => checks.find((c) => c.id === id && (c.status === "fail" || c.status === "warn"));
  const out: AuditOpportunity[] = [];
  const push = (o: AuditOpportunity) => out.push(o);

  if (bookingRelevant && !signals.hasBooking)
    push({ key: "no_booking", title: "No online booking", impact: "high", service: "booking-system",
      detail: "Customers have to call or message to book; an online booking flow converts visitors 24/7." });
  if (scores.mobile < 60)
    push({ key: "weak_mobile", title: "Weak mobile experience", impact: "high", service: "website-redesign",
      detail: "Most local searches happen on mobile; the site is hard to use on a phone." });
  if (!signals.hasCta || failed("cta")?.status === "fail")
    push({ key: "no_cta", title: "No clear CTA", impact: "high", service: "website-redesign",
      detail: "Visitors are not told what to do next (call, book, request a quote)." });
  if (signals.outdated)
    push({ key: "outdated", title: "Outdated website", impact: "high", service: "website-redesign",
      detail: `The site looks and works like an old website (${signals.outdatedReasons.slice(0, 3).join(", ")}).` });
  if (failed("meta_title") || failed("meta_description") || failed("h1"))
    push({ key: "poor_seo_metadata", title: "Poor SEO metadata", impact: "medium", service: "seo-local",
      detail: "Missing or weak title, description or headings reduce visibility on Google." });
  if (!signals.hasWhatsapp)
    push({ key: "no_whatsapp", title: "No WhatsApp CTA", impact: "medium", service: "whatsapp-integration",
      detail: "A one-tap WhatsApp button is the preferred contact channel for many customers in Spain." });
  if (!signals.https)
    push({ key: "no_https", title: "No HTTPS", impact: "high", service: "web-maintenance",
      detail: "Chrome labels the site 'Not secure', which destroys trust and hurts SEO." });
  if (scores.performance < 50)
    push({ key: "slow", title: "Slow loading", impact: "medium", service: "website-redesign",
      detail: "Slow pages lose visitors before they see the offer." });
  if (!signals.hasLeadCapture)
    push({ key: "no_lead_capture", title: "No lead capture", impact: "medium", service: "automation",
      detail: "No form to collect enquiries; leads that don't call are lost." });
  if (signals.trustSignals.length < 2)
    push({ key: "weak_trust", title: "Few trust signals", impact: "medium", service: "review-nfc",
      detail: "Reviews and testimonials are not visible on the site." });
  if (failed("structured_data")?.status === "fail" || failed("sitemap"))
    push({ key: "technical_seo", title: "Missing technical SEO", impact: "low", service: "seo-local",
      detail: "No structured data / sitemap to help Google understand the business." });
  if (failed("broken_links"))
    push({ key: "broken_links", title: "Broken links", impact: "low", service: "web-maintenance",
      detail: "Some links lead to errors — a sign the site is not maintained." });

  return out.sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact]);
}
