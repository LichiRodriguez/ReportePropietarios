import type { NextApiRequest, NextApiResponse } from 'next';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const propertyId = req.query.propertyId as string || '7385634';
  const mode = req.query.mode as string || 'all'; // 'pdf', 'html', 'all'

  const tokko = new TokkobrokerService();

  if (!tokko.isSessionConfigured()) {
    return res.status(400).json({ error: 'TOKKO_USERNAME / TOKKO_PASSWORD not configured' });
  }

  const results: any = { propertyId };

  try {
    // Force login to get session cookie
    const sessionCookie = await (tokko as any).login();
    results.loginOk = true;
    results.cookieLength = sessionCookie.length;

    // --- Approach 1: Try downloading the PDF with redirect follow ---
    if (mode === 'pdf' || mode === 'all') {
      try {
        const pdfUrl = `https://www.tokkobroker.com/a/download_report/${propertyId}/?active_pubs=true&show_pub=true`;

        // First request - manual redirect to see what happens
        const manualRes = await fetch(pdfUrl, {
          headers: {
            'Cookie': sessionCookie,
            'Referer': `https://www.tokkobroker.com/property/${propertyId}/`,
          },
          redirect: 'manual',
        });

        results.pdf_manual = {
          status: manualRes.status,
          location: manualRes.headers.get('location'),
          contentType: manualRes.headers.get('content-type'),
          contentLength: manualRes.headers.get('content-length'),
        };

        // Second request - follow redirects
        const followRes = await fetch(pdfUrl, {
          headers: {
            'Cookie': sessionCookie,
            'Referer': `https://www.tokkobroker.com/property/${propertyId}/`,
          },
          redirect: 'follow',
        });

        const pdfBuffer = await followRes.arrayBuffer();
        results.pdf_follow = {
          status: followRes.status,
          contentType: followRes.headers.get('content-type'),
          bodySize: pdfBuffer.byteLength,
          redirected: followRes.redirected,
          finalUrl: followRes.url,
        };

        // If we got PDF content, try to parse it
        if (pdfBuffer.byteLength > 100) {
          try {
            const { getDocumentProxy, extractText } = await import('unpdf');
            const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
            const { totalPages, text } = await extractText(pdf, { mergePages: false });
            results.pdf_parsed = {
              totalPages,
              pages: text.map((t: string, i: number) => ({
                page: i + 1,
                textLength: t.length,
                text: t.substring(0, 2000),
              })),
            };
          } catch (parseErr: any) {
            results.pdf_parseError = parseErr.message;
            // Show raw bytes as string to see if it's actually HTML
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const rawText = decoder.decode(pdfBuffer);
            results.pdf_rawPreview = rawText.substring(0, 1000);
          }
        } else if (pdfBuffer.byteLength > 0) {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          results.pdf_rawPreview = decoder.decode(pdfBuffer).substring(0, 500);
        }
      } catch (pdfErr: any) {
        results.pdf_error = pdfErr.message;
      }
    }

    // --- Approach 2: Scrape the Difusión HTML page ---
    if (mode === 'html' || mode === 'all') {
      try {
        // Try the property page itself
        const propRes = await fetch(
          `https://www.tokkobroker.com/property/${propertyId}/`,
          {
            headers: {
              'Cookie': sessionCookie,
              'Referer': 'https://www.tokkobroker.com/home',
            },
            redirect: 'follow',
          }
        );

        const propHtml = await propRes.text();
        results.property_page = {
          status: propRes.status,
          htmlLength: propHtml.length,
        };

        // Look for difusion/publication related data in the page
        const difusionMatch = propHtml.match(/difusi[oó]n|publication|portal.*stat|zonaprop.*stat/gi);
        results.property_page.difusionMentions = difusionMatch || [];

        // Look for AJAX endpoints in JavaScript
        const ajaxMatches = propHtml.match(/\/property\/\d+\/[a-z_]+/g);
        results.property_page.propertyEndpoints = Array.from(new Set(ajaxMatches || []));

        // Look for any stats-related URLs
        const statsUrls = propHtml.match(/['"](\/[^'"]*(?:stat|difus|portal|publication|expo)[^'"]*)['"]/gi);
        results.property_page.statsUrls = Array.from(new Set(statsUrls || []));

        // Look for ZonaProp related data
        const zpMatches = propHtml.match(/zonaprop[^<]{0,200}/gi);
        results.property_page.zonapropReferences = (zpMatches || []).slice(0, 10);

      } catch (htmlErr: any) {
        results.html_error = htmlErr.message;
      }
    }

    // --- Approach 3: Try various potential stat endpoints ---
    if (mode === 'endpoints' || mode === 'all') {
      const endpointsToTry = [
        `/property/${propertyId}/charts_stats`,
        `/property/${propertyId}/publication_list/`,
        `/property/${propertyId}/get_publications/`,
        `/property/${propertyId}/publications/`,
        `/property/${propertyId}/difusion/`,
        `/property/${propertyId}/portals/`,
        `/property/${propertyId}/portal_publications/`,
        `/api/v1/property/${propertyId}/publication/?key=${process.env.TOKKO_API_KEY}&format=json`,
        `/api/v1/publication/?property=${propertyId}&key=${process.env.TOKKO_API_KEY}&format=json`,
      ];

      results.endpoints = [];
      for (const ep of endpointsToTry) {
        try {
          const epRes = await fetch(`https://www.tokkobroker.com${ep}`, {
            headers: {
              'Cookie': sessionCookie,
              'Referer': `https://www.tokkobroker.com/property/${propertyId}/`,
              'X-Requested-With': 'XMLHttpRequest',
            },
            redirect: 'follow',
          });

          const contentType = epRes.headers.get('content-type') || '';
          let preview = '';
          if (contentType.includes('json') || contentType.includes('text')) {
            const text = await epRes.text();
            preview = text.substring(0, 500);
          }

          results.endpoints.push({
            path: ep,
            status: epRes.status,
            contentType,
            preview: preview || null,
          });
        } catch (epErr: any) {
          results.endpoints.push({ path: ep, error: epErr.message });
        }
      }
    }

    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
}
