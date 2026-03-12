import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReportSummary {
  tenantName: string;
  companyName: string | null;
  reportsGenerated: number;
  totalProperties: number;
  reportMonth: string;
  appUrl: string;
}

export async function sendMonthlyReportsReadyEmail(
  to: string,
  summary: ReportSummary
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY no configurada, saltando envio de email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const monthName = new Date(summary.reportMonth + '-01').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const displayName = summary.companyName || summary.tenantName;

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Reportes <reportes@resend.dev>',
      to: [to],
      subject: `Reportes de ${monthName} listos para revisar`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header { background: #1e40af; color: white; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; }
    .stat { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .stat .number { font-size: 36px; font-weight: 800; color: #1e40af; }
    .stat .label { font-size: 14px; color: #555; margin-top: 4px; }
    .text { font-size: 15px; color: #333; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
    .footer { padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reportes mensuales listos</h1>
    </div>
    <div class="body">
      <p class="text">Hola! Los reportes de <strong>${monthName}</strong> para <strong>${displayName}</strong> ya fueron generados.</p>

      <div class="stat">
        <div class="number">${summary.reportsGenerated}</div>
        <div class="label">reportes generados de ${summary.totalProperties} propiedades</div>
      </div>

      <p class="text">Ya podes revisarlos, editar las notas personalizadas y enviarlos por WhatsApp a tus propietarios.</p>

      <div style="text-align: center;">
        <a class="btn" href="${summary.appUrl}/reports">Revisar reportes</a>
      </div>
    </div>
    <div class="footer">
      Mensaje automatico del sistema de reportes
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Error enviando email de notificacion:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email de notificacion enviado a ${to}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error enviando email:', err);
    return { success: false, error: err.message };
  }
}
