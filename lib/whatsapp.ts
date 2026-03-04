interface ReportMetrics {
  total_views: number;
  leads_count: number;
  visit_requests: number;
}

export function generateReportMessage(
  ownerName: string,
  propertyAddress: string,
  reportMonth: string,
  metrics: ReportMetrics,
  reportUrl: string
): string {
  const message = `Hola ${ownerName}! 👋

Le comparto el reporte mensual de su propiedad en *${propertyAddress}* correspondiente a *${reportMonth}*.

📊 *Resumen del mes:*
• ${metrics.total_views} visualizaciones
• ${metrics.leads_count} consultas recibidas
• ${metrics.visit_requests} solicitudes de visita

📄 Puede ver el reporte completo aquí:
${reportUrl}

Quedo a disposición por cualquier consulta.
¡Saludos!`;

  return message;
}

export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  const phoneWithCountry = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
}

export function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (!cleaned.startsWith('54')) {
    cleaned = `54${cleaned}`;
  }

  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    cleaned = `549${cleaned.substring(2)}`;
  }

  return cleaned;
}
