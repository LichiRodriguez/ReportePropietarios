import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { TokkobrokerService } from '../../../../services/tokkobrokerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { tokko_id, web_url } = req.body || {};

    if (!tokko_id && !web_url) {
      return res.status(400).json({ error: 'tokko_id or web_url is required' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (tokko_id !== undefined) {
      updateData.tokko_id = tokko_id || null;
    }
    if (web_url !== undefined) {
      updateData.web_url = web_url || null;
    }

    // If tokko_id is provided, try to fetch data from Tokko API
    if (tokko_id) {
      const tokko = new TokkobrokerService();
      if (tokko.isConfigured()) {
        const tokkoProperty = await tokko.getProperty(tokko_id);
        if (tokkoProperty) {
          updateData.tokko_data = tokkoProperty;
          updateData.synced_at = new Date().toISOString();

          // Auto-fill web_url from Tokko if not provided
          if (!web_url && (tokkoProperty as any).web_url) {
            updateData.web_url = (tokkoProperty as any).web_url;
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, property: data });
  } catch (err: any) {
    console.error('Error linking property:', err);
    return res.status(500).json({ error: err.message || 'Error interno al vincular la propiedad' });
  }
}
