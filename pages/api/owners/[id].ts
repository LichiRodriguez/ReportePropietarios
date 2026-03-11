import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getTenantFromApiRequest } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tenant = await getTenantFromApiRequest(req);
    if (!tenant) return res.status(401).json({ error: 'No autorizado' });

    const { id } = req.query;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get owner
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .single();

    if (ownerError) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    // Get owner's properties
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id, address, neighborhood, property_type, price, status, tokko_id, web_url')
      .eq('owner_id', id)
      .order('created_at', { ascending: false });

    if (propError) {
      return res.status(500).json({ error: propError.message });
    }

    // Get all reports for this owner's properties
    const propertyIds = (properties || []).map(p => p.id);

    let reports: any[] = [];
    if (propertyIds.length > 0) {
      const { data: reportData, error: reportError } = await supabase
        .from('monthly_property_reports')
        .select(`
          id,
          report_month,
          status,
          metrics,
          custom_notes,
          generated_at,
          sent_at,
          property_id,
          properties:property_id (address)
        `)
        .in('property_id', propertyIds)
        .order('report_month', { ascending: false });

      if (reportError) {
        console.error('Error fetching reports:', reportError);
      } else {
        reports = reportData || [];
      }
    }

    // Get delivery records for the reports
    const reportIds = reports.map(r => r.id);
    let deliveries: any[] = [];
    if (reportIds.length > 0) {
      const { data: deliveryData } = await supabase
        .from('report_deliveries')
        .select('*')
        .in('report_id', reportIds)
        .order('sent_at', { ascending: false });

      deliveries = deliveryData || [];
    }

    return res.status(200).json({
      owner,
      properties: properties || [],
      reports,
      deliveries,
    });
  } catch (err: any) {
    console.error('Error fetching owner:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
