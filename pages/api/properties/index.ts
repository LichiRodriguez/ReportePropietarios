import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          address,
          neighborhood,
          property_type,
          price,
          status,
          tokko_id,
          tokko_data,
          web_url,
          synced_at,
          owner_id,
          owners:owner_id (
            id,
            name,
            phone,
            whatsapp,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ properties: data });
    }

    if (req.method === 'POST') {
      const { address, neighborhood, property_type, price, tokko_id, web_url } = req.body || {};

      if (!address) {
        return res.status(400).json({ error: 'La dirección es obligatoria' });
      }

      // Build insert data
      const insertData: Record<string, any> = {
        address,
        neighborhood: neighborhood || null,
        property_type: property_type || 'sale',
        price: price || null,
        tokko_id: tokko_id || null,
        web_url: web_url || null,
        status: 'active',
        reports_enabled: true,
      };

      // If tokko_id provided, fetch Tokko data and link in the same step
      if (tokko_id) {
        const tokko = new TokkobrokerService();
        if (tokko.isConfigured()) {
          const tokkoProperty = await tokko.getProperty(tokko_id);
          if (tokkoProperty) {
            insertData.tokko_data = tokkoProperty;
            insertData.synced_at = new Date().toISOString();
            if (!web_url && (tokkoProperty as any).web_url) {
              insertData.web_url = (tokkoProperty as any).web_url;
            }
          }
        }
      }

      const { data, error } = await supabase
        .from('properties')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ property: data });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err: any) {
    console.error('API /api/properties error:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
}
