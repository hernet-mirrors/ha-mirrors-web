// Client for mirrorz-docs style help pages (ref: tuna/mirror-web help.ts).

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") { fn(); return; }
    document.addEventListener("DOMContentLoaded", fn);
  }

  function flattenData(data) {
    var out = {};
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      out[k] = Array.isArray(v) ? v[0] : v;
    });
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (Array.isArray(v) && v[1]) {
        Object.keys(v[1]).forEach(function (kk) { out[kk] = v[1][kk]; });
      }
    });
    return out;
  }

  function elementValue(elem) {
    if (elem instanceof HTMLInputElement) {
      if (elem.type === "checkbox") {
        if (elem.checked) {
          return elem.hasAttribute("data-z-true") ? elem.getAttribute("data-z-true") : true;
        }
        return elem.hasAttribute("data-z-false") ? elem.getAttribute("data-z-false") : false;
      }
      return elem.value;
    }
    if (elem instanceof HTMLSelectElement) {
      var opt = elem.options[elem.selectedIndex];
      var extra = {};
      Array.prototype.forEach.call(opt.attributes, function (attr) {
        if (attr.name.indexOf("data-z-set-") === 0) {
          extra[attr.name.slice("data-z-set-".length)] = attr.value;
        }
      });
      return [opt.value, extra];
    }
    return null;
  }

  function initMobileNav() {
    var sel = document.getElementById("help-select");
    if (!sel) return;
    sel.addEventListener("change", function () {
      var opt = sel.options[sel.selectedIndex];
      var url = opt && opt.getAttribute("data-help-url");
      if (url) window.location.assign(url);
    });
  }

  var MIRRORZ_HELP_FALLBACK = (window.jekyllHelp && window.jekyllHelp.mirrorzHelpLink) ||
                              "https://help.mirrors.cernet.edu.cn/";

  function extractMirrorId(el) {
    var id = el.id || "";
    if (id.indexOf("toc-m-") === 0) return id.slice(6);
    if (id.indexOf("toc-")   === 0) return id.slice(4);
    return null;
  }

  function currentMirrorId() {
    var store = document.getElementById("zhelp-tmpls");
    return store && store["zhelp-name"];
  }

  function pruneUnavailableHelpEntries() {
    var tunasyncURL = (window.jekyllHelp && window.jekyllHelp.tunasyncPath) || "/static/tunasync.json";
    var optionsURL  = (window.jekyllHelp && window.jekyllHelp.optionsPath)  || "/static/options.json";

    function asJson(resp) {
      if (!resp || !resp.ok) throw new Error("fetch failed: " + (resp && resp.status));
      return resp.json();
    }

    Promise.all([
      fetch(tunasyncURL, { cache: "no-cache" }).then(asJson).catch(function () { return []; }),
      fetch(optionsURL,  { cache: "no-cache" }).then(asJson).catch(function () { return {}; })
    ]).then(function (results) {
      var tunasync = results[0];
      var opts     = (results[1] && results[1].options) || {};
      var available = new Set();

      (Array.isArray(tunasync) ? tunasync : []).forEach(function (m) {
        if (m && m.name) available.add(m.name);
      });

      var unlisted = opts.unlisted_mirrors;
      if (Array.isArray(unlisted)) {
        unlisted.forEach(function (m) {
          if (m && m.name) available.add(m.name);
        });
      }

      Array.prototype.forEach.call(
        document.querySelectorAll('option[id^="toc-"], li[id^="toc-"]'),
        function (el) {
          var name = extractMirrorId(el);
          if (name && !available.has(name) && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        }
      );

      var cur = currentMirrorId();
      if (cur && !available.has(cur)) {
        var base = MIRRORZ_HELP_FALLBACK.replace(/\/?$/, "/");
        window.location.replace(base + encodeURIComponent(cur));
      }
    }).catch(function (err) {
      // Fail-open: network hiccup shouldn't empty the sidebar.
      console.warn("help-runtime: could not filter by tunasync.json:", err);
    });
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function attachCopyButton(pre, getRawCode) {
    var btn = pre.querySelector("button.btn-clipboard");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var text = getRawCode();
      var flash = function () {
        btn.classList.add("copied");
        setTimeout(function () { btn.classList.remove("copied"); }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flash, function () {
          if (!fallbackCopy(text)) {
            var help = document.getElementById("help-content");
            if (help) help.setAttribute("data-cannot-copy", "");
          } else {
            flash();
          }
        });
        return;
      }
      if (fallbackCopy(text)) { flash(); return; }
      var help = document.getElementById("help-content");
      if (help) help.setAttribute("data-cannot-copy", "");
    });
  }

  function enableForm() {
    var help = document.getElementById("help-content");
    if (help) help.removeAttribute("data-helpz-not-ready");
  }

  function wireStaticCopyButtons() {
    Array.prototype.forEach.call(
      document.querySelectorAll("pre.codeblock"),
      function (pre) {
        if (pre.hasAttribute("data-z-code")) return;
        var orig = pre.querySelector("code[data-original-code]");
        var codeEl = pre.querySelector("code:not([data-original-code])");
        attachCopyButton(pre, function () {
          return (orig && orig.textContent) || (codeEl && codeEl.textContent) || "";
        });
      }
    );
  }

  function setupRuntime() {
    enableForm();

    var store = document.getElementById("zhelp-tmpls");
    if (!store) return;
    var ztmpls = store["zhelp-tmpls"] || [];

    if (!window.Hogan) {
      console.warn("help-runtime: Hogan runtime unavailable (static/js/hogan.min.js missing); live template rendering disabled");
      return;
    }

    var tmplData = ztmpls.map(function () { return {}; });
    var globalData = {};
    var forCode = {};

    function subscribe(codeId, fn) {
      if (!forCode[codeId]) forCode[codeId] = [];
      forCode[codeId].push(fn);
    }

    function notify(codeId) {
      if (forCode[codeId]) forCode[codeId].forEach(function (fn) { fn(); });
      if (codeId !== -1) return;
      Object.keys(forCode).forEach(function (k) {
        if (k === "-1") return;
        forCode[k].forEach(function (fn) { fn(); });
      });
    }

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-z-for-code]"),
      function (el) {
        var refKey = el.getAttribute("data-z-for-code");
        var name = el.getAttribute("data-z-name");
        function update() {
          var val = elementValue(el);
          if (refKey === "-1") globalData[name] = val;
          else tmplData[parseInt(refKey, 10)][name] = val;
          notify(parseInt(refKey, 10));
        }
        update();
        el.addEventListener("change", update);
        if (el instanceof HTMLInputElement && el.type === "text") {
          el.addEventListener("input", update);
        }
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-z-code]"),
      function (el) {
        var codeId = parseInt(el.getAttribute("data-z-code"), 10);
        var lang = el.getAttribute("data-z-lang");
        var tmpl = ztmpls[codeId];
        if (!tmpl) return;

        var compiled;
        try {
          compiled = new window.Hogan.Template(tmpl);
        } catch (e) {
          console.error("help-runtime: bad template for code", codeId, e);
          return;
        }

        var codeContainer;
        var rawCode = "";
        if (el.tagName.toLowerCase() === "pre") {
          codeContainer = el.querySelector("code");
          attachCopyButton(el, function () { return rawCode; });
        } else {
          codeContainer = el;
        }
        if (!codeContainer) return;

        function render() {
          var data = flattenData(globalData);
          try {
            if (data.urlpath) {
              var u = new URL(data.urlpath);
              u.protocol = (data.scheme || "https") + ":";
              data.endpoint = u.toString();
              data.host = u.host;
              data.path = u.pathname;
            }
          } catch (e) { /* ignore */ }
          var local = flattenData(tmplData[codeId] || {});
          Object.keys(local).forEach(function (k) { data[k] = local[k]; });

          rawCode = compiled.render(data).replace(/^[ \t]*\n?/, "");
          if (lang && window.hljs && window.hljs.getLanguage(lang)) {
            codeContainer.innerHTML = window.hljs.highlight(rawCode, { language: lang }).value;
          } else if (!lang && window.hljs) {
            codeContainer.innerHTML = window.hljs.highlightAuto(rawCode).value;
          } else {
            codeContainer.textContent = rawCode;
          }
        }

        subscribe(codeId, render);
        render();
      }
    );
  }

  ready(function () {
    wireStaticCopyButtons();
    initMobileNav();
    pruneUnavailableHelpEntries();
    setupRuntime();
  });
})();
