import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { property_id } = req.body;

  if (!property_id) {
    return res.status(400).json({ error: 'property_id is required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the property from database
  const { data: property, error: fetchError } = await supabase
    .from('properties')
    .select('id, tokko_id, web_url')
    .eq('id', property_id)
    .single();

  if (fetchError || !property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  if (!property.tokko_id) {
    return res.status(400).json({ error: 'Property has no tokko_id linked' });
  }

  const tokko = new TokkobrokerService();
  if (!tokko.isConfigured()) {
    return res.status(400).json({ error: 'TOKKO_API_KEY not configured' });
  }

  const tokkoProperty = await tokko.getProperty(property.tokko_id);
  if (!tokkoProperty) {
    return res.status(404).json({ error: `Tokko property ${property.tokko_id} not found` });
  }

  // Update database with Tokko data
  const updateData: Record<string, any> = {
    tokko_data: tokkoProperty,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Auto-fill web_url if available from Tokko
  if (!property.web_url && (tokkoProperty as any).web_url) {
    updateData.web_url = (tokkoProperty as any).web_url;
  }

  const { error: updateError } = await supabase
    .from('properties')
    .update(updateData)
    .eq('id', property_id);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  return res.status(200).json({
    success: true,
    tokko_data: tokkoProperty,
    synced_at: updateData.synced_at,
  });
}
