import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getTenantFromApiRequest } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenant = await getTenantFromApiRequest(req);
  if (!tenant) return res.status(401).json({ error: 'No autorizado' });

  try {
    const { data, error } = await supabase
      .from('monthly_property_reports')
      .select(`
        *,
        properties (
          address,
          price,
          owners (
            name,
            phone,
            whatsapp
          )
        )
      `)
      .eq('tenant_id', tenant.id)
      .in('status', ['draft', 'reviewed', 'sent'])
      .order('generated_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
