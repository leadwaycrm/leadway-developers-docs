import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "scopes.json");
const PAGES_DIR = join(__dirname, "..", "scopes");

function jsonString(s) {
  return JSON.stringify(s);
}

function escapeCell(s) {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderCategory(cat) {
  const lines = [];
  lines.push("---");
  lines.push(`title: ${jsonString(cat.name)}`);
  if (cat.summary) lines.push(`description: ${jsonString(cat.summary)}`);
  lines.push("---");
  lines.push("");
  if (cat.summary) {
    lines.push(cat.summary);
    lines.push("");
  }
  lines.push("## Scopes");
  lines.push("");
  lines.push("| Scope | Type | What it does |");
  lines.push("|-------|------|--------------|");
  for (const s of cat.scopes) {
    lines.push(
      `| \`${escapeCell(s.name)}\` | \`${escapeCell(s.type)}\` | ${escapeCell(s.description)} |`
    );
  }
  lines.push("");
  if (cat.endpointsHint) {
    lines.push("<Note>");
    lines.push(`  ${cat.endpointsHint}`);
    lines.push("</Note>");
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
  await mkdir(PAGES_DIR, { recursive: true });
  let written = 0;
  let skipped = 0;
  for (const cat of data.categories) {
    const target = join(PAGES_DIR, `${cat.slug}.mdx`);
    if (cat.manual === true) {
      console.log(`[skip] ${cat.slug} flagged manual`);
      skipped += 1;
      continue;
    }
    const content = renderCategory(cat);
    await writeFile(target, content, "utf8");
    written += 1;
  }
  console.log(`Wrote ${written} pages, skipped ${skipped} manual.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
