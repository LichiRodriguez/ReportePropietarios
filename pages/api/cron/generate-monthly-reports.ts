import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ReportGenerationService } from '@/services/reportGenerationService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Iniciando generacion de reportes mensuales...');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener todos los tenants activos
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, tokko_api_key, ga_property_id, ga_credentials_base64');

    if (tenantsError || !tenants || tenants.length === 0) {
      console.log('No hay tenants configurados');
      return res.status(200).json({ success: true, message: 'No tenants found' });
    }

    const allResults: { tenant: string; result: any }[] = [];

    for (const tenant of tenants) {
      try {
        console.log(`Generando reportes para tenant: ${tenant.name} (${tenant.id})`);

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

        const result = await service.generateMonthlyReports({
          autoNotify: true,
        });

        allResults.push({ tenant: tenant.name, result });
        console.log(`Tenant ${tenant.name}: ${result.reports_generated}/${result.total_properties} reportes generados`);
      } catch (tenantError: any) {
        console.error(`Error generando reportes para tenant ${tenant.name}:`, tenantError);
        allResults.push({ tenant: tenant.name, result: { error: tenantError.message } });
      }
    }

    console.log('Generacion completada para todos los tenants');

    return res.status(200).json({
      success: true,
      tenants_processed: tenants.length,
      results: allResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error en generacion de reportes:', error);

    return res.status(500).json({
      error: 'Failed to generate reports',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
