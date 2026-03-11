export function generateReportMessage(
  ownerName: string,
  propertyAddress: string,
  reportMonth: string,
  pdfUrl: string
): string {
  const firstName = ownerName.split(' ')[0];
  return (
    `Hola ${firstName}, le comparto el reporte mensual de su propiedad ` +
    `en ${propertyAddress} correspondiente a ${reportMonth}.\n\n` +
    `${pdfUrl}\n\n` +
    `Quedo a disposicion por cualquier consulta.\nSaludos.`
  );
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
