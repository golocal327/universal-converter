import type { ServiceCategory, TemplateCategory, ValueTier, EmailVariant, Channel } from "@/lib/domain/constants";
import type { PricingConditions } from "@/lib/pricing/engine";

/**
 * Default commercial configuration installed in every new workspace.
 * Prices are starting points for the Spanish SMB market, NOT market data:
 * adjust them in Settings → Pricing / Sectors.
 */

export type DefaultService = {
  slug: string;
  name: string;
  category: ServiceCategory;
  description: string;
  setup_price: number;
  monthly_price: number;
};

export const DEFAULT_SERVICES: DefaultService[] = [
  { slug: "website-premium", name: "Premium website", category: "website", setup_price: 2400, monthly_price: 0,
    description: "Custom-designed, conversion-focused website built from scratch." },
  { slug: "website-redesign", name: "Website redesign", category: "website", setup_price: 2500, monthly_price: 0,
    description: "Full redesign of an existing website: UX, mobile, speed and conversion." },
  { slug: "web-maintenance", name: "Maintenance & hosting", category: "maintenance", setup_price: 0, monthly_price: 90,
    description: "Hosting, updates, backups, security, small changes and monitoring." },
  { slug: "seo-local", name: "Local SEO", category: "seo", setup_price: 500, monthly_price: 150,
    description: "On-page SEO, Google Business Profile, local citations and monthly reporting." },
  { slug: "booking-system", name: "Online booking system", category: "booking", setup_price: 600, monthly_price: 30,
    description: "Online appointments with reminders, integrated in the website." },
  { slug: "whatsapp-integration", name: "WhatsApp integration", category: "whatsapp", setup_price: 400, monthly_price: 0,
    description: "WhatsApp CTA, click-to-chat flows and automatic replies." },
  { slug: "automation", name: "Business automation", category: "automation", setup_price: 800, monthly_price: 50,
    description: "Lead capture, CRM sync, follow-up emails and internal notifications." },
  { slug: "ai-chatbot", name: "AI chatbot", category: "chatbot", setup_price: 900, monthly_price: 79,
    description: "AI assistant that answers FAQs and books appointments 24/7." },
  { slug: "review-nfc", name: "NFC/QR review system", category: "nfc", setup_price: 190, monthly_price: 0,
    description: "NFC cards and QR displays that turn happy customers into Google reviews." },
  { slug: "crm-integration", name: "CRM & integrations", category: "integration", setup_price: 700, monthly_price: 40,
    description: "Connect forms, booking, invoicing and CRM so data flows automatically." },
];

export type DefaultSector = {
  slug: string;
  name: string;
  value_tier: ValueTier;
  avg_ticket: number;
  booking_relevant: boolean;
  whatsapp_relevant: boolean;
  setup_price_min: number;
  setup_price_max: number;
  monthly_price: number;
  common_problems: string[];
  sales_arguments: string[];
  keywords: string[];
  services: string[];
};

export const DEFAULT_SECTORS: DefaultSector[] = [
  {
    slug: "autoescuelas", name: "Autoescuelas", value_tier: "high", avg_ticket: 900, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 1800, setup_price_max: 3000, monthly_price: 150,
    common_problems: ["Matrícula solo presencial o por teléfono", "Sin precios de los carnets visibles", "Web antigua que no se ve bien en móvil", "Sin opiniones de alumnos en la web"],
    sales_arguments: ["Cada alumno vale cientos de euros: un par de matrículas al mes pagan la web", "Los alumnos comparan autoescuelas en el móvil antes de llamar", "Matrícula y reserva de prácticas online reducen llamadas"],
    keywords: ["autoescuela", "driving school", "carnet de conducir"], services: ["website-redesign", "booking-system", "whatsapp-integration", "seo-local"],
  },
  {
    slug: "clinicas", name: "Clínicas", value_tier: "high", avg_ticket: 1200, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 2200, setup_price_max: 4000, monthly_price: 200,
    common_problems: ["Citas solo por teléfono", "Tratamientos sin explicar ni precios orientativos", "Web lenta y sin señales de confianza", "Poca visibilidad local en Google"],
    sales_arguments: ["Un paciente nuevo de tratamiento compensa la inversión", "La cita online 24/7 captura pacientes fuera de horario", "La confianza (equipo, reseñas, certificaciones) decide la elección"],
    keywords: ["clinica", "dentista", "clinica dental", "medical clinic", "dentist"], services: ["website-redesign", "booking-system", "seo-local", "ai-chatbot"],
  },
  {
    slug: "fisioterapia", name: "Fisioterapia", value_tier: "medium", avg_ticket: 400, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 1200, setup_price_max: 2200, monthly_price: 120,
    common_problems: ["Sin reserva online de sesiones", "No explica especialidades", "Sin presencia en búsquedas locales"],
    sales_arguments: ["Los pacientes buscan 'fisio cerca de mí' en el móvil", "La reserva online llena huecos de agenda", "Bonos y recordatorios automáticos aumentan la recurrencia"],
    keywords: ["fisioterapia", "fisioterapeuta", "physiotherapist"], services: ["website-premium", "booking-system", "seo-local", "review-nfc"],
  },
  {
    slug: "restaurantes", name: "Restaurantes", value_tier: "medium", avg_ticket: 300, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 900, setup_price_max: 2000, monthly_price: 90,
    common_problems: ["Carta en PDF o desactualizada", "Reservas solo por teléfono", "Fotos de baja calidad", "Dependencia de plataformas con comisión"],
    sales_arguments: ["Reservas directas sin comisiones de terceros", "La carta visible en el móvil convierte búsquedas en mesas", "Las reseñas de Google deciden dónde se come"],
    keywords: ["restaurante", "restaurant", "bar", "cafeteria"], services: ["website-premium", "booking-system", "review-nfc", "whatsapp-integration"],
  },
  {
    slug: "barberias", name: "Barberías y peluquerías", value_tier: "low", avg_ticket: 150, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 700, setup_price_max: 1400, monthly_price: 60,
    common_problems: ["Citas por WhatsApp manual", "Sin web propia, solo Instagram", "Sin recordatorios de cita"],
    sales_arguments: ["La reserva online elimina el ida y vuelta de mensajes", "Recordatorios automáticos reducen ausencias", "Una web propia posiciona en Google Maps"],
    keywords: ["barberia", "peluqueria", "barber shop", "hair salon"], services: ["website-premium", "booking-system", "review-nfc"],
  },
  {
    slug: "talleres", name: "Talleres", value_tier: "medium", avg_ticket: 500, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 1000, setup_price_max: 2000, monthly_price: 90,
    common_problems: ["Sin solicitud de cita/presupuesto online", "Servicios no detallados", "Web inexistente o abandonada"],
    sales_arguments: ["Pedir cita para la ITV o revisión desde el móvil", "Presupuestos online captan clientes que no llaman", "La confianza se gana con reseñas visibles"],
    keywords: ["taller", "taller mecanico", "car repair", "auto repair"], services: ["website-premium", "booking-system", "whatsapp-integration", "seo-local"],
  },
  {
    slug: "inmobiliarias", name: "Inmobiliarias", value_tier: "high", avg_ticket: 3000, booking_relevant: false, whatsapp_relevant: true,
    setup_price_min: 2500, setup_price_max: 5000, monthly_price: 250,
    common_problems: ["Portal de inmuebles lento o desactualizado", "Sin captación de propietarios", "Dependencia de portales externos"],
    sales_arguments: ["Captar un solo propietario paga el proyecto", "Valoración online como imán de leads", "Automatizar alertas a compradores"],
    keywords: ["inmobiliaria", "real estate agency"], services: ["website-redesign", "automation", "crm-integration", "seo-local"],
  },
  {
    slug: "asesorias", name: "Asesorías", value_tier: "high", avg_ticket: 1500, booking_relevant: false, whatsapp_relevant: false,
    setup_price_min: 1500, setup_price_max: 3000, monthly_price: 150,
    common_problems: ["Web corporativa genérica", "Sin captación de leads", "Procesos con clientes manuales"],
    sales_arguments: ["Un cliente recurrente de asesoría vale miles al año", "Formularios y automatizaciones ahorran horas de gestión", "Posicionar servicios concretos (autónomos, sociedades) en Google"],
    keywords: ["asesoria", "gestoria", "accounting firm", "tax advisor"], services: ["website-redesign", "automation", "crm-integration", "seo-local"],
  },
  {
    slug: "veterinarios", name: "Veterinarios", value_tier: "medium", avg_ticket: 600, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 1200, setup_price_max: 2500, monthly_price: 120,
    common_problems: ["Citas solo por teléfono", "Urgencias y horarios poco claros", "Sin recordatorios de vacunas"],
    sales_arguments: ["Recordatorios automáticos generan visitas recurrentes", "Cita online para revisiones y vacunas", "Información de urgencias clara en móvil"],
    keywords: ["veterinario", "clinica veterinaria", "veterinary care"], services: ["website-premium", "booking-system", "automation", "review-nfc"],
  },
  {
    slug: "gimnasios", name: "Gimnasios", value_tier: "medium", avg_ticket: 500, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 1200, setup_price_max: 2500, monthly_price: 120,
    common_problems: ["Sin alta online ni prueba gratuita", "Horarios de clases desactualizados", "Sin captación de leads"],
    sales_arguments: ["Alta online y clase de prueba aumentan socios", "Reserva de clases desde el móvil", "Automatizar seguimiento de leads de prueba"],
    keywords: ["gimnasio", "gym", "crossfit", "centro deportivo"], services: ["website-redesign", "booking-system", "automation", "ai-chatbot"],
  },
  {
    slug: "hoteles", name: "Hoteles", value_tier: "high", avg_ticket: 2500, booking_relevant: true, whatsapp_relevant: true,
    setup_price_min: 2500, setup_price_max: 5000, monthly_price: 250,
    common_problems: ["Dependencia de OTAs con comisiones del 15–20%", "Motor de reservas pobre", "Web lenta con fotos pesadas"],
    sales_arguments: ["Cada reserva directa ahorra la comisión de la OTA", "Una web rápida y visual convierte más", "Chatbot multiidioma para huéspedes"],
    keywords: ["hotel", "hostal", "apartamentos turisticos", "lodging"], services: ["website-redesign", "booking-system", "ai-chatbot", "seo-local"],
  },
  {
    slug: "seguros", name: "Seguros", value_tier: "high", avg_ticket: 1500, booking_relevant: false, whatsapp_relevant: true,
    setup_price_min: 1500, setup_price_max: 3000, monthly_price: 150,
    common_problems: ["Web sin formularios de presupuesto", "Sin automatización de renovaciones", "Imagen poco profesional"],
    sales_arguments: ["Formulario de presupuesto online = leads cualificados", "Automatizar recordatorios de renovación", "Confianza y profesionalidad venden pólizas"],
    keywords: ["seguros", "correduria de seguros", "insurance agency"], services: ["website-redesign", "automation", "crm-integration", "whatsapp-integration"],
  },
];

export type DefaultPricingRule = {
  name: string;
  priority: number;
  conditions: PricingConditions;
  package_name: string;
  service_slug: string | null;
  setup_price: number;
  monthly_price: number;
};

export const DEFAULT_PRICING_RULES: DefaultPricingRule[] = [
  { name: "High potential, no website", priority: 10, conditions: { business_potential: ["high"], website_quality: ["none"] },
    package_name: "Premium website (new)", service_slug: "website-premium", setup_price: 2400, monthly_price: 180 },
  { name: "High potential, weak website", priority: 20, conditions: { business_potential: ["high"], website_quality: ["low"] },
    package_name: "Premium website redesign", service_slug: "website-redesign", setup_price: 2500, monthly_price: 200 },
  { name: "High potential, average website", priority: 30, conditions: { business_potential: ["high"], website_quality: ["medium"] },
    package_name: "Conversion upgrade + SEO", service_slug: "seo-local", setup_price: 1500, monthly_price: 150 },
  { name: "High potential, good website", priority: 40, conditions: { business_potential: ["high"], website_quality: ["high"] },
    package_name: "Automation & growth", service_slug: "automation", setup_price: 1200, monthly_price: 250 },
  { name: "Medium potential, missing/weak website", priority: 50, conditions: { business_potential: ["medium"], website_quality: ["none", "low"] },
    package_name: "Professional website", service_slug: "website-premium", setup_price: 1500, monthly_price: 120 },
  { name: "Medium potential, decent website", priority: 60, conditions: { business_potential: ["medium"], website_quality: ["medium", "high"] },
    package_name: "Website optimisation", service_slug: "website-redesign", setup_price: 900, monthly_price: 90 },
  { name: "Low potential", priority: 70, conditions: { business_potential: ["low"] },
    package_name: "Essential website", service_slug: "website-premium", setup_price: 900, monthly_price: 60 },
];

export type DefaultTemplate = {
  name: string;
  category: TemplateCategory;
  channel: Channel;
  variant: EmailVariant | null;
  subject: string | null;
  body: string;
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "Primer contacto — directo", category: "cold_outreach", channel: "email", variant: "direct",
    subject: "{{company_name}}: una idea rápida",
    body: `Hola {{contact_name}},

He estado revisando {{company_name}} y he visto que {{main_problem}}.

Tengo una propuesta concreta para solucionarlo ({{recommended_service}}). ¿Te la envío?

Un saludo,
{{sender_name}}`,
  },
  {
    name: "Primer contacto — profesional", category: "cold_outreach", channel: "email", variant: "professional",
    subject: "Propuesta de mejora digital para {{company_name}}",
    body: `Hola {{contact_name}},

Me llamo {{sender_name}} y trabajo con negocios de {{sector}} en {{city}} ayudándoles a convertir más visitas en clientes.

Analizando la presencia digital de {{company_name}} he detectado algo que probablemente os está costando contactos: {{main_problem}}. La web obtiene una puntuación de {{website_score}}/100 en nuestra auditoría.

Mi propuesta sería {{recommended_service}}. Si te parece, te preparo en 15 minutos una explicación con ejemplos de lo que cambiaría.

¿Tienes un hueco esta semana?

Un saludo,
{{sender_name}}`,
  },
  {
    name: "Seguimiento a los 3 días", category: "follow_up", channel: "email", variant: "follow_up",
    subject: "Re: {{company_name}}",
    body: `Hola {{contact_name}},

Te escribí hace unos días sobre {{main_problem}} en {{company_name}}.

Sé que vais con mucho trabajo, así que lo resumo: puedo enseñarte en una llamada corta cómo lo solucionaría y lo que costaría. Sin compromiso.

¿Te viene bien el jueves o el viernes?

{{sender_name}}`,
  },
  {
    name: "WhatsApp — primer mensaje", category: "cold_outreach", channel: "whatsapp", variant: "direct", subject: null,
    body: `Hola {{contact_name}}, soy {{sender_name}}.
He estado viendo {{company_name}} y detecté un par de cosas en vuestra presencia online que probablemente os están haciendo perder contactos ({{main_problem}}).
He preparado una pequeña propuesta de cómo lo solucionaría. ¿Te la paso?`,
  },
  {
    name: "Envío de propuesta", category: "proposal", channel: "email", variant: "professional",
    subject: "Propuesta para {{company_name}}",
    body: `Hola {{contact_name}},

Como hablamos, te envío la propuesta para {{company_name}}: {{recommended_service}}.

Incluye el análisis de la situación actual, la solución, los plazos y la inversión. Cualquier duda me dices y lo vemos.

Un saludo,
{{sender_name}}`,
  },
];
