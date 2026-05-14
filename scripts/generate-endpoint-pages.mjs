/**
 * Generate one MDX file per OpenAPI operation. Each MDX has frontmatter
 * `openapi: 'METHOD /path'` and Mintlify renders the page automatically
 * from the merged openapi.json (referenced at top level under `api.openapi`).
 *
 * Output: `api-reference/<category-slug>/<operation-slug>.mdx`
 *
 * This is Plan B if Mintlify's "openapi at tab level" fails to fetch.
 * The MDX-stub approach is the documented Mintlify pattern and is well-supported.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(__dirname, "..", "openapi.json");
const OUT_DIR = join(__dirname, "..", "api-reference");

function slugifyOp(op, method, path) {
  // Prefer operationId. Fall back to method+path.
  if (op.operationId) {
    return op.operationId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  return (method + "-" + path).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categorySlugFromTag(tag) {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeFrontmatter(s) {
  // Single-quote frontmatter values; escape single quotes inside.
  return s.replace(/'/g, "''");
}

async function main() {
  const spec = JSON.parse(await readFile(SPEC_PATH, "utf8"));
  const grouped = new Map(); // categorySlug -> [{ slug, title, opLine }]

  for (const [pathStr, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const tag = (op.tags && op.tags[0]) || "Misc";
      const catSlug = categorySlugFromTag(tag);
      const opSlug = slugifyOp(op, method, pathStr);
      const title = op.summary || op.operationId || `${method.toUpperCase()} ${pathStr}`;
      if (!grouped.has(catSlug)) grouped.set(catSlug, []);
      grouped.get(catSlug).push({
        slug: opSlug,
        title,
        opLine: `${method.toUpperCase()} ${pathStr}`,
      });
    }
  }

  // Write MDX files
  let totalFiles = 0;
  for (const [catSlug, ops] of grouped.entries()) {
    const catDir = join(OUT_DIR, catSlug);
    await mkdir(catDir, { recursive: true });
    for (const op of ops) {
      const mdx = `---
title: '${escapeFrontmatter(op.title)}'
openapi: '${op.opLine}'
---
`;
      await writeFile(join(catDir, `${op.slug}.mdx`), mdx, "utf8");
      totalFiles += 1;
    }
  }

  // Emit a navigation summary so the controller can plug it into docs.json.
  const navSummary = {};
  for (const [catSlug, ops] of grouped.entries()) {
    navSummary[catSlug] = ops.map((o) => `api-reference/${catSlug}/${o.slug}`);
  }
  await writeFile(
    join(__dirname, "..", "endpoint-pages-index.json"),
    JSON.stringify(navSummary, null, 2) + "\n",
    "utf8"
  );

  console.log(`Wrote ${totalFiles} MDX endpoint pages across ${grouped.size} categories.`);
  console.log("Nav summary written to endpoint-pages-index.json");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
