import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { phone } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing report ID' });
  }

  try {
    const { error: updateError } = await supabase
      .from('monthly_property_reports')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    await supabase.from('report_deliveries').insert({
      report_id: id,
      delivery_method: 'whatsapp',
      recipient_phone: phone,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Report marked as sent'
    });

  } catch (error: any) {
    console.error('Error marking report as sent:', error);
    return res.status(500).json({
      error: 'Failed to mark report as sent',
      details: error.message
    });
  }
}
