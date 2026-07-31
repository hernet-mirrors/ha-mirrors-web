// Build Jekyll help posts from mirrorz-docs style MyST markdown.
// Port of tuna/mirror-web/_helpz/generate.mjs, but with React-free
// string templates (see ./templates.mjs).
//
// Invoked by _plugins/helpz.rb during Jekyll build. Writes one .md
// file per enabled page into the output directory; each file has
// frontmatter { zconf, templates } and HTML-ready body.
//
// Required Node modules (install in project root via npm):
//   yaml, markdown-it, markdown-it-myst, myst-parser,
//   mdast-util-to-markdown, unist-util-visit, vfile, hogan.js,
//   highlight.js

import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as yamlParse } from "yaml";
import MarkdownIt from "markdown-it";
import mystPlugin from "markdown-it-myst";
import { tokensToMyst } from "myst-parser";
import { toMarkdown } from "mdast-util-to-markdown";
import * as visitor from "unist-util-visit";
import { VFile } from "vfile";
import Hogan from "hogan.js";
import hljs from "highlight.js";

import { flattenData } from "./flattenData.mjs";
import { renderZForm, renderCodeBlock } from "./templates.mjs";

const options = parseArgs({
  options: {
    "enabled-pages": { type: "string" },
    language:        { type: "string" },
    "output-dir":    { type: "string", default: "./generated" },
    "site-config":   { type: "string", default: "{}" },
  },
}).values;

if (!options["enabled-pages"]) exit("--enabled-pages is required");
if (!options.language)         exit("--language is required");

function exit(msg) {
  console.error(msg);
  process.exit(1);
}

const enablePages = yamlParse(fs.readFileSync(options["enabled-pages"], "utf-8"));
if (!Array.isArray(enablePages)) exit("enabled-pages should be a YAML list");

const outputDir = options["output-dir"];
fs.mkdirSync(outputDir, { recursive: true });
for (const e of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (e.isDirectory()) exit(`output dir ${outputDir} contains subdir ${e.name}; clear it first`);
  fs.rmSync(path.join(outputDir, e.name));
}

const docsDir  = path.dirname(fileURLToPath(import.meta.url));
const language = options.language;
const siteConfig = JSON.parse(options["site-config"]);

// --- File discovery: local/<page>/ overrides global/<page>/ ---
const pagePaths = (page, file) => ({
  local:  path.join(docsDir, "local",  page, file),
  global: path.join(docsDir, "global", page, file),
});

function loadFile(page, file, defaultValue) {
  const { local, global } = pagePaths(page, file);
  if (fs.existsSync(local))  return { path: local,  content: fs.readFileSync(local,  "utf-8") };
  if (fs.existsSync(global)) return { path: global, content: fs.readFileSync(global, "utf-8") };
  if (defaultValue !== undefined) {
    console.warn(`helpz: ${page}/${file} not found, using default`);
    return { path: null, content: defaultValue };
  }
  exit(`helpz: ${page}/${file} not found`);
}

function loadConf(page, lang) {
  const { local, global } = pagePaths(page, `${lang}.yaml`);
  if (!fs.existsSync(local) && !fs.existsSync(global)) exit(`helpz: ${page}/${lang}.yaml not found`);
  const localConf  = fs.existsSync(local)  ? yamlParse(fs.readFileSync(local,  "utf-8")) : {};
  const globalConf = fs.existsSync(global) ? yamlParse(fs.readFileSync(global, "utf-8")) : {};
  const inputs = { ...(globalConf.input || {}) };
  for (const [k, v] of Object.entries(localConf.input || {})) inputs[k] = v;
  for (const k of Object.keys(inputs)) if (inputs[k] === null) delete inputs[k];
  return { ...globalConf, ...localConf, input: inputs, name: page };
}

const loadBlock = (page, block, lang) => loadFile(page, `${block}.${lang}.md`, "");

// --- Input defaults → variable values ---
function defaultInput(inputDesc) {
  if (inputDesc.option) {
    const entry =
      Object.entries(inputDesc.option).find(([, v]) => v?.default) ||
      Object.entries(inputDesc.option)[0];
    const value = {};
    Object.entries(entry[1] || {}).forEach(([k, v]) => {
      if (k !== "default" && k !== "_") value[k] = v;
    });
    return [entry[0], value];
  } else if (inputDesc.true !== undefined || inputDesc.false !== undefined) {
    if (inputDesc.default) {
      return inputDesc.true !== undefined && inputDesc.true !== null ? inputDesc.true : true;
    }
    return inputDesc.false !== undefined && inputDesc.false !== null ? inputDesc.false : false;
  }
  return inputDesc.default || "";
}

function getRenderContext(globalVars, zconf, inputVars) {
  const globalValues = {};
  Object.entries(globalVars).forEach(([k, v]) => { globalValues[k] = defaultInput(v); });
  const data = flattenData(globalValues);
  data.endpoint = data.urlpath;
  try {
    const url = new URL(data.urlpath);
    data.host = url.host;
    data.path = url.pathname;
  } catch { /* urlpath not a URL yet */ }
  if (inputVars) {
    const localValues = {};
    inputVars.split(" ").forEach((name) => {
      const desc = zconf.input[name];
      if (desc) localValues[name] = defaultInput(desc);
    });
    Object.entries(flattenData(localValues)).forEach(([k, v]) => { data[k] = v; });
  }
  return data;
}

function highlightCode(code, lang) {
  if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
  if (!lang) return hljs.highlightAuto(code).value;
  return hljs.highlight(code, { language: "plaintext" }).value;
}

function renderTemplate(tmpl, globalVars, zconf, inputVars, lang) {
  const ctx = getRenderContext(globalVars, zconf, inputVars);
  const compiled = Hogan.compile(tmpl, { asString: true });
  const rendered = Hogan.compile(tmpl).render(ctx).replace(/^[ \t]*\n?/, "");
  return { compiled, rendered: highlightCode(rendered, lang) };
}

function genGlobalVars(site, zconf) {
  const gitMirrors = site.helpz?.git_mirrors;
  if (!Array.isArray(gitMirrors)) {
    exit("helpz.git_mirrors should be a YAML list in _config.yml");
  }
  const p = gitMirrors.includes(zconf.name) ? `git/${zconf.name}` : zconf.name;
  return {
    scheme: { _: "是否使用 HTTPS", true: "https", false: "http", default: true },
    sudo:   { _: "是否使用 sudo",  true: "sudo ", false: "" },
    ipv6: {
      _: "线路选择",
      default: "auto",
      option: {
        auto: { _: "自动",  urlpath: `${site.url   || ""}/${p}` },
        ipv4: { _: "IPv4",  urlpath: `${site.urlv4 || ""}/${p}` },
        ipv6: { _: "IPv6",  urlpath: `${site.urlv6 || ""}/${p}` },
      },
    },
  };
}

const customIdRegex = / {#(?<id>.+)}$/;

for (const page of enablePages) {
  const conf = loadConf(page, language);
  const mdContent = [];
  const templates = [];
  let templateIndex = 0;
  const globalVars = genGlobalVars(siteConfig, conf);
  let inputCounter = 0;

  mdContent.push(`{% raw %}`);
  mdContent.push(`# ${conf["_"]}\n`);
  mdContent.push(renderZForm(-1, Object.keys(globalVars), globalVars, () => inputCounter++) + "\n");

  const blocks = conf.block || ["index"];
  for (const block of blocks) {
    const { content: blockContent, path: blockPath } = loadBlock(page, block, language);

    const tokenizer = new MarkdownIt("commonmark");
    tokenizer.use(mystPlugin);
    const mdast = tokensToMyst(
      blockContent,
      tokenizer.parse(blockContent, { vfile: new VFile({ path: blockPath }) }),
    );

    visitor.visit(
      mdast,
      ["mystRole", "mystDirective", "mystDirectiveError", "mystRoleError"],
      (node, index, parent) => {
        if (node.type === "mystDirectiveError" || node.type === "mystRoleError") {
          exit(`helpz: parse error on ${page}/${block}: ${node.message} @ ${node.position?.start?.line}:${node.position?.start?.column}`);
        }
        if (node.name !== "ztmpl") {
          exit(`helpz: unsupported directive/role '${node.name}' on ${page}/${block}`);
        }

        if (node.type === "mystRole") {
          const roleOpts = {};
          node.children.forEach((c) => {
            if (c.type === "mystOption") roleOpts[c.name] = c.value;
          });
          const tpl = node.value || "";
          const isPure = tpl.indexOf("{{") === -1;
          const { compiled, rendered } = renderTemplate(tpl, globalVars, conf, "", roleOpts.lang);
          const tid = isPure ? null : templateIndex++;
          if (!isPure) templates.push(compiled);

          const children = [];
          children.push({
            type: "html",
            value: "<code"
              + (tid !== null ? ` data-z-code="${tid}"` : "")
              + (roleOpts.lang ? ` data-z-lang="${roleOpts.lang}"` : "")
              + ">",
          });
          rendered.split(/(<[^>]*>)/).forEach((part) => {
            if (part) children.push({ type: part.startsWith("<") ? "html" : "text", value: part });
          });
          children.push({ type: "html", value: "</code>" });
          parent.children.splice(index, 1, ...children);
          return [visitor.SKIP, index + children.length];
        }

        // mystDirective
        const dOpts = node.options || {};
        const tpl = node.value || "";
        let html = "";

        if (dOpts.global) {
          if (!dOpts.input) exit(`helpz: global directive missing input on ${page}/${block}`);
          html = renderZForm(-1, dOpts.input.split(" "), conf.input, () => inputCounter++);
          dOpts.input.split(" ").forEach((name) => { globalVars[name] = conf.input[name]; });
        } else if (!dOpts.input && tpl.indexOf("{{") === -1) {
          node.type = "code";
          node.value = tpl;
          node.lang = dOpts.lang || "";
          return visitor.SKIP;
        } else {
          const tid = templateIndex++;
          const { compiled, rendered } = renderTemplate(tpl, globalVars, conf, dOpts.input, dOpts.lang);
          templates.push(compiled);
          if (dOpts.input) {
            html = renderZForm(tid, dOpts.input.split(" "), conf.input, () => inputCounter++) + "\n";
          }
          html += renderCodeBlock(null, rendered, {
            "data-z-code": String(tid),
            ...(dOpts.lang ? { "data-z-lang": dOpts.lang } : {}),
          });
        }

        node.type = "html";
        node.value = html;
        node.position = null;
        node.children = [];
        return visitor.SKIP;
      },
    );

    visitor.visit(mdast, "code", (node) => {
      const highlighted = highlightCode(node.value, node.lang);
      node.type = "html";
      node.value = renderCodeBlock(node.value, highlighted, {});
      delete node.lang;
      node.children = [];
      node.position = null;
      return visitor.SKIP;
    });

    visitor.visit(mdast, "heading", (node) => {
      const last = node.children[node.children.length - 1];
      if (last && last.type === "text") {
        const m = customIdRegex.exec(last.value);
        if (m) last.value = last.value.replace(customIdRegex, "");
        // Custom ids could be wired to anchors in a future pass.
      }
    });

    mdContent.push(toMarkdown(mdast));
  }

  mdContent.push("{% endraw %}");
  // Pin the URL to the original-case page name so help links from the
  // mirror list (which uses the tunasync-reported name verbatim) match
  // the generated page URL. Without this, Jekyll's permalink `:name`
  // token lowercases — e.g. AOSP.md -> /help/aosp/.
  mdContent.unshift(
    `---\n${JSON.stringify(
      { zconf: conf, templates, permalink: `/help/${conf.name}/` },
      null,
      2
    )}\n---`
  );

  fs.writeFileSync(path.join(outputDir, `${page}.md`), mdContent.join("\n"), "utf-8");
  console.log(`helpz: generated ${page}.md`);
}
