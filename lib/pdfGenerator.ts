import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

/**
 * Genera un PDF a partir de HTML.
 * - En desarrollo local (macOS): usa Chrome del sistema.
 * - En Vercel/produccion: usa el Chromium de @sparticuz/chromium-min.
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const isDev = process.env.NODE_ENV === 'development';

  const executablePath = isDev
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
      );

  const browser = await puppeteer.launch({
    args: isDev ? [] : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', bottom: '16px', left: '16px', right: '16px' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
