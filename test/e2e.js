// End-to-end check in a real browser: node test/e2e.js
// Starts test/server.js, then walks through the app like a farm worker would,
// including working offline, and checks what lands in the (fake) Google Sheet.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const SHOTS = process.env.SHOTS || path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

async function main() {
  const server = spawn('node', [path.join(__dirname, 'server.js')], { stdio: ['ignore', 'pipe', 'inherit'] });
  const key = await new Promise((resolve) => server.stdout.on('data', (d) => {
    const m = /key=(\S+)/.exec(String(d));
    if (m) resolve(m[1]);
  }));
  const state = async () => (await fetch('http://localhost:8081/__state')).json();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const status = () => page.locator('#status').innerText();
  const waitStatus = async (text) => page.waitForFunction((t) => document.querySelector('#status').innerText.includes(t), text, { timeout: 15000 });
  const tile = (name) => page.locator('.tile', { hasText: name }).click();
  const save = () => page.locator('button[type=submit]').click();

  try {
    // 1. Connect with the setup link the Google Sheet produces.
    const code = Buffer.from(JSON.stringify({ u: 'http://localhost:8081/exec', k: key })).toString('base64url');
    await page.goto(`http://localhost:8080/#setup=${code}`);
    await page.waitForSelector('text=This computer is now connected');
    await waitStatus('All uploaded');
    await page.screenshot({ path: `${SHOTS}/01-connected.png` });
    await page.click('text=Back');
    await page.screenshot({ path: `${SHOTS}/02-home.png` });

    // 2. A pig arrives (individual, tag 007 must stay "007", not 7).
    await tile('New arrival');
    await page.selectOption('#f-species', 'Pig');
    await page.fill('#f-animalId', '007');
    await page.fill('#f-breed', 'Large White');
    await page.locator('.pill', { hasText: 'Female' }).click();
    await page.fill('#f-source', 'Pokhara market');
    await page.fill('#f-price', '15000');
    await page.selectOption('#f-recordedBy', 'Farm manager');
    assert(await page.locator('[data-field=count]').isHidden(), 'count hidden for individual animals');
    await page.screenshot({ path: `${SHOTS}/03-arrival-form.png`, fullPage: true });
    await save();
    await page.waitForSelector('.tiles');
    await waitStatus('All uploaded');

    // 3. A batch of 200 chicks arrives.
    await tile('New arrival');
    await page.selectOption('#f-species', 'Chicken');
    assert(await page.locator('[data-field=sex]').isHidden(), 'sex hidden for batches');
    await page.fill('#f-animalId', 'C1');
    await page.fill('#f-count', '200');
    await page.fill('#f-source', 'Chitwan hatchery');
    await save();
    await page.waitForSelector('.tiles');

    // 4. Validation: same pig tag again is refused; missing count is refused.
    await tile('New arrival');
    await page.selectOption('#f-species', 'Pig');
    await page.fill('#f-animalId', '007');
    await save();
    await page.waitForSelector('text=already in use');
    await page.screenshot({ path: `${SHOTS}/04-validation.png`, fullPage: true });
    await page.click('text=Cancel');

    // 5. 5 chickens die (with a photo); too many is refused first.
    await tile('Death / loss');
    await page.selectOption('#f-species', 'Chicken');
    await page.selectOption('#f-animalId', 'C1');
    await page.fill('#f-count', '500');
    await page.selectOption('#f-cause', 'Illness');
    await save();
    await page.waitForSelector('text=more than are left');
    await page.fill('#f-count', '5');
    const png = Buffer.from(fs.readFileSync(path.join(__dirname, '..', 'icons', 'icon-192.png')));
    await page.setInputFiles('#f-photo', { name: 'dead.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('#photoPreview:not([hidden])');
    await page.screenshot({ path: `${SHOTS}/05-death-form.png`, fullPage: true });
    await save();
    await page.waitForSelector('.tiles');

    // 6. Pig vaccinated, pig weighed.
    await tile('Treatment');
    await page.selectOption('#f-species', 'Pig');
    await page.selectOption('#f-animalId', '007');
    await page.selectOption('#f-treatmentType', 'Vaccination');
    await page.fill('#f-medicine', 'Swine fever vaccine');
    await save();
    await page.waitForSelector('.tiles');
    await tile('Weight');
    await page.selectOption('#f-species', 'Pig');
    await page.selectOption('#f-animalId', '007');
    await page.fill('#f-weightKg', '42.5');
    await save();
    await page.waitForSelector('.tiles');
    await waitStatus('All uploaded');

    // 7. Internet drops: entries are kept on the laptop, and the app still opens.
    await context.setOffline(true);
    await tile('Sale');
    await page.selectOption('#f-species', 'Chicken');
    await page.selectOption('#f-animalId', 'C1');
    await page.fill('#f-count', '20');
    await page.fill('#f-buyer', 'Local hotel');
    await page.fill('#f-salePrice', '16000');
    await save();
    await waitStatus('1 waiting to upload');
    await page.screenshot({ path: `${SHOTS}/06-offline.png` });
    await page.reload();
    await page.waitForSelector('.tiles');
    await page.click('#status');
    await waitStatus('1 waiting to upload');
    assert.match(await status(), /No internet/);
    // Animals list already reflects the unsent sale.
    await page.click('text=Animals & birds');
    await page.waitForSelector('table.list');
    assert.match(await page.locator('tr', { hasText: 'C1' }).innerText(), /175/);

    // 8. Internet back: it uploads by itself.
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitStatus('All uploaded');

    // 9. A pig litter is born.
    await page.goto('http://localhost:8080/#/new/Birth');
    await page.selectOption('#f-species', 'Pig');
    await page.fill('#f-animalId', 'L1');
    await page.fill('#f-motherId', '007');
    await page.fill('#f-count', '9');
    assert(await page.locator('[data-field=sex]').isHidden(), 'sex hidden for a litter');
    await save();
    await page.waitForSelector('.tiles');
    await waitStatus('All uploaded');

    // 9b. Three piglets from the litter are sold – the count box appears for a litter.
    await page.goto('http://localhost:8080/#/new/Sale');
    await page.selectOption('#f-species', 'Pig');
    await page.selectOption('#f-animalId', '007');
    assert(await page.locator('[data-field=countReduce]').isHidden(), 'no count for a single pig');
    await page.selectOption('#f-animalId', 'L1');
    assert(await page.locator('[data-field=countReduce]').isVisible(), 'count shown for a litter');
    await page.fill('#f-count', '3');
    await page.fill('#f-buyer', 'Neighbour');
    await save();
    await page.waitForSelector('.tiles');
    await waitStatus('All uploaded');

    // 10. Screens for the record.
    await page.click('text=Animals & birds');
    await page.waitForSelector('table.list');
    await page.screenshot({ path: `${SHOTS}/07-animals.png`, fullPage: true });
    await page.locator('tr', { hasText: '007' }).click();
    await page.waitForSelector('.facts');
    await page.screenshot({ path: `${SHOTS}/08-animal-detail.png`, fullPage: true });
    await page.goto('http://localhost:8080/#/recent');
    await page.waitForSelector('.events');
    await page.screenshot({ path: `${SHOTS}/09-recent.png`, fullPage: true });

    // 11. What the UK sees in the Sheet.
    const s = await state();
    const ev = s.sheets.Events;
    assert.strictEqual(ev.length - 1, 8, 'eight events in the Sheet');
    const head = ev[0];
    const col = (h) => head.indexOf(h);
    const pigRow = ev.find((r) => r[col('Event')] === 'Arrival' && r[col('Animal type')] === 'Pig');
    assert.strictEqual(pigRow[col('Tag / batch no.')], '007', 'tag kept as text');
    assert.strictEqual(pigRow[col('Price paid (NPR)')], 15000);
    const deathRow = ev.find((r) => r[col('Event')] === 'Death/Loss');
    assert.match(String(deathRow[col('Photo')]), /^https:\/\/drive\.example\//, 'photo saved to Drive');
    assert.strictEqual(s.files, 1);
    const animals = s.sheets.Animals;
    const ah = animals[0];
    const c1 = animals.find((r) => r[ah.indexOf('Tag / batch no.')] === 'C1');
    assert.strictEqual(c1[ah.indexOf('Count now')], 175);
    const pig = animals.find((r) => r[ah.indexOf('Tag / batch no.')] === '007');
    assert.strictEqual(pig[ah.indexOf('Last weight (kg)')], 42.5);
    assert.strictEqual(pig[ah.indexOf('Last treatment')], 'Vaccination – Swine fever vaccine');
    const summary = s.sheets.Summary;
    const chickenRow = summary.find((r) => r[0] === 'Chicken');
    assert.deepStrictEqual(chickenRow.slice(1, 6), [175, 1, 200, 5, 20]);
    const pigSummary = summary.find((r) => r[0] === 'Pig');
    assert.strictEqual(pigSummary[1], 7, 'pig 007 + litter of 9 less 3 sold');
    console.log('Summary tab:\n' + summary.map((r) => r.map((v) => (v instanceof Object ? JSON.stringify(v) : v)).join(' | ')).join('\n'));

    // 12. Upload retries never create duplicates.
    const dup = await fetch('http://localhost:8081/exec', { method: 'POST', body: JSON.stringify({ key, events: [{ id: ev[1][col('Entry ID')], type: 'Arrival', species: 'Pig', animalId: 'X' }] }) }).then((r) => r.json());
    assert.deepStrictEqual(dup.accepted.length, 1);
    assert.strictEqual((await state()).sheets.Events.length - 1, 8, 'no duplicate');

    // 13. Wrong key is refused.
    const bad = await fetch('http://localhost:8081/exec?action=bootstrap&key=nope').then((r) => r.json());
    assert.strictEqual(bad.error, 'bad_key');

    // 14. Phone-sized screen.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p2 = await phone.newPage();
    await p2.goto(`http://localhost:8080/#setup=${code}`);
    await p2.waitForFunction(() => document.querySelector('#status').innerText.includes('All uploaded'));
    await p2.goto('http://localhost:8080/#/');
    await p2.waitForSelector('.tiles');
    await p2.screenshot({ path: `${SHOTS}/10-phone-home.png` });
    await p2.goto('http://localhost:8080/#/new/Arrival');
    await p2.selectOption('#f-species', 'Goat');
    await p2.screenshot({ path: `${SHOTS}/11-phone-form.png`, fullPage: true });
    const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!overflow, 'no sideways scrolling on a phone');

    assert.deepStrictEqual(errors.filter((e) => !/Failed to fetch|ERR_INTERNET_DISCONNECTED|Sync failed/.test(e)), [], 'no browser errors');
    console.log('\nALL CHECKS PASSED');
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
