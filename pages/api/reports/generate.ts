import type { NextApiRequest, NextApiResponse } from 'next';
import { ReportGenerationService } from '@/services/reportGenerationService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { property_id, month } = req.body;

  try {
    const service = new ReportGenerationService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.SEARCH_ENGINE_URL!
    );

    if (property_id) {
      const reportMonth = month ? new Date(month) : undefined;
      const reportId = await service.generatePropertyReport(
        property_id,
        reportMonth || new Date()
      );

      return res.status(200).json({
        success: true,
        report_id: reportId
      });
    } else {
      const result = await service.generateMonthlyReports({
        month: month ? new Date(month) : undefined
      });

      return res.status(200).json(result);
    }
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to generate report',
      details: error.message
    });
  }
}
