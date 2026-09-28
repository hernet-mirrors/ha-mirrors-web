const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const root = resolve(__dirname, '../..');
const dir = mkdtempSync(join(tmpdir(), 'ha-security-dom-'));
const file = join(dir, 'test.html');
const main = pathToFileURL(join(root, 'static/js/main.js')).href;
const help = pathToFileURL(join(root, 'static/js/help-runtime.js')).href;

try {
  writeFileSync(file, `<!doctype html><html><body>
    <span id="path">/ubuntu/&lt;img src=x onerror="document.body.dataset.pathXss='1'"&gt;/</span>
    <ol id="breadcrumb-nav"></ol>
    <div id="now-browsing-mirror"></div>
    <select id="help-select"><option selected data-help-url="javascript:document.body.dataset.helpXss='1'">help</option></select>
    <output id="security-result">PENDING</output>
    <script src="${main}"></script>
    <script src="${help}"></script>
    <script>
      window.addEventListener('load', function () {
        generateBreadcrumb();
        document.getElementById('path').textContent =
          '/<img src=x onerror="document.body.dataset.cardXss=1">/file/';
        generateMirrorCard();
        document.getElementById('help-select').dispatchEvent(new Event('change'));
        setTimeout(function () {
          const bad = document.querySelectorAll('#breadcrumb-nav img, #now-browsing-mirror img').length ||
                      document.body.dataset.pathXss || document.body.dataset.cardXss ||
                      document.body.dataset.helpXss;
          const crumb = document.querySelector('#breadcrumb-nav li.active');
          const card = document.querySelector('#now-browsing-mirror .card-title');
          const link = document.querySelector('#breadcrumb-nav a[href="/ubuntu/"]');
          document.getElementById('security-result').textContent =
            !bad && crumb && crumb.textContent.includes('<img') &&
            card && card.textContent.includes('<img') && link ? 'PASS' : 'FAIL';
        }, 100);
      });
    </script>
  </body></html>`);
  const html = execFileSync('chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--virtual-time-budget=1000', '--dump-dom', pathToFileURL(file).href
  ], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });
  assert.match(html, /<output id="security-result">PASS<\/output>/);
  console.log('PASS directory breadcrumb/card text and help navigation reject injected HTML and javascript: URLs');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
