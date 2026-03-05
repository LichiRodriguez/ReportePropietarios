import type { NextApiRequest, NextApiResponse } from 'next';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pubId = req.query.pubId as string || '14233';
  const portalId = req.query.portalId as string || '4';
  const propertyId = req.query.propertyId as string || '196980';

  const tokko = new TokkobrokerService();

  if (!tokko.isSessionConfigured()) {
    return res.status(400).json({ error: 'TOKKO_USERNAME / TOKKO_PASSWORD not configured' });
  }

  const results: any = { pubId, portalId, propertyId };

  try {
    const sessionCookie = await (tokko as any).login();
    results.loginOk = true;

    // Extract CSRF token from cookie
    const csrfMatch = sessionCookie.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    results.hasCsrf = !!csrfToken;

    const baseHeaders: Record<string, string> = {
      'Cookie': sessionCookie,
      'Referer': `https://www.tokkobroker.com/property/${propertyId}/`,
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1. Get publications for this property on ZonaProp
    try {
      const pubRes = await fetch(
        `https://www.tokkobroker.com/portals/api/v1/publication/?portal_id=${portalId}&property_id=${propertyId}&limit=100`,
        { headers: baseHeaders, redirect: 'follow' }
      );
      const pubData = await pubRes.json();
      results.property_publications = {
        total_count: pubData.meta?.total_count,
        objects: (pubData.objects || []).map((p: any) => ({
          id: p.id,
          portal_id: p.portal_id,
          subportal_id: p.subportal_id,
          has_stats: p.has_stats,
          status: p.status,
          url: p.url,
        })),
      };
    } catch (e: any) {
      results.property_publications_error = e.message;
    }

    // 2. Extract the openPublicationStat JS function from property page
    try {
      const pageRes = await fetch(`https://www.tokkobroker.com/property/${propertyId}/`, {
        headers: baseHeaders,
        redirect: 'follow',
      });
      const html = await pageRes.text();

      // Find the function that opens publication stats
      const openStatMatch = html.match(/function\s+openPublicationStat[^{]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/);
      results.openPublicationStat_fn = openStatMatch ? openStatMatch[0].substring(0, 2000) : 'not found';

      // Also search for any fetch/ajax calls containing "stat" near "publication"
      const statFetchPatterns = html.match(/(?:fetch|ajax|\$\.get|\$\.post|\.load)\s*\([^)]*(?:stat|publication)[^)]*\)/gi);
      results.statFetchCalls = (statFetchPatterns || []).slice(0, 10);

      // Search for the URL template
      const urlTemplateMatch = html.match(/portals\/[^'"]*publication[^'"]*stat[^'"]*['"]?/gi);
      results.statUrlTemplates = (urlTemplateMatch || []).slice(0, 10);

      // Look for any stat/portal URL construction code
      const statCodeMatches = html.match(/.{0,100}openPublicationStat.{0,300}/gi);
      results.statCodeContext = (statCodeMatches || []).slice(0, 3).map((s: string) => s.substring(0, 500));

      // Also look for any reference to exposicion/vistas/contactos
      const exposicionMatch = html.match(/.{0,50}(?:exposici[oó]n|vistas|contactos\s*interesados).{0,100}/gi);
      results.exposicionReferences = (exposicionMatch || []).slice(0, 10);

    } catch (e: any) {
      results.page_scrape_error = e.message;
    }

    // 3. THE KEY ENDPOINT: /portals/{portal_id}/publication/{pub_id}/stats_detail/
    // Found by scraping the JS code: loadPublicationStatistics makes AJAX GET to this URL
    results.stats_detail = {};

    try {
      const statsUrl = `https://www.tokkobroker.com/portals/${portalId}/publication/${pubId}/stats_detail/`;
      const r = await fetch(statsUrl, {
        headers: baseHeaders,
        redirect: 'follow',
      });
      const contentType = r.headers.get('content-type') || '';
      const text = await r.text();
      results.stats_detail = {
        url: statsUrl,
        status: r.status,
        contentType,
        bodyFull: text.substring(0, 8000),
      };

      // If it's JSON, try to parse
      if (contentType.includes('json') && r.status === 200) {
        try {
          results.stats_detail.parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
      }
    } catch (e: any) {
      results.stats_detail = { error: e.message };
    }

    // Also try without trailing slash
    try {
      const r2 = await fetch(
        `https://www.tokkobroker.com/portals/${portalId}/publication/${pubId}/stats_detail`,
        { headers: baseHeaders, redirect: 'follow' }
      );
      if (r2.status !== 404) {
        const t2 = await r2.text();
        results.stats_detail_no_slash = {
          status: r2.status,
          contentType: r2.headers.get('content-type'),
          body: t2.substring(0, 5000),
        };
      }
    } catch {
      // skip
    }

    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
