import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateReportMessage } from '@/lib/whatsapp';

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

  if (!id) {
    return res.status(400).json({ error: 'Missing report ID' });
  }

  try {
    const { data: report, error: fetchError } = await supabase
      .from('monthly_property_reports')
      .select(`
        *,
        properties (
          address,
          owners (
            name,
            phone,
            whatsapp
          )
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/reports/${id}/view`;

    const ownerName = report.properties.owners.name;
    const propertyAddress = report.properties.address;
    const phone = report.properties.owners.whatsapp || report.properties.owners.phone;

    const reportMonth = new Date(report.report_month).toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric'
    });

    const metrics = {
      total_views: report.metrics?.total_views || 0,
      leads_count: report.metrics?.leads_count || 0,
      visit_requests: report.metrics?.visit_requests || 0
    };

    const message = generateReportMessage(
      ownerName,
      propertyAddress,
      reportMonth,
      metrics,
      reportUrl
    );

    return res.status(200).json({
      success: true,
      phone: phone,
      message: message,
      report_url: reportUrl,
      owner_name: ownerName
    });

  } catch (error: any) {
    console.error('Error preparing report send:', error);
    return res.status(500).json({
      error: 'Failed to prepare report',
      details: error.message
    });
  }
}
