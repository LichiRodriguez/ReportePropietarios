import type { NextApiRequest, NextApiResponse } from 'next';
import { ReportTemplateEngine } from '@/services/reportTemplateEngine';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
