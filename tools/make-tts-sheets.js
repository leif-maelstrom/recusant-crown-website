#!/usr/bin/env node
// Make the Tabletop Simulator card sheets for the current set revision.
//
// Tabletop Simulator builds a deck from "sheet" images: a grid of up to
// 10 x 7 cards, the last slot kept for the hidden card. This script draws
// every card in card-data.js with the site's own renderer (card-render.js),
// lays them out 69 to a sheet in collector-number order, and writes:
//
//   assets/tts/<set>/sheet-<n>-<tag>.jpg   the sheets (about 4100 x 4018 px)
//   assets/tts/<set>/back-<tag>.jpg        the card back
//   assets/js/tts-sheets.js                where each card sits, for the
//                                          Decks page's "Export for Tabletop
//                                          Simulator" button
//
// <tag> comes from the image's contents. Tabletop Simulator caches images
// by address, so a changed sheet gets a new name instead of overwriting the
// old one; decks people saved earlier keep pointing at the sheets they were
// made with. Old sheets can be deleted once nobody needs them.
//
// Run it from the top of the repo after cards change (it needs Node and
// Playwright: npm install playwright, then npx playwright install chromium):
//
//   node tools/make-tts-sheets.js path/to/card-back.png
//
// With no card back given, it reuses the one already in assets/tts.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const COLS = 10, ROWS = 7, PER_SHEET = COLS * ROWS - 1;
const CARD_W = 410, CARD_H = 574;            // 2.5 x 3.5 in, TTS's usual card size
const BACK_W = 750, BACK_H = 1050;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

// Serve the repo, plus the card back under /__back, so the page can load it.
function serve(backFile) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url === '/__back' ? backFile : path.join(ROOT, path.normalize(url));
    if (!file || (url !== '/__back' && !file.startsWith(ROOT)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function tag(buf) { return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8); }

function slug(text) { return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

(async () => {
  const backArg = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (backArg && !fs.existsSync(backArg)) throw new Error('No card back at ' + backArg);

  const server = await serve(backArg);
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(base + '/tools/tts-sheets.html');
  await page.evaluate(() => document.fonts.ready);

  const set = await page.evaluate(() => (window.RC_CARDS[0] || {}).set || 'set');
  const outDir = path.join(ROOT, 'assets', 'tts', slug(set));
  fs.mkdirSync(outDir, { recursive: true });
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

  // Draw each sheet in the page; hand it back as JPEG data.
  const sheets = await page.evaluate(async ({ COLS, ROWS, PER_SHEET, CARD_W, CARD_H }) => {
    const cards = window.RC_CARDS.slice().sort((a, b) => a.number - b.number);
    const out = [];
    for (let s = 0; s * PER_SHEET < cards.length; s++) {
      const group = cards.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
      const sheet = document.createElement('canvas');
      sheet.width = COLS * CARD_W;
      sheet.height = ROWS * CARD_H;
      const ctx = sheet.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.imageSmoothingQuality = 'high';
      for (let i = 0; i < group.length; i++) {
        const drawn = await window.RC_RENDER.draw(group[i]);
        ctx.drawImage(drawn, (i % COLS) * CARD_W, Math.floor(i / COLS) * CARD_H, CARD_W, CARD_H);
      }
      out.push({
        data: sheet.toDataURL('image/jpeg', 0.88).split(',')[1],
        cards: group.map((c, i) => [c.number, c.name, i])
      });
    }
    return out;
  }, { COLS, ROWS, PER_SHEET, CARD_W, CARD_H });

  const manifest = { set: set, cols: COLS, rows: ROWS, sheets: [], cards: {} };
  sheets.forEach((s, n) => {
    const buf = Buffer.from(s.data, 'base64');
    const file = path.join(outDir, 'sheet-' + (n + 1) + '-' + tag(buf) + '.jpg');
    fs.writeFileSync(file, buf);
    manifest.sheets.push(rel(file));
    s.cards.forEach(([number, name, i]) => { manifest.cards[number] = [n, i, name]; });
    console.log('wrote', rel(file), (buf.length / 1048576).toFixed(1) + ' MB,', s.cards.length, 'cards');
  });

  // The card back: the one given, scaled to card size, or the newest already made.
  if (backArg) {
    const data = await page.evaluate(async ({ BACK_W, BACK_H }) => {
      const img = new Image();
      img.src = '/__back';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = BACK_W; c.height = BACK_H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, BACK_W, BACK_H);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    }, { BACK_W, BACK_H });
    const buf = Buffer.from(data, 'base64');
    const file = path.join(ROOT, 'assets', 'tts', 'back-' + tag(buf) + '.jpg');
    fs.writeFileSync(file, buf);
    manifest.back = rel(file);
    console.log('wrote', manifest.back);
  } else {
    const backs = fs.readdirSync(path.join(ROOT, 'assets', 'tts')).filter((f) => /^back-.*\.jpg$/.test(f))
      .map((f) => path.join(ROOT, 'assets', 'tts', f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!backs.length) throw new Error('No card back yet: pass the card back image as the first argument.');
    manifest.back = rel(backs[0]);
  }

  const js = [
    '// Where each card sits on the Tabletop Simulator sheets. Made by',
    '// tools/make-tts-sheets.js; run it again after cards change, rather than',
    '// editing this by hand. cards: number -> [sheet, slot, name].',
    'window.RC_TTS = ' + JSON.stringify(manifest, null, 1) + ';',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'tts-sheets.js'), js);
  console.log('wrote assets/js/tts-sheets.js:', Object.keys(manifest.cards).length, 'cards on', manifest.sheets.length, 'sheets');

  await browser.close();
  server.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
