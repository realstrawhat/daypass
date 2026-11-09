// Makes the pictures on the GitHub front page from the screenshots in userflow/screens:
// a banner and an animated walkthrough. Needs Chrome and ffmpeg.
// From the project folder:  node userflow/readme-art.mjs
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const DIR = import.meta.dirname;
const OUT = join(DIR, 'readme');
const FRAMES = join(OUT, '.frames');
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
mkdirSync(FRAMES, { recursive: true });

const shot = (name) => `data:image/jpeg;base64,${readFileSync(join(DIR, 'screens', `${name}.jpg`)).toString('base64')}`;
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat+Brush&family=Manrope:wght@500;700;800&display=block" rel="stylesheet">';
const BASE = `
  * { box-sizing: border-box; margin: 0; }
  body { background: #000; color: #fff; font-family: Manrope, sans-serif; overflow: hidden; }
  .phone { position: absolute; border-radius: 40px; border: 7px solid #1c1d20; background: #000; overflow: hidden;
           box-shadow: 0 30px 80px rgba(0,0,0,.7), 0 0 0 1px #34363a; }
  .phone img { display: block; width: 100%; }
  .volt { color: #d7ff3e; }
`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const render = async (html, width, height, file, scale = 1) => {
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.setContent(`<!doctype html><html><head>${FONTS}<style>${BASE}</style></head><body>${html}</body></html>`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, ...(file.endsWith('.jpg') ? { type: 'jpeg', quality: 88 } : {}) });
};

// 1. Banner.
await render(`
  <style>
    .glow { position: absolute; width: 900px; height: 900px; right: -200px; top: -260px; border-radius: 50%;
            background: radial-gradient(circle, rgba(215,255,62,.20), rgba(215,255,62,0) 62%); }
    .copy { position: absolute; left: 72px; top: 92px; width: 560px; }
    .logo { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 26px; }
    .hand { font-family: 'Caveat Brush'; font-size: 34px; margin-top: 54px; transform: rotate(-3deg); transform-origin: left; }
    h1 { font-family: Anton; font-weight: 400; font-size: 104px; line-height: .98; margin-top: 8px; letter-spacing: .5px; }
    .sub { font-size: 21px; line-height: 1.5; color: #b9bbb5; margin-top: 26px; max-width: 480px; }
  </style>
  <div class="glow"></div>
  <div class="copy">
    <div class="logo"><svg width="30" height="30" viewBox="0 0 24 24"><path fill="#d7ff3e" d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0z"/></svg>Daypass</div>
    <div class="hand volt">no membership, no catch</div>
    <h1>ONE GYM.<br>ONE DAY.<br><span class="volt">NO CONTRACT.</span></h1>
    <p class="sub">Find a gym in any city, book an hour, pay, and walk in with a pass on your phone.</p>
  </div>
  <div class="phone" style="width:236px; left:668px; top:150px; transform:rotate(-7deg); opacity:.85"><img src="${shot('find-04-gym-cards')}"></div>
  <div class="phone" style="width:236px; left:1000px; top:150px; transform:rotate(7deg); opacity:.85"><img src="${shot('door-05-time-left')}"></div>
  <div class="phone" style="width:270px; left:820px; top:70px; z-index:2"><img src="${shot('book-05-pass-ready')}"></div>
`, 1280, 640, join(OUT, 'banner.jpg'), 1.5);

// 2. Walkthrough, one frame per step, joined into a looping GIF.
const steps = [
  ['home-01-hero', 'Open Daypass'],
  ['find-04-gym-cards', 'Find a gym nearby'],
  ['gym-01-photos', 'Look around'],
  ['gym-03-time-chosen', 'Pick a time'],
  ['book-02-pay', 'Pay in one tap'],
  ['book-05-pass-ready', 'Your pass is ready'],
  ['door-01-show-at-desk', 'Show it at the desk'],
  ['door-04-phone-says-checked-in', 'Checked in'],
  ['door-05-time-left', 'Your hour counts down'],
  ['door-12-rate-the-gym', 'Rate the gym'],
];
for (const [i, [name, title]] of steps.entries()) {
  await render(`
    <style>
      .cap { position: absolute; left: 0; right: 0; top: 26px; display: flex; align-items: center; justify-content: center; gap: 12px; }
      .n { background: #d7ff3e; color: #000; font-weight: 800; font-size: 17px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; }
      .t { font-family: Anton; font-size: 31px; letter-spacing: .5px; text-transform: uppercase; }
      .dots { position: absolute; left: 0; right: 0; top: 76px; display: flex; justify-content: center; gap: 6px; }
      .dots i { width: 18px; height: 4px; border-radius: 2px; background: #2c2e31; }
      .dots i.on { background: #d7ff3e; }
    </style>
    <div class="cap"><span class="n">${i + 1}</span><span class="t">${title}</span></div>
    <div class="dots">${steps.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="phone" style="width:300px; left:60px; top:106px"><img src="${shot(name)}"></div>
  `, 420, 760, join(FRAMES, `f${String(i).padStart(2, '0')}.png`));
}
await browser.close();

execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '1/1.8', '-i', join(FRAMES, 'f%02d.png'),
  '-vf', 'fps=5,split[a][b];[a]palettegen=max_colors=160:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a',
  '-loop', '0', join(OUT, 'walkthrough.gif')]);
rmSync(FRAMES, { recursive: true, force: true });
console.log('saved banner.jpg and walkthrough.gif in userflow/readme');
