import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateReportMessage } from '@/lib/whatsapp';
import { getTenantFromApiRequest } from '@/lib/auth';

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

  const tenant = await getTenantFromApiRequest(req);
  if (!tenant) return res.status(401).json({ error: 'No autorizado' });

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
      .eq('tenant_id', tenant.id)
      .single();

    if (fetchError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Construir la URL base desde los headers del request para evitar depender de NEXT_PUBLIC_APP_URL
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers.host;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    const pdfUrl = `${baseUrl}/api/reports/${id}/pdf`;

    const owner = report.properties?.owners;
    const propertyAddress = report.properties?.address || 'Direccion no disponible';

    if (!owner) {
      return res.status(400).json({ error: 'Report has no associated owner' });
    }

    const phone = owner.whatsapp || owner.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Owner has no phone or WhatsApp number configured' });
    }

    const ownerName = owner.name || 'Propietario';

    const reportMonth = new Date(report.report_month).toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric'
    });

    const message = generateReportMessage(
      ownerName,
      propertyAddress,
      reportMonth,
      pdfUrl
    );

    return res.status(200).json({
      success: true,
      phone: phone,
      message: message,
      pdf_url: pdfUrl,
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
