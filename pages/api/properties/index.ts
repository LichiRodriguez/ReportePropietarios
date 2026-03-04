import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    try {
      const { address, neighborhood, property_type, price, tokko_id, web_url } = req.body || {};

      if (!address) {
        return res.status(400).json({ error: 'La dirección es obligatoria' });
      }

      const { data, error } = await supabase
        .from('properties')
        .insert({
          address,
          neighborhood: neighborhood || null,
          property_type: property_type || 'sale',
          price: price || null,
          tokko_id: tokko_id || null,
          web_url: web_url || null,
          status: 'active',
          reports_enabled: true,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ property: data });
    } catch (err: any) {
      console.error('Error creating property:', err);
      return res.status(500).json({ error: err.message || 'Error interno al crear la propiedad' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
