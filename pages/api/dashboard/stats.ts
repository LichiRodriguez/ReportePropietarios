import type { NextApiRequest, NextApiResponse } from 'next';
import { getTenantFromApiRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenant = await getTenantFromApiRequest(req);
  if (!tenant) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

  const [propsRes, reportsRes, sentRes, pendingRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id),
    supabase
      .from('monthly_property_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .gte('report_month', monthStart)
      .lt('report_month', nextMonth),
    supabase
      .from('monthly_property_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('status', 'sent')
      .gte('report_month', monthStart)
      .lt('report_month', nextMonth),
    supabase
      .from('monthly_property_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .in('status', ['draft', 'reviewed'])
      .gte('report_month', monthStart)
      .lt('report_month', nextMonth),
  ]);

  return res.status(200).json({
    total_properties: propsRes.count || 0,
    reports_generated: reportsRes.count || 0,
    reports_sent: sentRes.count || 0,
    reports_pending: pendingRes.count || 0,
  });
}
