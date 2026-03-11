import type { NextApiRequest, NextApiResponse } from 'next';
import { TokkobrokerService } from '../../../services/tokkobrokerService';
import { getTenantFromApiRequest } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenant = await getTenantFromApiRequest(req);
  if (!tenant) return res.status(401).json({ error: 'No autorizado' });

  const tokko = new TokkobrokerService();

  if (!tokko.isConfigured()) {
    return res.status(200).json({
      configured: false,
      properties: [],
      message: 'TOKKO_API_KEY no está configurada. Podés vincular manualmente ingresando el ID de Tokko.',
    });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const properties = await tokko.getProperties({ limit, offset });

    return res.status(200).json({
      configured: true,
      properties: properties.map((p: any) => ({
        id: p.id,
        address: p.address || p.fake_address || '',
        reference_code: p.reference_code || '',
        publication_title: p.publication_title || '',
        status: p.status,
        price: p.operations?.[0]?.prices?.[0]?.price || p.price || 0,
        currency: p.operations?.[0]?.prices?.[0]?.currency || '',
        web_url: p.web_url || '',
        photos: (p.photos || []).slice(0, 1).map((ph: any) => ph.thumb || ph.image || ''),
      })),
      total: properties.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
