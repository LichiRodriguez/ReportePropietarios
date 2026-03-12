import type { NextApiRequest, NextApiResponse } from 'next';
import { ReportGenerationService } from '@/services/reportGenerationService';
import { getTenantFromApiRequest } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenant = await getTenantFromApiRequest(req);
  if (!tenant) return res.status(401).json({ error: 'No autorizado' });

  const { property_id, month, force } = req.body;

  try {
    const service = new ReportGenerationService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.SEARCH_ENGINE_URL!,
      {
        tenantId: tenant.id,
        tokkoApiKey: tenant.tokko_api_key,
        gaPropertyId: tenant.ga_property_id,
        gaCredentialsBase64: tenant.ga_credentials_base64,
      }
    );

    if (property_id) {
      const reportMonth = month ? new Date(month) : undefined;

      // If force=true, delete existing report for this property+month first
      if (force) {
        await service.deleteExistingReport(property_id, reportMonth || new Date());
      }

      const reportId = await service.generatePropertyReport(
        property_id,
        reportMonth || new Date()
      );

      return res.status(200).json({
        success: true,
        report_id: reportId
      });
    } else {
      // If force=true, delete all existing reports for the month before regenerating
      if (force) {
        await service.deleteExistingReportsForMonth(month ? new Date(month) : undefined);
      }

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
