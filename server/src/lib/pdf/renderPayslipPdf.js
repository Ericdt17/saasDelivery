'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TEMPLATE_PATH = path.join(__dirname, '../../templates/payslip.html');

let browserPromise = null;

function loadTemplate() {
  // Always read from disk so template tweaks apply without process restart.
  return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

/**
 * Replace {{key}} placeholders. Values are HTML-escaped.
 * @param {string} html
 * @param {Record<string, string|number|null|undefined>} model
 */
function fillTemplate(html, model) {
  const rawKeys = new Set(['logoHtml', 'signatureHtml', 'stampHtml']);
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const raw = model[key];
    if (raw == null) return '';
    const str = String(raw);
    if (rawKeys.has(key)) return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  });
}

function launchOptions(overrides = {}) {
  const opts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...overrides,
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else if (process.env.PUPPETEER_CHANNEL) {
    opts.channel = process.env.PUPPETEER_CHANNEL;
  }
  return opts;
}

async function launchBrowser() {
  try {
    return await puppeteer.launch(launchOptions());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Bundled Chrome missing (common after npm install without browser download).
    if (msg.includes('Could not find Chrome') && !process.env.PUPPETEER_EXECUTABLE_PATH) {
      return puppeteer.launch(launchOptions({ channel: 'chrome' }));
    }
    throw err;
  }
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
    const close = async () => {
      try {
        const browser = await browserPromise;
        if (browser) await browser.close();
      } catch {
        /* ignore */
      } finally {
        browserPromise = null;
      }
    };
    process.once('SIGINT', () => {
      close().finally(() => process.exit(0));
    });
    process.once('SIGTERM', () => {
      close().finally(() => process.exit(0));
    });
  }
  return browserPromise;
}

/**
 * @param {Record<string, string|number|null|undefined>} model
 * @returns {Promise<Buffer>}
 */
async function renderPayslipPdf(model) {
  const html = fillTemplate(loadTemplate(), model);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '14mm', bottom: '18mm', left: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** @internal test helper */
function _resetForTests() {
  browserPromise = null;
}

module.exports = {
  renderPayslipPdf,
  fillTemplate,
  loadTemplate,
  _resetForTests,
};
