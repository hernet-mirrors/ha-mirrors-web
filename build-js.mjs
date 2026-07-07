/**
 * build-js.mjs
 *
 * Post-Jekyll-build JavaScript obfuscation step.
 * Recursively processes _site/static/js/ all .js files, obfuscating project JS files
 * in-place while leaving vendor .min.js files untouched.
 *
 * Usage (after Jekyll build):
 *   node build-js.mjs
 *
 * Docker / CI: runs automatically after bundle exec jekyll build.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { obfuscate: javascriptObfuscate } = require("javascript-obfuscator");
const JavaScriptObfuscator = { obfuscate: javascriptObfuscate };

const SITE_JS_DIR = "_site/static/js";

// Project JS files to obfuscate (source files under static/js/).
// Vendor/minified files (*.min.js) are excluded to avoid breaking them.
const PROJECT_JS_FILES = new Set([
  "main.js",
  "status.js",
  "index-layout.js",
  "header.js",
  "footer.js",
  "news.js",
  "help-runtime.js",
]);

/**
 * Recursively collect all .js files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectJsFiles(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...collectJsFiles(fullPath));
        } else if (entry.endsWith(".js")) {
          results.push(fullPath);
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Directory does not exist yet
  }
  return results;
}

/**
 * Obfuscate a single JS file in-place.
 * @param {string} filePath
 */
function obfuscateFile(filePath) {
  const fileName = basename(filePath);

  // Always skip vendor/minified files
  if (fileName.endsWith(".min.js")) {
    console.log("  [skip] " + filePath + " (vendor/minified)");
    return;
  }

  // Only obfuscate known project JS files
  if (!PROJECT_JS_FILES.has(fileName)) {
    console.log("  [skip] " + filePath + " (not a project JS file)");
    return;
  }

  try {
    const originalCode = readFileSync(filePath, "utf8");

    // IMPORTANT: simplify:false is MANDATORY. A prior version of
    // javascript-obfuscator with simplify:true + stringArrayEncoding:['base64']
    // caused blank mirror rows in the table (build artifact corruption).
    // The isValidMirror() guard in main.js/status.js catches remaining cases.
    //
    // IMPORTANT: identifiersPrefix is MANDATORY. Each file is obfuscated in a
    // separate pass with renameGlobals:true, so without a per-file prefix the
    // randomly generated global names (string-array decoders etc.) can collide
    // between files loaded on the same page (e.g. main.js + status.js),
    // corrupting string decoding at runtime ("Cannot read properties of
    // undefined (reading 'charAt')"). Whether it triggers is random per build.
    const identifiersPrefix = fileName
      .replace(/\.js$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_");

    const obfuscatedCode = JavaScriptObfuscator.obfuscate(originalCode, {
      simplify: false,
      identifiersPrefix,

      compact: true,
      identifierNamesGenerator: "hexadecimal",
      renameGlobals: true,
      stringArray: true,
      stringArrayEncoding: ["base64"],
      stringArrayThreshold: 0.75,
      shuffleArrayIndexes: true,
      transformObjectKeys: true,
      reservedNames: [],
      controlFlowFlattening: false,
    }).getObfuscatedCode();

    writeFileSync(filePath, obfuscatedCode, "utf8");
    console.log("  [obfuscated] " + filePath);
  } catch (err) {
    console.error("  [ERROR] " + filePath + ": " + err.message);
    process.exitCode = 1;
  }
}

// Main
const files = collectJsFiles(SITE_JS_DIR);

if (files.length === 0) {
  console.log(
    "[build-js] No .js files found under _site/static/js/ — nothing to do."
  );
  process.exit(0);
}

console.log(
  "[build-js] Found " + files.length + " file(s). Obfuscating project JS...\n"
);

for (const file of files) {
  obfuscateFile(file);
}

console.log("\n[build-js] Done.");
