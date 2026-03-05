import type { NextApiRequest, NextApiResponse } from 'next';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const propertyId = req.query.propertyId as string || '7385634';

  const tokko = new TokkobrokerService();

  if (!tokko.isSessionConfigured()) {
    return res.status(400).json({ error: 'TOKKO_USERNAME / TOKKO_PASSWORD not configured' });
  }

  const results: any = { propertyId };

  try {
    const sessionCookie = await (tokko as any).login();
    results.loginOk = true;

    const headers = {
      'Cookie': sessionCookie,
      'Referer': `https://www.tokkobroker.com/property/${propertyId}/`,
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1. Get portals list
    try {
      const portalsRes = await fetch('https://www.tokkobroker.com/portals/portals/', {
        headers,
        redirect: 'follow',
      });
      const portalsText = await portalsRes.text();
      results.portals_list = {
        status: portalsRes.status,
        contentType: portalsRes.headers.get('content-type'),
        preview: portalsText.substring(0, 3000),
      };
    } catch (e: any) {
      results.portals_list_error = e.message;
    }

    // 2. Get publications API
    try {
      const pubRes = await fetch('https://www.tokkobroker.com/portals/api/v1/publication/', {
        headers,
        redirect: 'follow',
      });
      const pubText = await pubRes.text();
      results.publications_api = {
        status: pubRes.status,
        contentType: pubRes.headers.get('content-type'),
        preview: pubText.substring(0, 3000),
      };
    } catch (e: any) {
      results.publications_api_error = e.message;
    }

    // 3. Get publications for specific property
    try {
      const pubPropRes = await fetch(
        `https://www.tokkobroker.com/portals/api/v1/publication/?property=${propertyId}`,
        { headers, redirect: 'follow' }
      );
      const pubPropText = await pubPropRes.text();
      results.publications_for_property = {
        status: pubPropRes.status,
        contentType: pubPropRes.headers.get('content-type'),
        preview: pubPropText.substring(0, 5000),
      };
    } catch (e: any) {
      results.publications_for_property_error = e.message;
    }

    // 4. Try defaults API
    try {
      const defRes = await fetch('https://www.tokkobroker.com/portals/api/v1/defaults/', {
        headers,
        redirect: 'follow',
      });
      const defText = await defRes.text();
      results.defaults_api = {
        status: defRes.status,
        contentType: defRes.headers.get('content-type'),
        preview: defText.substring(0, 2000),
      };
    } catch (e: any) {
      results.defaults_api_error = e.message;
    }

    // 5. Try portal config for ZonaProp (portal_id=24)
    try {
      const configRes = await fetch(
        `https://www.tokkobroker.com/portals/config?portal_id=24&subportal_id=0`,
        { headers, redirect: 'follow' }
      );
      const configText = await configRes.text();
      results.zonaprop_config = {
        status: configRes.status,
        contentType: configRes.headers.get('content-type'),
        preview: configText.substring(0, 2000),
      };
    } catch (e: any) {
      results.zonaprop_config_error = e.message;
    }

    // 6. Try common publication stat endpoints
    // We need to guess the pub_id - let's try some patterns
    const statEndpoints = [
      `/portals/24/publication/${propertyId}/stat`,
      `/portals/24/publication/${propertyId}/stats`,
      `/portals/zonaprop/publication/${propertyId}/stat`,
      `/portals/24/property/${propertyId}/stat`,
      `/portals/24/property/${propertyId}/stats`,
      `/portals/property_stats/${propertyId}/`,
      `/portals/property_stats/?property_id=${propertyId}`,
      `/portals/property/${propertyId}/stats/`,
      `/portals/stats/${propertyId}/`,
      `/portals/api/v1/publication/?property_id=${propertyId}`,
      `/portals/api/v1/publication/?prop=${propertyId}`,
    ];

    results.stat_endpoints = [];
    for (const ep of statEndpoints) {
      try {
        const epRes = await fetch(`https://www.tokkobroker.com${ep}`, {
          headers,
          redirect: 'follow',
        });
        const contentType = epRes.headers.get('content-type') || '';
        let preview = '';
        if (epRes.status !== 404) {
          const text = await epRes.text();
          preview = text.substring(0, 1000);
        }
        results.stat_endpoints.push({
          path: ep,
          status: epRes.status,
          contentType,
          preview: preview || null,
        });
      } catch (epErr: any) {
        results.stat_endpoints.push({ path: ep, error: epErr.message });
      }
    }

    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
