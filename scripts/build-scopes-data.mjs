import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_PATH = join(__dirname, "..", "data", "scopes.raw.json");
const OUT_PATH = join(__dirname, "..", "data", "scopes.json");

const REPLACEMENTS = [
  // Order matters: most specific first.
  [
    /\bsub-accounts?\b/gi,
    (m) => (m[0] === "S" ? "Account" : "account") + (m.endsWith("s") ? "s" : ""),
  ],
  [
    /\byour locations?\b/gi,
    (m) =>
      (m.startsWith("Your") ? "Your" : "your") +
      " account" +
      (m.endsWith("s") ? "s" : ""),
  ],
  [
    /\blocations?\b(?!Id)/gi,
    (m) => (m[0] === "L" ? "Account" : "account") + (m.endsWith("s") ? "s" : ""),
  ],
  [/\bGoHighLevel\b/g, "Leadway"],
  [/\bHighLevel\b/g, "Leadway"],
];

export function applyCookbook(text) {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// Agency-level scopes excluded from client docs. `companies.*` is kept because
// Pablo's category list documents Companies as a B2B CRM resource, not the
// agency-level Company entity. Only `oauth.*` is unambiguously agency-only.
const AGENCY_ONLY_PREFIXES = ["oauth."];

export function isAgencyOnlyScope(scope) {
  return AGENCY_ONLY_PREFIXES.some((p) => scope.name.startsWith(p));
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferType(name) {
  if (name.endsWith(".readonly")) return "read";
  if (name.endsWith(".write")) return "write";
  return "admin";
}

async function main() {
  const raw = JSON.parse(await readFile(RAW_PATH, "utf8"));
  const out = { categories: [] };

  for (const cat of raw.categories) {
    const filteredScopes = (cat.scopes ?? [])
      .filter((s) => !isAgencyOnlyScope(s))
      .map((s) => ({
        name: s.name,
        type: s.type ?? inferType(s.name),
        description: applyCookbook(s.description ?? ""),
      }));

    if (filteredScopes.length === 0) continue;

    out.categories.push({
      slug: slugify(cat.name),
      name: cat.name,
      summary: applyCookbook(cat.summary ?? ""),
      scopes: filteredScopes,
      endpointsHint: cat.endpointsHint ? applyCookbook(cat.endpointsHint) : undefined,
    });
  }

  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote ${out.categories.length} categories to ${OUT_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
