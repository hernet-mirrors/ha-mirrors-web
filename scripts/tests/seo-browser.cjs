const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true});
  const base = process.argv[2] || 'http://127.0.0.1:4000';
  const nojs = await browser.newContext({javaScriptEnabled:false});
  const page = await nojs.newPage();
  await page.goto(base+'/');
  assert(await page.locator('#mirror-table-body tr').count() > 20);
  assert(await page.locator('#mirror-table-container').isVisible());
  await page.goto(base+'/news/');
  assert(await page.locator('#news-list article').count() > 0);
  assert(await page.locator('#news-list article').first().isVisible());
  const links = await page.locator('#news-pagination a').count();
  if (links > 1) {
    await page.locator('#news-pagination a').nth(1).click();
    assert(page.url().endsWith('/news/page2/'));
    assert(await page.locator('#news-list article').count() > 0);
  }
  await page.goto(base+'/help/');
  assert(page.url().endsWith('/help/'));
  assert(await page.locator('a[href="/help/ubuntu/"]').count() > 0);
  await page.goto(base+'/help/ubuntu/');
  assert(await page.locator('#help-content pre code').first().isVisible());
  assert((await page.locator('#help-content').textContent()).includes('http'));
  await nojs.close();

  const context = await browser.newContext();
  const js = await context.newPage();
  const errors=[];
  js.on('pageerror',error=>errors.push(error.message));
  await js.goto(base+'/news/');
  await js.waitForLoadState('domcontentloaded');
  const firstPage = await js.locator('#news-list').innerHTML();
  await js.locator('#news-search').fill('不存在的新闻xxxyyyzzz');
  assert(await js.locator('#news-empty').isVisible());
  await js.locator('#news-search').fill('教育网联合');
  assert.equal(await js.locator('#news-list article').count(),1);
  assert((await js.locator('#news-list .card-text').textContent()).includes('2026'));
  await js.locator('#news-search').fill('');
  assert.equal(await js.locator('#news-list').innerHTML(),firstPage);
  await js.locator('label[for="maintenance"]').click();
  assert(await js.locator('#news-empty').isVisible() || await js.locator('#news-list article').count() > 0);
  await js.locator('label[for="all-news"]').click();
  if (links > 1) {
    await js.locator('#news-pagination a').nth(1).click();
    await js.waitForLoadState('domcontentloaded');
    assert(js.url().endsWith('/news/page2/'));
    await js.locator('#news-search').fill('教育网联合');
    assert.equal(await js.locator('#news-list article').count(),1); // Searches across pages.
  }
  await js.goto(base+'/help/ubuntu/');
  await js.waitForLoadState('domcontentloaded');
  await js.locator('#help-content:not([data-helpz-not-ready])').waitFor();
  const select=js.locator('#help-content select').first();
  if (await select.count()) {
    const before=await js.locator('#help-content').textContent();
    const options=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    if (options.length>1) {
      await select.selectOption(options[options.length-1]);
      const after=await js.locator('#help-content').textContent();
      assert.notEqual(before,after);
    }
  }
  // A network failure must not erase the server-rendered mirror catalog.
  await js.route('**/static/tunasync.json*',route=>route.abort());
  await js.goto(base+'/');
  await js.waitForLoadState('domcontentloaded');
  assert(await js.locator('#mirror-table-body tr').count()>20);
  assert(await js.locator('#mirror-table-container').isVisible());
  await js.locator('#mirror-error').waitFor({state:'visible',timeout:15000});
  assert.deepEqual(errors,[]);
  await context.close();
  await browser.close();
  console.log('PASS browser: no-JS content, pagination, search, filters, help controls and failed-data fallback');
})().catch(error=>{console.error(error);process.exit(1)});
