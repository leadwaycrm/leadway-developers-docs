/**
 * Merge the 35 per-category rebranded OpenAPI specs into a single
 * `api-reference/openapi.json` that Mintlify can consume at the tab level.
 *
 * Mintlify's docs.json only accepts `"openapi"` at the tab or anchor level
 * (not inside groups), so the per-group approach fails with
 * "Failed to fetch OpenAPI file for anchor or tab". The workaround is one
 * mega-spec where each operation is tagged by its category, and Mintlify
 * auto-organizes the sidebar by tag.
 *
 * Strategy:
 *   - For each input spec, replace every operation's `tags` with a single tag:
 *     the category display name (e.g. "Contacts", "Conversations").
 *   - Prefix component schema names + parameter refs with the category to
 *     avoid collisions when two specs define a "ResponseDto".
 *   - Merge paths. If two specs share a path (unlikely), the later one wins.
 *   - Build a unified `tags` array in the requested display order.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_DIR = join(__dirname, "..", "api-reference");
const OUT_PATH = join(IN_DIR, "openapi.json");

// Map slug → display name (controls sidebar group title in Mintlify).
const CATEGORY_NAMES = {
  "ad-manager": "Ad Manager",
  "affiliate-manager": "Affiliate Manager",
  "ai-agent": "AI Agent",
  "associations": "Associations",
  "blogs": "Blogs",
  "brandboards": "Brandboards",
  "business-calendars": "Business Calendars",
  "campaigns": "Campaigns",
  "companies": "Companies",
  "contacts": "Contacts",
  "conversation-ai": "Conversation AI",
  "conversations": "Conversations",
  "courses": "Courses",
  "custom-fields": "Custom Fields",
  "custom-menus": "Custom Menus",
  "email-forms": "Email Forms",
  "funnels": "Funnels",
  "invoice": "Invoice",
  "knowledge-base": "Knowledge Base",
  "lc-email": "LC Email",
  "media-storage": "Media Storage",
  "objects": "Objects",
  "opportunities": "Opportunities",
  "payments": "Payments",
  "phone-system": "Phone System",
  "products": "Products",
  "proposals": "Proposals",
  "social-planner": "Social Planner",
  "store": "Store",
  "studio": "Studio",
  "surveys": "Surveys",
  "trigger-links": "Trigger Links",
  "users": "Users",
  "voice-ai": "Voice AI",
  "workflows": "Workflows",
};

// Alphabetical order for sidebar.
const ORDER = Object.keys(CATEGORY_NAMES).sort();

function prefixSchemaName(slug, name) {
  // Slugify-ish prefix to keep schema refs valid OpenAPI identifiers.
  const prefix = slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return `${prefix}_${name}`;
}

function rewriteRefs(node, slug, schemaNames) {
  if (node === null || node === undefined) return node;
  if (typeof node === "string") {
    // OpenAPI refs look like "#/components/schemas/SomeName"
    const m = node.match(/^#\/components\/schemas\/(.+)$/);
    if (m && schemaNames.has(m[1])) {
      return `#/components/schemas/${prefixSchemaName(slug, m[1])}`;
    }
    return node;
  }
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((v) => rewriteRefs(v, slug, schemaNames));
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$ref" && typeof v === "string") {
      out[k] = rewriteRefs(v, slug, schemaNames);
    } else {
      out[k] = rewriteRefs(v, slug, schemaNames);
    }
  }
  return out;
}

async function loadCommonSchemas() {
  const commonPath = join(IN_DIR, "raw", "common-schemas.json");
  try {
    const data = JSON.parse(await readFile(commonPath, "utf8"));
    return data.components?.schemas ?? {};
  } catch (e) {
    console.warn(`[warn] common schemas not loaded: ${e.message}`);
    return {};
  }
}

async function main() {
  // Pull in cross-spec shared schemas (BadRequestDTO, UnauthorizedDTO, etc).
  // These are referenced by multiple specs without being defined locally.
  const commonSchemas = await loadCommonSchemas();
  console.log(`Loaded ${Object.keys(commonSchemas).length} common schemas.`);

  const merged = {
    openapi: "3.0.0",
    info: {
      title: "Leadway API",
      description:
        "Referencia completa de la API REST de Leadway. Todos los endpoints están agrupados por categoría en el sidebar.",
      version: "2021-07-28",
    },
    servers: [{ url: "https://services.leadconnectorhq.com" }],
    tags: ORDER.map((slug) => ({
      name: CATEGORY_NAMES[slug],
      description: `Endpoints para ${CATEGORY_NAMES[slug]}.`,
    })),
    paths: {},
    components: { schemas: { ...commonSchemas }, securitySchemes: {} },
  };

  let totalOps = 0;
  let totalSchemas = 0;
  let collisions = 0;

  for (const slug of ORDER) {
    const inPath = join(IN_DIR, `${slug}.json`);
    let spec;
    try {
      spec = JSON.parse(await readFile(inPath, "utf8"));
    } catch (e) {
      console.warn(`[skip] ${slug}: ${e.message}`);
      continue;
    }
    const categoryName = CATEGORY_NAMES[slug];

    // Build set of this spec's schema names so we know which $refs to rewrite.
    const schemaNames = new Set(Object.keys(spec.components?.schemas ?? {}));

    // Rewrite all $refs in the spec to use prefixed names.
    const rewritten = rewriteRefs(spec, slug, schemaNames);

    // Merge schemas (with prefix to avoid collisions).
    for (const [name, schema] of Object.entries(rewritten.components?.schemas ?? {})) {
      const newName = prefixSchemaName(slug, name);
      if (merged.components.schemas[newName]) {
        collisions += 1;
      }
      merged.components.schemas[newName] = schema;
      totalSchemas += 1;
    }

    // Merge security schemes (these are usually shared / safe to overwrite).
    for (const [name, scheme] of Object.entries(rewritten.components?.securitySchemes ?? {})) {
      merged.components.securitySchemes[name] = scheme;
    }

    // Merge paths. Re-tag every operation with the category.
    for (const [pathStr, pathItem] of Object.entries(rewritten.paths ?? {})) {
      const cleaned = {};
      for (const [method, op] of Object.entries(pathItem)) {
        if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
          cleaned[method] = op;
          continue;
        }
        cleaned[method] = {
          ...op,
          tags: [categoryName],
          // Prefix operationId too to keep them unique across the merged spec.
          operationId: op.operationId ? `${slug}_${op.operationId}` : undefined,
        };
        totalOps += 1;
      }
      if (merged.paths[pathStr]) {
        // path collision: merge methods rather than overwrite
        merged.paths[pathStr] = { ...merged.paths[pathStr], ...cleaned };
      } else {
        merged.paths[pathStr] = cleaned;
      }
    }
  }

  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(
    `Merged: ${ORDER.length} specs → ${totalOps} operations, ${totalSchemas} schemas, ${collisions} schema-name collisions resolved by prefixing.`
  );
  console.log(`Output: ${OUT_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
