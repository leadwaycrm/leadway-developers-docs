/**
 * Source the canonical scope catalog into `data/scopes.raw.json`.
 *
 * Originally designed to scrape `marketplace.gohighlevel.com`, but that site
 * is a fully client-rendered SPA that returns empty HTML to non-browser fetches.
 * For v1 we seed the catalog from a hand-curated manifest of the 35 (+ 1)
 * categories Pablo enumerated, using the canonical GHL scope naming convention
 * (`<resource>.readonly` + `<resource>.write`).
 *
 * When/if a real scraping path becomes viable (Playwright via MCP, or an
 * official OpenAPI spec), swap the `buildSeed` function for the real fetcher.
 * Downstream scripts (`build-scopes-data.mjs`, `generate-scope-pages.mjs`)
 * remain unchanged.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "data", "scopes.raw.json");

const CATEGORIES = [
  {
    slug: "ad-manager",
    name: "Ad Manager",
    resource: "adManager",
    summary: "Campañas de anuncios de Facebook y Google conectadas a tu cuenta.",
    readDesc: "Leer reportes, campañas y métricas del Ad Manager de tu cuenta.",
    writeDesc: "Crear, pausar y editar campañas de anuncios desde el Ad Manager.",
  },
  {
    slug: "affiliate-manager",
    name: "Affiliate Manager",
    resource: "affiliateManager",
    summary: "Programa de afiliados, payouts y tracking de comisiones.",
    readDesc: "Leer afiliados, sus enlaces, métricas y payouts.",
    writeDesc: "Crear afiliados, ajustar comisiones y registrar payouts.",
  },
  {
    slug: "ai-agent",
    name: "AI Agent",
    resource: "aiAgent",
    summary: "Configuración y ejecución de agentes IA en tu cuenta.",
    readDesc: "Leer agentes IA, sus prompts, herramientas y configuración.",
    writeDesc: "Crear y editar agentes IA, sus prompts, herramientas y triggers.",
  },
  {
    slug: "associations",
    name: "Associations",
    resource: "associations",
    summary: "Relaciones entre contactos, oportunidades y objetos personalizados.",
    readDesc: "Leer asociaciones entre recursos (contact↔opportunity, contact↔company, etc).",
    writeDesc: "Crear y eliminar asociaciones entre recursos.",
  },
  {
    slug: "blogs",
    name: "Blogs",
    resource: "blogs",
    summary: "Posts, categorías y autores del blog de tu cuenta.",
    readDesc: "Leer posts, categorías y autores del blog.",
    writeDesc: "Crear, publicar y editar posts, categorías y autores del blog.",
  },
  {
    slug: "brandboards",
    name: "Brandboards",
    resource: "brandboards",
    summary: "Sistemas de marca de tu cuenta: colores, tipografía, logos.",
    readDesc: "Leer brandboards, tokens de color, tipografía y assets de marca.",
    writeDesc: "Crear y editar brandboards y sus tokens.",
  },
  {
    slug: "business-calendars",
    name: "Business Calendars",
    resource: "calendars",
    summary: "Calendarios, slots, citas y disponibilidad de tu cuenta.",
    readDesc: "Leer calendarios, slots disponibles, citas y configuración de disponibilidad.",
    writeDesc: "Crear y editar calendarios, citas y configuración de disponibilidad.",
  },
  {
    slug: "campaigns",
    name: "Campaigns",
    resource: "campaigns",
    summary: "Campañas de email y SMS, listas de envío y métricas de entrega.",
    readDesc: "Leer campañas de email/SMS, sus envíos y métricas.",
    writeDesc: "Crear, pausar y editar campañas de email/SMS.",
  },
  {
    slug: "chat-widget",
    name: "Chat Widget",
    resource: "chatWidget",
    summary: "El widget de chat embebido en tus sitios y funnels.",
    readDesc: "Leer la configuración, mensajes recibidos y branding del chat widget.",
    writeDesc: "Editar la configuración, branding y comportamiento del chat widget.",
  },
  {
    slug: "companies",
    name: "Companies",
    resource: "companies",
    summary: "Empresas a las que pertenecen tus contactos en tu CRM.",
    readDesc: "Leer empresas, sus contactos asociados y sus campos personalizados.",
    writeDesc: "Crear, actualizar y eliminar empresas en tu CRM.",
  },
  {
    slug: "contacts",
    name: "Contacts",
    resource: "contacts",
    summary: "Leer, crear, actualizar y eliminar contactos en tu cuenta.",
    readDesc: "Leer la lista de contactos y los detalles de cualquier contacto.",
    writeDesc: "Crear, actualizar y eliminar contactos.",
  },
  {
    slug: "conversation-ai",
    name: "Conversation AI",
    resource: "conversationAi",
    summary: "Bots conversacionales y configuración de IA para hilos de mensajes.",
    readDesc: "Leer bots de IA conversacional, sus prompts y reglas de respuesta.",
    writeDesc: "Crear y editar bots conversacionales y sus reglas.",
  },
  {
    slug: "conversations",
    name: "Conversations",
    resource: "conversations",
    summary: "Hilos de mensajes a través de WhatsApp, SMS, email, Instagram y otros canales.",
    readDesc: "Leer conversaciones y mensajes a través de todos los canales conectados.",
    writeDesc: "Enviar mensajes, marcar leídos y mover conversaciones entre carpetas.",
  },
  {
    slug: "courses",
    name: "Courses",
    resource: "courses",
    summary: "Cursos, módulos, lecciones y matriculaciones.",
    readDesc: "Leer cursos, módulos, lecciones y matriculaciones de estudiantes.",
    writeDesc: "Crear cursos, módulos, lecciones y matricular estudiantes.",
  },
  {
    slug: "custom-fields",
    name: "Custom Fields",
    resource: "customFields",
    summary: "Campos personalizados de contactos, oportunidades y otros recursos.",
    readDesc: "Leer la definición de los campos personalizados y sus opciones.",
    writeDesc: "Crear, editar y eliminar campos personalizados.",
  },
  {
    slug: "custom-menus",
    name: "Custom Menus",
    resource: "customMenus",
    summary: "Menús personalizados en la barra lateral del portal.",
    readDesc: "Leer los items del menú personalizado de tu cuenta.",
    writeDesc: "Crear, ordenar y eliminar items del menú personalizado.",
  },
  {
    slug: "email-forms",
    name: "Email Forms",
    resource: "forms",
    summary: "Formularios embebibles y sus envíos.",
    readDesc: "Leer formularios y los envíos que han generado.",
    writeDesc: "Crear y editar formularios; ingestar envíos desde fuentes externas.",
  },
  {
    slug: "funnels",
    name: "Funnels",
    resource: "funnels",
    summary: "Funnels, páginas, secciones y sitios estáticos.",
    readDesc: "Leer la estructura de funnels, páginas y secciones.",
    writeDesc: "Crear y editar funnels, páginas y redirecciones.",
  },
  {
    slug: "invoice",
    name: "Invoice",
    resource: "invoices",
    summary: "Facturas, recibos y envíos a clientes.",
    readDesc: "Leer facturas emitidas, sus líneas y su estado de cobro.",
    writeDesc: "Crear, enviar y marcar como pagadas las facturas a tus clientes.",
  },
  {
    slug: "knowledge-base",
    name: "Knowledge Base",
    resource: "knowledgeBase",
    summary: "Artículos de ayuda agrupados en bases de conocimiento.",
    readDesc: "Leer artículos y categorías de las bases de conocimiento.",
    writeDesc: "Crear, publicar y editar artículos y categorías.",
  },
  {
    slug: "lc-email",
    name: "LC Email",
    resource: "email",
    summary: "Email transaccional y de marketing enviado desde tu cuenta.",
    readDesc: "Leer templates, schedules y estadísticas de email enviado.",
    writeDesc: "Crear y enviar emails transaccionales y de marketing.",
  },
  {
    slug: "media-storage",
    name: "Media Storage",
    resource: "medias",
    summary: "Archivos, imágenes y carpetas del media library.",
    readDesc: "Leer archivos y carpetas del media library.",
    writeDesc: "Subir, mover y eliminar archivos del media library.",
  },
  {
    slug: "objects",
    name: "Objects",
    resource: "objects",
    summary: "Objetos personalizados (custom objects) y sus registros.",
    readDesc: "Leer el esquema de objetos personalizados y los registros que contienen.",
    writeDesc: "Crear y editar el esquema de objetos personalizados, sus campos y registros.",
  },
  {
    slug: "opportunities",
    name: "Opportunities",
    resource: "opportunities",
    summary: "Pipelines, etapas, oportunidades y movimientos entre etapas.",
    readDesc: "Leer pipelines, etapas y oportunidades.",
    writeDesc: "Crear oportunidades y moverlas entre etapas; editar pipelines.",
  },
  {
    slug: "payments",
    name: "Payments",
    resource: "payments",
    summary: "Pagos, órdenes, transacciones y configuración de Stripe.",
    readDesc: "Leer transacciones, órdenes y configuración de la integración de pagos.",
    writeDesc: "Crear órdenes, registrar pagos y modificar la configuración de pagos.",
  },
  {
    slug: "phone-system",
    name: "Phone System",
    resource: "phone",
    summary: "Números, llamadas, mensajería SMS, IVR y grabaciones.",
    readDesc: "Leer números de teléfono, historial de llamadas y configuración de IVR.",
    writeDesc: "Iniciar llamadas salientes, configurar números, editar el IVR.",
  },
  {
    slug: "products",
    name: "Products",
    resource: "products",
    summary: "Catálogo de productos, precios y SKUs de tu cuenta.",
    readDesc: "Leer productos, precios y SKUs.",
    writeDesc: "Crear, editar y eliminar productos y precios.",
  },
  {
    slug: "proposals",
    name: "Proposals",
    resource: "proposals",
    summary: "Propuestas comerciales y firmas electrónicas.",
    readDesc: "Leer propuestas, su estado y firmas.",
    writeDesc: "Crear propuestas, enviarlas y registrar firmas.",
  },
  {
    slug: "social-planner",
    name: "Social Planner",
    resource: "socialPlanner",
    summary: "Posts programados en redes sociales y cuentas conectadas.",
    readDesc: "Leer posts programados, calendarios de redes y cuentas conectadas.",
    writeDesc: "Programar, editar y eliminar posts en redes sociales.",
  },
  {
    slug: "store",
    name: "Store",
    resource: "store",
    summary: "Tu tienda online, órdenes, descuentos y configuración de checkout.",
    readDesc: "Leer órdenes, descuentos y configuración de la tienda online.",
    writeDesc: "Crear y editar órdenes, descuentos y configuración del checkout.",
  },
  {
    slug: "studio",
    name: "Studio",
    resource: "studio",
    summary: "Ediciones de video y audio en Studio.",
    readDesc: "Leer proyectos, recursos y exports de Studio.",
    writeDesc: "Crear y editar proyectos de Studio, subir recursos y exportar.",
  },
  {
    slug: "surveys",
    name: "Surveys",
    resource: "surveys",
    summary: "Encuestas embebibles y sus respuestas.",
    readDesc: "Leer encuestas y las respuestas que han generado.",
    writeDesc: "Crear y editar encuestas; ingestar respuestas desde fuentes externas.",
  },
  {
    slug: "trigger-links",
    name: "Trigger Links",
    resource: "triggerLinks",
    summary: "Links que disparan workflows cuando alguien los abre.",
    readDesc: "Leer los trigger links de tu cuenta y sus métricas de clicks.",
    writeDesc: "Crear y editar trigger links y los workflows que disparan.",
  },
  {
    slug: "users",
    name: "Users",
    resource: "users",
    summary: "Usuarios de tu cuenta, sus roles y permisos.",
    readDesc: "Leer la lista de usuarios y sus permisos.",
    writeDesc: "Invitar, editar y eliminar usuarios de tu cuenta.",
  },
  {
    slug: "voice-ai",
    name: "Voice AI",
    resource: "voiceAi",
    summary: "Agentes de voz IA, llamadas salientes y entrantes automatizadas.",
    readDesc: "Leer agentes de voz, sus prompts y el historial de llamadas que han hecho.",
    writeDesc: "Crear y editar agentes de voz; iniciar llamadas salientes.",
  },
  {
    slug: "workflows",
    name: "Workflows",
    resource: "workflows",
    summary: "Automatizaciones, triggers, acciones y ramas.",
    readDesc: "Leer workflows, sus triggers, acciones y ejecuciones.",
    writeDesc: null, // workflows write is typically restricted; only readonly exposed publicly
  },
];

function buildSeed() {
  const categories = CATEGORIES.map((cat) => {
    const scopes = [
      {
        name: `${cat.resource}.readonly`,
        type: "read",
        description: cat.readDesc,
      },
    ];
    if (cat.writeDesc) {
      scopes.push({
        name: `${cat.resource}.write`,
        type: "write",
        description: cat.writeDesc,
      });
    }
    return {
      name: cat.name,
      summary: cat.summary,
      scopes,
      endpointsHint: `Estos scopes habilitan endpoints relacionados con ${cat.name} bajo \`/${cat.resource}/\`.`,
    };
  });

  return {
    source: "seed (hand-curated; replace with real scrape when Playwright/OpenAPI access is set up)",
    fetchedAt: new Date().toISOString(),
    categories,
  };
}

async function main() {
  await mkdir(dirname(OUT_PATH), { recursive: true });
  const data = buildSeed();
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Wrote ${data.categories.length} categories to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
