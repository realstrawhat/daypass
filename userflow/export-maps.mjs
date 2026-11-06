// Saves the map as pictures in userflow/maps, for slides and reports. Run node userflow/build-map.mjs first, then: node userflow/export-maps.mjs
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = import.meta.dirname;
const OUT = join(HERE, 'maps');
mkdirSync(OUT, { recursive: true });
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push(`failed ${r.url().slice(-50)}`));
await page.setViewport({ width: 1500, height: 900, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(HERE, 'index.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }));
await page.waitForFunction(() => [...document.images].every((i) => i.complete));

const save = async (selector, name) => {
  const el = await page.$(selector);
  await el.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86 });
  console.log(name);
};
await save('.overview', 'map-whole-app');
await page.addStyleTag({ content: 'nav { display: none; } .lane { overflow: visible; } .journey { width: max-content; min-width: 100%; }' });
// Each picture is exactly as wide as its own journey, with no empty space.
for (const [id, name] of [['j1', 'j1-find-book-visit'], ['j2', 'j2-reschedule'], ['j3', 'j3-at-the-door'], ['j4', 'j4-front-desk'], ['j5', 'j5-list-a-gym'], ['j6', 'j6-track-training'], ['j7', 'j7-account']]) {
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
  const wide = await page.$eval(`#${id} .lane`, (l) => l.scrollWidth);
  await page.setViewport({ width: Math.min(Math.max(wide + 90, 1100), 7600), height: 900, deviceScaleFactor: 1 });
  await save(`#${id}`, name);
}
console.log('problems', errors);
await browser.close();
