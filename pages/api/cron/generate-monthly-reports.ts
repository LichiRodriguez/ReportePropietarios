import type { NextApiRequest, NextApiResponse } from 'next';
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

    const service = new ReportGenerationService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.SEARCH_ENGINE_URL!
    );

    const result = await service.generateMonthlyReports({
      autoNotify: true
    });

    console.log('Generacion completada:', result);

    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error en generacion de reportes:', error);

    return res.status(500).json({
      error: 'Failed to generate reports',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
