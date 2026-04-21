// scripts/fetch-runtime.mjs
//
// Copy client-side runtime assets (Hogan.js + highlight.js) from
// node_modules into static/js/ so help pages can use them without
// a bundler.
//
// Run after `npm install`:  node scripts/fetch-runtime.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dst = path.join(root, "static", "js");

const pairs = [
  ["node_modules/hogan.js/web/1.0.5/hogan-3.0.2.min.js", "hogan.min.js"],
  ["node_modules/highlight.js/lib/index.js",              null], // skipped – see note
];

// Note: highlight.js ships a browser bundle via the 'highlight.js/lib/common'
// path but not as a single pre-minified file across versions. Use CDN
// or copy manually for the browser build.

fs.mkdirSync(dst, { recursive: true });
pairs.forEach(([src, outName]) => {
  if (!outName) return;
  const srcPath = path.join(root, src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`skip: ${src} not found; run \`npm install\` first`);
    return;
  }
  fs.copyFileSync(srcPath, path.join(dst, outName));
  console.log(`copied ${src} -> static/js/${outName}`);
});

console.log(`\nHighlight.js browser build is not shipped via npm; download manually:`);
console.log(`  curl -o static/js/highlight.min.js https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js`);
