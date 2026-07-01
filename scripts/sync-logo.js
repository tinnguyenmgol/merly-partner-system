/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const source = path.join(root, "logo", "merly-logo.png");
const targetDir = path.join(root, "public", "logo");
const target = path.join(targetDir, "merly-logo.png");

fs.mkdirSync(targetDir, { recursive: true });

if (!fs.existsSync(source)) {
  console.warn("[sync-logo] Warning: logo/merly-logo.png not found. UI will fall back to text branding.");
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log("[sync-logo] Copied logo/merly-logo.png to public/logo/merly-logo.png");
