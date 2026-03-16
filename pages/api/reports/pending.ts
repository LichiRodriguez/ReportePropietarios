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
    // Filtro por mes: ?month=2026-03 (default: mes actual)
    let monthParam = req.query.month as string | undefined;
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      const now = new Date();
      monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const monthStart = `${monthParam}-01`;
    const [y, m] = monthParam.split('-').map(Number);
    const next = new Date(y, m, 1);
    const monthEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;

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
      .gte('report_month', monthStart)
      .lt('report_month', monthEnd)
      .order('generated_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
