import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { globSync } from "node:fs";

const root = process.cwd();
const files = [
  ...globSync("src/**/*.{ts,tsx,js,jsx,mjs}", {
    cwd: root,
    exclude: ["node_modules/**", ".next/**", "src/lib/public-url.ts"],
  }),
  ...globSync("middleware.ts", { cwd: root }),
];

const checks = [
  {
    name: "redirect built from request.url",
    pattern: /NextResponse\.redirect\(\s*new URL\([\s\S]{0,160}request\.url[\s\S]{0,80}\)\s*\)/g,
  },
  {
    name: "URL built from request.url",
    pattern: /new URL\([^\n]{0,160}request\.url/g,
  },
  {
    name: "URL built from req.url",
    pattern: /new URL\([^\n]{0,160}req\.url/g,
  },
  {
    name: "public link built from host header",
    pattern: /headers\(\)\.get\(["']host["']\)|\.headers\.get\(["']host["']\)|x-forwarded-host|x-forwarded-proto|\.headers\.get\(["']forwarded["']\)/g,
  },
  {
    name: "hardcoded internal bind host",
    pattern: /https?:\/\/0\.0\.0\.0(?::\d+)?/g,
  },
  {
    name: "hardcoded localhost URL",
    pattern: /https?:\/\/localhost(?::\d+)?/g,
  },
];

const failures = [];
for (const file of files) {
  const fullPath = join(root, file);
  const text = readFileSync(fullPath, "utf8");
  const lines = text.split(/\r?\n/);
  for (const check of checks) {
    for (const match of text.matchAll(check.pattern)) {
      const index = match.index ?? 0;
      const line = text.slice(0, index).split(/\r?\n/).length;
      const snippet = lines[line - 1]?.trim() ?? "";
      failures.push(`${relative(root, fullPath)}:${line} ${check.name}: ${snippet}`);
    }
  }
}

if (failures.length) {
  console.error("Public URL safety check failed. Use src/lib/public-url.ts for browser-visible links/redirects.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public URL safety check passed.");
