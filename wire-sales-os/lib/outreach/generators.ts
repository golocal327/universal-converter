import type { EmailVariant } from "@/lib/domain/constants";
import { detectProblems, firstName, formatEuro, formatNumberEs, type DetectedProblem, type LeadContext } from "./context";

/**
 * Rules-based generation engine. Produces personalised outreach from real
 * lead data without any AI provider. When an AI provider is configured the
 * same LeadContext is sent to the model for a richer rewrite (lib/ai).
 */

export type OpportunityAnalysis = {
  summary: string;
  whyNow: string[];
  problems: DetectedProblem[];
  recommendedOffer: { name: string; setup: number; monthly: number; reason: string };
  extras: { label: string; setup: number; monthly: number; reason: string }[];
  bestAngle: string;
  estimatedValue: { setup: number; mrr: number; extras: number; firstYear: number };
  nextAction: string;
};

export function analyzeOpportunity(ctx: LeadContext): OpportunityAnalysis {
  const problems = detectProblems(ctx);
  const c = ctx.company;
  const reviews = c.google_reviews_count ?? 0;
  const whyNow: string[] = [];

  if (reviews >= 100) whyNow.push(`Strong local demand: ${reviews} Google reviews${c.google_rating ? ` at ${c.google_rating}★` : ""}.`);
  if (!c.website) whyNow.push("No website: every search and Instagram visit has nowhere to convert.");
  else if (ctx.audit?.status === "failed") whyNow.push("The website is down right now — urgent and easy to explain.");
  else if ((ctx.audit?.overall ?? 100) < 50) whyNow.push(`Website scores ${ctx.audit?.overall}/100: visible, fixable conversion leaks.`);
  if (problems.some((p) => p.key === "no_booking")) whyNow.push("Booking-driven sector without online booking.");
  if (ctx.sector?.value_tier === "high") whyNow.push(`${ctx.sector.name} is a high-value sector: one new customer pays for the project.`);
  if (ctx.lead && ctx.lead.priority === "hot") whyNow.push(`Lead score ${ctx.lead.score}/100 — top of the list.`);
  if (!whyNow.length) whyNow.push("Moderate opportunity: start with a light-touch message and qualify on reply.");

  const pricing = ctx.pricing;
  const recommendedOffer = pricing
    ? { name: pricing.packageName, setup: pricing.setup, monthly: pricing.monthly, reason: pricing.reason }
    : { name: "Website improvement", setup: 1200, monthly: 90, reason: "Default package — configure pricing rules for a tailored recommendation." };
  const extras = (pricing?.extras ?? []).map((e) => ({ label: e.label, setup: e.setup, monthly: e.monthly, reason: e.reason }));
  const extrasValue = extras.reduce((a, e) => a + e.setup + e.monthly * 12, 0);

  const main = problems[0];
  const demand = reviews >= 50 ? "strong Google demand" : c.instagram_url ? "an active social audience" : "an established local business";
  const bestAngle = main
    ? `Lead with the concrete leak: ${main.title.toLowerCase()}. The business has ${demand}, so frame WIRE's work as recovering customers they already attract — not as "marketing". Show the fix and the price in one message.`
    : `Lead with growth: they have ${demand}; propose ${recommendedOffer.name.toLowerCase()} as the next step to convert more of it.`;

  const summary = `${c.name}${c.city ? ` (${c.city})` : ""} — ${ctx.sector?.name ?? c.sector ?? "business"}. ${
    main ? `Main issue: ${main.title}.` : "No critical issue detected."
  } Recommended: ${recommendedOffer.name} at ${formatEuro(recommendedOffer.setup)} + ${formatEuro(recommendedOffer.monthly)}/month.`;

  const nextAction = !ctx.contact?.email && !c.email && (c.phone || ctx.contact?.phone)
    ? "Send a WhatsApp or call — no email on file."
    : main
      ? `Send the "${main.title}" email today and schedule a follow-up in 3 days.`
      : "Send a short professional email and follow up in 4 days.";

  return {
    summary,
    whyNow,
    problems,
    recommendedOffer,
    extras,
    bestAngle,
    estimatedValue: {
      setup: recommendedOffer.setup,
      mrr: recommendedOffer.monthly,
      extras: extrasValue,
      firstYear: recommendedOffer.setup + recommendedOffer.monthly * 12,
    },
    nextAction,
  };
}

export type GeneratedEmail = { variant: EmailVariant; subject: string; body: string };

function greeting(ctx: LeadContext) {
  const name = firstName(ctx.contact?.name);
  return name ? `Hola ${name},` : "Hola,";
}

function signature(ctx: LeadContext) {
  return [ctx.sender.name, ctx.sender.company, ctx.sender.phone].filter(Boolean).join("\n");
}

function demandSentence(ctx: LeadContext): string | null {
  const reviews = ctx.company.google_reviews_count ?? 0;
  if (reviews >= 50 && ctx.company.google_rating) {
    return `Con ${formatNumberEs(reviews)} reseñas y un ${formatNumberEs(ctx.company.google_rating)} en Google está claro que la demanda existe; el problema es que parte de esa gente no termina contactando.`;
  }
  if (reviews >= 20) return `Tenéis ${formatNumberEs(reviews)} reseñas en Google, así que la gente os busca; ahora toca que esa búsqueda termine en contacto.`;
  return null;
}

export function generateEmails(ctx: LeadContext): GeneratedEmail[] {
  const problems = detectProblems(ctx);
  const main = problems[0];
  const second = problems[1];
  const company = ctx.company.name;
  const offer = ctx.pricing?.packageName ?? "una mejora de vuestra web";
  const sectorName = (ctx.sector?.name ?? ctx.company.sector ?? "").toLowerCase();
  const argument = ctx.sector?.sales_arguments?.[0];
  const problemLine = main ? `he visto que ${main.sentence}` : "he visto que hay margen claro para convertir más visitas en clientes";
  const demand = demandSentence(ctx);

  const direct: GeneratedEmail = {
    variant: "direct",
    subject: main ? `${company}: ${main.title === "No website" ? "vuestra web" : "una idea rápida"}` : `${company}: una idea rápida`,
    body: [
      greeting(ctx),
      "",
      `He estado revisando ${company} y ${problemLine}.${demand ? ` ${demand}` : ""}`,
      "",
      "He preparado una propuesta corta de cómo lo solucionaría. ¿Te la envío?",
      "",
      signature(ctx),
    ].join("\n"),
  };

  const professional: GeneratedEmail = {
    variant: "professional",
    subject: `Propuesta de mejora digital para ${company}`,
    body: [
      greeting(ctx),
      "",
      `Trabajo con negocios${sectorName ? ` de ${sectorName}` : ""}${ctx.company.city ? ` en ${ctx.company.city}` : ""} ayudándoles a convertir más visitas en clientes.`,
      "",
      `Analizando la presencia digital de ${company} ${problemLine}${second ? `, y además ${second.sentence}` : ""}.${
        ctx.audit?.overall !== null && ctx.audit?.overall !== undefined && ctx.audit.status === "completed"
          ? ` En nuestra auditoría la web obtiene ${ctx.audit.overall}/100.`
          : ""
      }`,
      main ? `\n${main.impact}` : "",
      "",
      `Mi propuesta sería ${offer.toLowerCase()}${argument ? `. ${argument}` : ""}.`,
      "",
      "¿Te parece si lo vemos en una llamada de 15 minutos esta semana?",
      "",
      "Un saludo,",
      signature(ctx),
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n"),
  };

  const value = ctx.pricing ? ctx.pricing.setup + ctx.pricing.monthly * 12 : null;
  const highTicket: GeneratedEmail = {
    variant: "high_ticket",
    subject: `${company}: cómo captar más clientes desde Google`,
    body: [
      greeting(ctx),
      "",
      `Te escribo porque ${company} tiene algo que muchos negocios no tienen: ${
        (ctx.company.google_reviews_count ?? 0) >= 50 ? "una reputación sólida en Google" : "un negocio consolidado"
      }. Pero ${main ? main.sentence : "la parte digital no está a la altura"}.`,
      "",
      "Lo que propongo no es «una web nueva», sino un sistema completo de captación:",
      `• ${offer}${ctx.pricing ? ` (${formatEuro(ctx.pricing.setup)})` : ""}`,
      ...(ctx.pricing?.extras ?? []).slice(0, 3).map((e) => `• ${e.label}`),
      "• Mantenimiento, medición y mejoras continuas cada mes",
      "",
      value
        ? `La inversión del primer año ronda ${formatEuro(value)}. ${argument ?? "Con pocos clientes nuevos al mes el sistema se paga solo."}`
        : argument ?? "Con pocos clientes nuevos al mes el sistema se paga solo.",
      "",
      "Si te interesa, te enseño en una videollamada corta el plan concreto y ejemplos reales.",
      "",
      signature(ctx),
    ].join("\n"),
  };

  const followUp: GeneratedEmail = {
    variant: "follow_up",
    subject: `Re: ${company}`,
    body: [
      greeting(ctx),
      "",
      `Te escribí hace unos días sobre ${main ? main.title === "No website" ? "la web de" : "un detalle de la web de" : ""} ${company}.`.replace(/\s+/g, " "),
      "",
      main ? `En resumen: ${main.sentence}, y tiene solución sencilla.` : "En resumen: hay una mejora sencilla que os traería más contactos.",
      "",
      "¿Te viene bien una llamada rápida el jueves o el viernes?",
      "",
      ctx.sender.name,
    ].join("\n"),
  };

  return [direct, professional, highTicket, followUp];
}

export type GeneratedWhatsApp = { variant: "opener" | "value_first" | "follow_up"; body: string };

export function generateWhatsApp(ctx: LeadContext): GeneratedWhatsApp[] {
  const main = detectProblems(ctx)[0];
  const name = firstName(ctx.contact?.name);
  const hello = name ? `Hola, ${name}.` : "Hola.";
  const company = ctx.company.name;
  return [
    {
      variant: "opener",
      body: `${hello} Soy ${ctx.sender.name}.\nHe estado viendo ${company} y detecté un par de cosas en vuestra ${ctx.company.website ? "web" : "presencia online"} que probablemente os están haciendo perder contactos${main ? ` (${main.sentence})` : ""}.\nHe preparado una pequeña propuesta de cómo lo solucionaría. ¿Te la paso?`,
    },
    {
      variant: "value_first",
      body: `${hello} Te escribo por ${company}.\n${main ? `Me he fijado en que ${main.sentence}. ` : ""}${main?.impact ?? "Hay margen claro para conseguir más clientes desde Google."}\n¿Te mando un ejemplo de cómo quedaría?`,
    },
    {
      variant: "follow_up",
      body: `${hello} ¿Pudiste ver lo que te comenté sobre ${company}? Si te va mejor, lo vemos en 10 minutos por teléfono.`,
    },
  ];
}

export function generateCallScript(ctx: LeadContext): string {
  const a = analyzeOpportunity(ctx);
  const main = a.problems[0];
  return [
    "1. Apertura (15 s)",
    `   "Hola${ctx.contact?.name ? `, ${firstName(ctx.contact.name)}` : ""}, soy ${ctx.sender.name}. Te llamo porque he estado revisando ${ctx.company.name} y he visto algo que creo que os está costando clientes. ¿Tienes dos minutos?"`,
    "",
    "2. Problema concreto",
    `   ${main ? `"${main.sentence.charAt(0).toUpperCase() + main.sentence.slice(1)}. ${main.impact}"` : `"Tenéis buena reputación, pero la web no está convirtiendo esas visitas en contactos."`}`,
    "",
    "3. Pregunta de diagnóstico",
    `   "¿Cómo os llegan hoy la mayoría de clientes nuevos? ¿Cuántas llamadas o reservas recibís a la semana?"`,
    "",
    "4. Propuesta",
    `   "Lo que haría es ${a.recommendedOffer.name.toLowerCase()}. Para negocios como el vuestro suele estar en torno a ${formatEuro(a.recommendedOffer.setup)} y ${formatEuro(a.recommendedOffer.monthly)} al mes de mantenimiento."`,
    "",
    "5. Cierre",
    `   "¿Te parece si te enseño un ejemplo en una videollamada de 15 minutos? ¿Mejor el martes o el jueves?"`,
  ].join("\n");
}

export function generateObjections(ctx: LeadContext): { objection: string; response: string }[] {
  const price = ctx.pricing ? formatEuro(ctx.pricing.setup) : "la inversión";
  return [
    { objection: "Ya tenemos web.", response: ctx.audit?.overall !== null && ctx.audit?.overall !== undefined
      ? `Lo sé, y precisamente por eso os escribo: la he auditado y saca ${ctx.audit.overall}/100. No se trata de tener web, sino de que os traiga clientes.`
      : "Perfecto; la pregunta es si os trae clientes cada semana. Si me dejas, te enseño dónde se pierden contactos." },
    { objection: "Es caro.", response: `Entiendo. Pensemos en cuánto vale un cliente para vosotros${ctx.sector?.name ? ` en ${ctx.sector.name.toLowerCase()}` : ""}: con ${price} y pocos clientes extra al mes, se recupera rápido. También podemos empezar por la parte de mayor impacto.` },
    { objection: "Ahora no es buen momento.", response: "Ningún problema. ¿Te envío la propuesta por escrito y te llamo dentro de dos semanas para comentarla?" },
    { objection: "Ya nos llevan las redes / una agencia.", response: "Genial, eso suma. Lo mío es complementario: que las visitas que generan terminen en reservas o llamadas. Puedo coordinarme con ellos." },
    { objection: "Nos llegan clientes por el boca a boca.", response: "Es la mejor señal: tenéis un buen servicio. Esos clientes os buscan en Google antes de llamar; si la web no convence, algunos se quedan por el camino." },
  ];
}

export type ProposalContent = {
  title: string;
  intro: string;
  currentSituation: string[];
  problems: { title: string; detail: string }[];
  opportunities: string[];
  solution: { name: string; description: string };
  features: string[];
  timeline: { phase: string; duration: string; detail: string }[];
  investment: { setup: number; monthly: number; extras: { label: string; setup: number; monthly: number }[] };
  maintenance: string[];
  nextSteps: string[];
  validDays: number;
};

export function buildProposal(ctx: LeadContext): ProposalContent {
  const a = analyzeOpportunity(ctx);
  const c = ctx.company;
  const situation: string[] = [];
  if (c.website) situation.push(`Web actual: ${c.website}${ctx.audit?.overall !== null && ctx.audit?.overall !== undefined && ctx.audit.status === "completed" ? ` — puntuación de auditoría ${ctx.audit.overall}/100 (rendimiento ${ctx.audit.performance}, SEO ${ctx.audit.seo}, UX ${ctx.audit.ux}, conversión ${ctx.audit.conversion}, móvil ${ctx.audit.mobile}).` : "."}`);
  else situation.push("Actualmente el negocio no dispone de una web propia.");
  if (c.google_reviews_count) situation.push(`Reputación en Google: ${formatNumberEs(c.google_reviews_count)} reseñas${c.google_rating ? ` con una media de ${formatNumberEs(c.google_rating)}★` : ""}.`);
  if (c.instagram_url) situation.push("Presencia activa en Instagram.");

  const features = new Set<string>([
    "Diseño a medida, adaptado a móvil y a la imagen del negocio",
    "Llamadas a la acción claras (llamar, WhatsApp, pedir cita/presupuesto)",
    "SEO local técnico: estructura, metadatos, datos estructurados y velocidad",
    "Formularios conectados con aviso inmediato",
    "Analítica para medir contactos y reservas",
  ]);
  if (a.problems.some((p) => p.key === "no_booking") || ctx.sector?.booking_relevant) features.add("Sistema de reservas online con recordatorios");
  if (ctx.sector?.whatsapp_relevant) features.add("Botón de WhatsApp y mensajes de bienvenida");
  for (const e of a.extras) features.add(e.label);

  return {
    title: `Propuesta para ${c.name}`,
    intro: `Esta propuesta resume el análisis de la presencia digital de ${c.name} y el plan de WIRE para convertir la demanda que ya tenéis en más clientes.`,
    currentSituation: situation,
    problems: a.problems.slice(0, 5).map((p) => ({ title: p.titleEs, detail: `${p.sentence.charAt(0).toUpperCase()}${p.sentence.slice(1)}. ${p.impact}` })),
    opportunities: [...a.whyNow, ...(ctx.sector?.sales_arguments ?? []).slice(0, 2)],
    solution: { name: a.recommendedOffer.name, description: a.recommendedOffer.reason },
    features: [...features],
    timeline: [
      { phase: "Descubrimiento", duration: "Semana 1", detail: "Reunión inicial, objetivos, contenidos y accesos." },
      { phase: "Diseño", duration: "Semanas 2–3", detail: "Propuesta visual y estructura; una ronda de revisión." },
      { phase: "Desarrollo", duration: "Semanas 3–5", detail: "Implementación, integraciones, SEO técnico y pruebas en móvil." },
      { phase: "Lanzamiento", duration: "Semana 6", detail: "Publicación, medición y formación." },
    ],
    investment: { setup: a.recommendedOffer.setup, monthly: a.recommendedOffer.monthly, extras: a.extras.map((e) => ({ label: e.label, setup: e.setup, monthly: e.monthly })) },
    maintenance: ["Hosting, dominio y certificado SSL", "Actualizaciones y copias de seguridad", "Pequeños cambios de contenido cada mes", "Informe mensual de visitas y contactos"],
    nextSteps: ["Confirmar la propuesta", "Reunión de arranque", "Inicio del proyecto en 5 días laborables"],
    validDays: 30,
  };
}
