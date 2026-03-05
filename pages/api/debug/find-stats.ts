import type { NextApiRequest, NextApiResponse } from 'next';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tokko = new TokkobrokerService();

  if (!tokko.isSessionConfigured()) {
    return res.status(400).json({ error: 'TOKKO_USERNAME / TOKKO_PASSWORD not configured' });
  }

  const results: any = {};

  try {
    const sessionCookie = await (tokko as any).login();
    results.loginOk = true;

    const headers = {
      'Cookie': sessionCookie,
      'Referer': 'https://www.tokkobroker.com/home',
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1. Find publications with has_stats=true
    // Try paginating through publications to find ones with stats
    let offset = 0;
    const limit = 100;
    let found: any[] = [];
    let totalChecked = 0;

    for (let page = 0; page < 5 && found.length < 3; page++) {
      const pubRes = await fetch(
        `https://www.tokkobroker.com/portals/api/v1/publication/?limit=${limit}&offset=${offset}`,
        { headers, redirect: 'follow' }
      );
      const pubData = await pubRes.json();
      totalChecked += (pubData.objects || []).length;

      for (const pub of (pubData.objects || [])) {
        if (pub.has_stats) {
          found.push({
            id: pub.id,
            portal_id: pub.portal_id,
            subportal_id: pub.subportal_id,
            property_id: pub.property_id,
            category: pub.category,
            status: pub.status,
            url: pub.url,
          });
          if (found.length >= 3) break;
        }
      }

      if (!pubData.meta?.next) break;
      offset += limit;
    }

    results.publications_checked = totalChecked;
    results.publications_with_stats = found;

    // 2. For each found publication with stats, try to get the actual stats
    if (found.length > 0) {
      results.stat_results = [];

      for (const pub of found) {
        const statEndpoints = [
          `/portals/${pub.portal_id}/publication/${pub.id}/stat`,
          `/portals/${pub.portal_id}/publication/${pub.id}/stat/`,
          `/portals/${pub.portal_id}/publication/${pub.id}/stats`,
          `/portals/${pub.portal_id}/publication/${pub.id}/stats/`,
          `/portals/publication/${pub.id}/stat`,
          `/portals/publication/${pub.id}/stat/`,
        ];

        for (const ep of statEndpoints) {
          try {
            const statRes = await fetch(`https://www.tokkobroker.com${ep}`, {
              headers,
              redirect: 'follow',
            });
            const contentType = statRes.headers.get('content-type') || '';
            let preview = '';
            if (statRes.status !== 404) {
              const text = await statRes.text();
              preview = text.substring(0, 2000);
            }
            results.stat_results.push({
              pub_id: pub.id,
              portal_id: pub.portal_id,
              property_id: pub.property_id,
              endpoint: ep,
              status: statRes.status,
              contentType,
              preview: preview || null,
            });

            // If we got a success, no need to try other patterns
            if (statRes.status === 200) break;
          } catch (err: any) {
            results.stat_results.push({
              pub_id: pub.id,
              endpoint: ep,
              error: err.message,
            });
          }
        }
      }
    }

    // 3. Also check what portal_id corresponds to ZonaProp
    // Try getting portal_id=4 publications (which was requested from the browser for ZonaProp)
    try {
      const zpRes = await fetch(
        'https://www.tokkobroker.com/portals/api/v1/publication/?portal_id=4&limit=5',
        { headers, redirect: 'follow' }
      );
      const zpData = await zpRes.json();
      results.portal_4_sample = {
        total_count: zpData.meta?.total_count,
        sample: (zpData.objects || []).slice(0, 3).map((p: any) => ({
          id: p.id,
          property_id: p.property_id,
          has_stats: p.has_stats,
          status: p.status,
          category: p.category,
          url: p.url,
        })),
      };
    } catch (e: any) {
      results.portal_4_error = e.message;
    }

    // 4. Also try portal_id=24 (referenced in JS code)
    try {
      const p24Res = await fetch(
        'https://www.tokkobroker.com/portals/api/v1/publication/?portal_id=24&limit=5',
        { headers, redirect: 'follow' }
      );
      const p24Data = await p24Res.json();
      results.portal_24_sample = {
        total_count: p24Data.meta?.total_count,
        sample: (p24Data.objects || []).slice(0, 3).map((p: any) => ({
          id: p.id,
          property_id: p.property_id,
          has_stats: p.has_stats,
          status: p.status,
          category: p.category,
          url: p.url,
        })),
      };
    } catch (e: any) {
      results.portal_24_error = e.message;
    }

    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
