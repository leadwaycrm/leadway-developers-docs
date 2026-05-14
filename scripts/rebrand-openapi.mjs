/**
 * Rebrand the GHL OpenAPI specs under `api-reference/raw/` into Leadway-flavored
 * specs at `api-reference/<slug>.json`.
 *
 * Source: https://github.com/GoHighLevel/highlevel-api-docs (CC0 license).
 * Cookbook:
 *   - "HighLevel" / "GoHighLevel" / "highlevel" → "Leadway"
 *   - "sub-account" / "sub_account" / "subaccount" → "account"
 *   - "Sub-Account" → "Account"
 *   - prose "your location" → "your account"
 *   - prose "location" (when not part of `locationId`) → "account"
 *   - Strip externalDocs entries pointing at gohighlevel.com / highlevel.stoplight.io
 *     / doc.clickup.com / similar internal GHL doc hosts.
 *
 * The cookbook walks every string VALUE in the JSON. It never touches keys,
 * so wire-level identifiers like `locationId` stay intact.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dirname, "..", "api-reference", "raw");
const OUT_DIR = join(__dirname, "..", "api-reference");

const PROSE_REPLACEMENTS = [
  // Strip inline markdown links to GHL doc hosts: "[label](https://...)" → "label"
  [
    /\[([^\]]+)\]\(https?:\/\/(?:marketplace\.gohighlevel|highlevel\.stoplight|doc\.clickup|app\.clickup|gohighlevel|highlevel)\.[^)]*\)/g,
    "$1",
  ],
  // Strip inline HTML anchors to GHL doc hosts: '<a href="https://...">label</a>' → "label"
  [
    /<a[^>]+href=["']https?:\/\/(?:marketplace\.gohighlevel|highlevel\.stoplight|doc\.clickup|app\.clickup|gohighlevel|highlevel)[^"']*["'][^>]*>([^<]+)<\/a>/gi,
    "$1",
  ],
  // Domain swaps (do these BEFORE the brand-word swaps so we don't end up
  // with "leadway.com" which is wrong; the real Leadway domain is leadwaycrm.com).
  [/\b(?:app|staging|admin|portal|dashboard)\.gohighlevel\.com\b/gi, "app.leadwaycrm.com"],
  [/\bhighlevel-staging\b/gi, "leadway-staging"],
  [/\bgohighlevel\.com\b/gi, "leadwaycrm.com"],
  [/\bhighlevel\.com\b/gi, "leadwaycrm.com"],
  // Brand swap — case-insensitive, preserve initial capitalization. "Go" prefix
  // is optional as a unit (not just the 'o'), so "HighLevel" alone matches too.
  [
    /\b(?:Go)?HighLevel\b/gi,
    (m) => (m[0] === m[0].toUpperCase() ? "Leadway" : "leadway"),
  ],
  // Sub-account variants in any case + separator (-, _, none, camelCase).
  // The lookbehind `(?<![a-z])` allows matching "restrictSubAccount" while
  // still requiring a non-letter-or-start boundary on the left.
  [
    /(?<![a-zA-Z])Sub[-_]?accounts?\b/gi,
    (m) => {
      const isPlural = m.toLowerCase().endsWith("s");
      const isUpper = m[0] === m[0].toUpperCase();
      return (isUpper ? "Account" : "account") + (isPlural ? "s" : "");
    },
  ],
  // your location -> your account (case preserving)
  [
    /\byour locations?\b/gi,
    (m) => {
      const head = m.startsWith("Y") ? "Your" : "your";
      const tail = m.toLowerCase().endsWith("s") ? "s" : "";
      return head + " account" + tail;
    },
  ],
  // Bare "location"/"Location" in prose. Lookahead protects `locationId`,
  // `locationIds`, `locations/` (scope paths like `locations/customValues.write`).
  [/\bLocation\b(?![Ii]d|s\/)/g, "Account"],
  [/\blocation\b(?![Ii]d|s\/)/g, "account"],
  [/\bLocations\b(?!\/)/g, "Accounts"],
  [/\blocations\b(?!\/)/g, "accounts"],
];

const EXTERNAL_DOC_HOST_BLOCKLIST = [
  "gohighlevel.com",
  "highlevel.com",
  "highlevel.stoplight.io",
  "doc.clickup.com",
  "app.clickup.com",
  "marketplace.gohighlevel.com",
];

export function applyCookbookToString(s) {
  if (typeof s !== "string") return s;
  let out = s;
  for (const [pattern, replacement] of PROSE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function shouldStripExternalDoc(url) {
  if (typeof url !== "string") return false;
  return EXTERNAL_DOC_HOST_BLOCKLIST.some((host) => url.includes(host));
}

/**
 * Deep-walk a JSON value. Apply cookbook to string LEAVES.
 * If a node is `{ url, description }` shape inside an `externalDocs` field,
 * and the url matches the blocklist, return `undefined` (caller removes it).
 */
function transform(node, parentKey = null) {
  if (node === null || node === undefined) return node;
  if (typeof node === "string") return applyCookbookToString(node);
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) {
    return node.map((item) => transform(item, parentKey));
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "externalDocs" && v && typeof v === "object" && shouldStripExternalDoc(v.url)) {
      // strip the externalDocs entirely
      continue;
    }
    out[k] = transform(v, k);
  }
  return out;
}

async function processFile(slug) {
  const inPath = join(RAW_DIR, `${slug}.json`);
  const outPath = join(OUT_DIR, `${slug}.json`);
  const raw = JSON.parse(await readFile(inPath, "utf8"));
  const rebranded = transform(raw);
  // Ensure title carries Leadway brand. Many GHL files don't have info.title,
  // or have generic titles like "Contacts" — augment for clarity.
  if (rebranded.info) {
    const cat = slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    rebranded.info.title = `Leadway API · ${cat}`;
    if (!rebranded.info.version) rebranded.info.version = "2021-07-28";
  } else {
    rebranded.info = {
      title: `Leadway API · ${slug}`,
      version: "2021-07-28",
    };
  }
  await writeFile(outPath, JSON.stringify(rebranded, null, 2) + "\n", "utf8");
  const endpointCount = countOperations(rebranded);
  return { slug, endpointCount };
}

function countOperations(spec) {
  if (!spec.paths) return 0;
  let n = 0;
  for (const pathItem of Object.values(spec.paths)) {
    for (const method of Object.keys(pathItem)) {
      if (["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
        n += 1;
      }
    }
  }
  return n;
}

async function main() {
  const entries = (await readdir(RAW_DIR)).filter((f) => f.endsWith(".json"));
  const results = [];
  for (const entry of entries) {
    const slug = entry.replace(/\.json$/, "");
    results.push(await processFile(slug));
  }
  const total = results.reduce((s, r) => s + r.endpointCount, 0);
  console.log(`Processed ${results.length} specs, ${total} total operations:`);
  for (const r of results.sort((a, b) => b.endpointCount - a.endpointCount)) {
    console.log(`  ${String(r.endpointCount).padStart(3, " ")}  ${r.slug}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
