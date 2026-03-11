import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ReportTemplateEngine } from '@/services/reportTemplateEngine';
import { getTenantFromApiRequest } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tenant = await getTenantFromApiRequest(req);
    if (!tenant) return res.status(401).json({ error: 'No autorizado' });

    // Verify report belongs to this tenant
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: report } = await supabase
      .from('monthly_property_reports')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .single();
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const templateEngine = new ReportTemplateEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const html = await templateEngine.renderReport(id as string);

    const previewHtml = `
      <div style="background: #f59e0b; color: white; padding: 10px; text-align: center; font-family: sans-serif;">
        ⚠️ VISTA PREVIA - Este reporte aún no ha sido enviado
      </div>
      ${html}
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(previewHtml);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
