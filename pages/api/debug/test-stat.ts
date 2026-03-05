import type { NextApiRequest, NextApiResponse } from 'next';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pubId = req.query.pubId as string || '14233';
  const portalId = req.query.portalId as string || '4';
  const propertyId = req.query.propertyId as string || '7385634';

  const tokko = new TokkobrokerService();

  if (!tokko.isSessionConfigured()) {
    return res.status(400).json({ error: 'TOKKO_USERNAME / TOKKO_PASSWORD not configured' });
  }

  const results: any = { pubId, portalId, propertyId };

  try {
    const sessionCookie = await (tokko as any).login();
    results.loginOk = true;

    const headers = {
      'Cookie': sessionCookie,
      'Referer': `https://www.tokkobroker.com/property/${propertyId}/`,
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1. First get publications for this specific property on ZonaProp (portal_id=4)
    try {
      const pubRes = await fetch(
        `https://www.tokkobroker.com/portals/api/v1/publication/?portal_id=${portalId}&property_id=${propertyId}&limit=100`,
        { headers, redirect: 'follow' }
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
          status_id: p.status_id,
          url: p.url,
          category: p.category,
          operation: p.operation,
        })),
      };
    } catch (e: any) {
      results.property_publications_error = e.message;
    }

    // 2. Try ALL possible stat endpoint patterns with the given pub_id
    const endpoints = [
      `/portals/${portalId}/publication/${pubId}/stat`,
      `/portals/${portalId}/publication/${pubId}/stat/`,
      `/portals/${portalId}/publication/${pubId}/stats`,
      `/portals/${portalId}/publication/${pubId}/stats/`,
      `/portals/publication/${pubId}/stat`,
      `/portals/publication/${pubId}/stat/`,
      `/portals/publication_stat/${pubId}/`,
      `/portals/publication_stats/${pubId}/`,
      `/portals/api/v1/publication/${pubId}/stat`,
      `/portals/api/v1/publication/${pubId}/stat/`,
      `/portals/api/v1/publication/${pubId}/stats`,
      `/portals/api/v1/publication/${pubId}/stats/`,
      `/portals/api/v1/publication_stat/?publication_id=${pubId}`,
      `/portals/stat/publication/${pubId}/`,
      `/portals/stats/publication/${pubId}/`,
      // Try with Accept: text/html in case it returns HTML with embedded data
    ];

    results.stat_attempts = [];
    for (const ep of endpoints) {
      try {
        const statRes = await fetch(`https://www.tokkobroker.com${ep}`, {
          headers: {
            ...headers,
            'Accept': 'application/json, text/html, */*',
          },
          redirect: 'follow',
        });
        const contentType = statRes.headers.get('content-type') || '';
        let body = '';
        if (statRes.status !== 404) {
          const text = await statRes.text();
          body = text.substring(0, 3000);
        }
        results.stat_attempts.push({
          endpoint: ep,
          status: statRes.status,
          contentType,
          bodyPreview: body || undefined,
        });
      } catch (err: any) {
        results.stat_attempts.push({ endpoint: ep, error: err.message });
      }
    }

    // 3. Also try with portal_id=4 specific endpoints
    const zpEndpoints = [
      `/portals/zonaprop/stat/${pubId}/`,
      `/portals/zonaprop/stats/${pubId}/`,
      `/portals/zonaprop/publication_stat/${pubId}/`,
      `/portals/4/stat/${pubId}/`,
      `/portals/4/stats/${pubId}/`,
    ];

    for (const ep of zpEndpoints) {
      try {
        const statRes = await fetch(`https://www.tokkobroker.com${ep}`, {
          headers,
          redirect: 'follow',
        });
        if (statRes.status !== 404) {
          const text = await statRes.text();
          results.stat_attempts.push({
            endpoint: ep,
            status: statRes.status,
            contentType: statRes.headers.get('content-type') || '',
            bodyPreview: text.substring(0, 3000),
          });
        }
      } catch (err: any) {
        // skip
      }
    }

    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
