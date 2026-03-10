import type { NextApiRequest, NextApiResponse } from 'next';
import { ReportTemplateEngine } from '@/services/reportTemplateEngine';
import { generatePdfFromHtml } from '@/lib/pdfGenerator';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing report ID' });
  }

  try {
    const templateEngine = new ReportTemplateEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const html = await templateEngine.renderReport(id);
    const pdfBuffer = await generatePdfFromHtml(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="reporte-${id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: error.message });
  }
}
