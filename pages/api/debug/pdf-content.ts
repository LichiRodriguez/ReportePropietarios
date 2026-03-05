import type { NextApiRequest, NextApiResponse } from 'next';
import { getDocumentProxy, extractText } from 'unpdf';
import { TokkobrokerService } from '../../../services/tokkobrokerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const propertyId = req.query.propertyId as string || '7385634';

  const tokko = new TokkobrokerService();

  if (!tokko.isSessionConfigured()) {
    return res.status(400).json({ error: 'TOKKO_USERNAME / TOKKO_PASSWORD not configured' });
  }

  try {
    // Download the PDF report
    const response = await (tokko as any).fetchDashboard(
      `/a/download_report/${propertyId}/?active_pubs=true&show_pub=true`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Tokko PDF download failed: ${response.status}`,
        statusText: response.statusText,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const pdfBuffer = await response.arrayBuffer();

    // Extract text from PDF
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pages = text.map((pageText: string, i: number) => ({
      page: i + 1,
      text: pageText,
    }));

    return res.status(200).json({
      propertyId,
      contentType,
      pdfSizeBytes: pdfBuffer.byteLength,
      totalPages,
      pages,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
}
