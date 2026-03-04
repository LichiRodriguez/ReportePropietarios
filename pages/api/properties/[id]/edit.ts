import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { address, neighborhood, price, tokko_id, web_url, owner_name, owner_phone } = req.body || {};

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update property fields
    const propertyUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (address !== undefined) propertyUpdate.address = address;
    if (neighborhood !== undefined) propertyUpdate.neighborhood = neighborhood || null;
    if (price !== undefined) propertyUpdate.price = price || null;
    if (tokko_id !== undefined) propertyUpdate.tokko_id = tokko_id || null;
    if (web_url !== undefined) propertyUpdate.web_url = web_url || null;

    const { data: property, error: propError } = await supabase
      .from('properties')
      .update(propertyUpdate)
      .eq('id', id)
      .select('*, owners:owner_id(id, name, phone, whatsapp, email)')
      .single();

    if (propError) {
      return res.status(500).json({ error: propError.message });
    }

    // Update owner fields if provided
    if (property.owner_id && (owner_name !== undefined || owner_phone !== undefined)) {
      const ownerUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (owner_name !== undefined) ownerUpdate.name = owner_name;
      if (owner_phone !== undefined) {
        ownerUpdate.phone = owner_phone;
        ownerUpdate.whatsapp = owner_phone;
      }

      const { error: ownerError } = await supabase
        .from('owners')
        .update(ownerUpdate)
        .eq('id', property.owner_id);

      if (ownerError) {
        return res.status(500).json({ error: ownerError.message });
      }
    }

    // Re-fetch with updated owner
    const { data: updated, error: fetchError } = await supabase
      .from('properties')
      .select('*, owners:owner_id(id, name, phone, whatsapp, email)')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    return res.status(200).json({ success: true, property: updated });
  } catch (err: any) {
    console.error('Error editing property:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
