import type { GetServerSideProps } from 'next';

// Demo publico — no requiere autenticacion
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};

export default function DemoReport() {
  return (
    <div dangerouslySetInnerHTML={{ __html: demoHtml }} />
  );
}

const demoHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte al propietario - Demo</title>
  <style>
    :root { --primary: #1a5276; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #333; font-size: 15px; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }

    .demo-banner { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; text-align: center; padding: 16px; font-size: 14px; font-weight: 600; }
    .demo-banner a { color: #fbbf24; text-decoration: underline; }

    .report-header { margin-bottom: 28px; border-bottom: 3px solid var(--primary); padding-bottom: 16px; display: flex; align-items: center; gap: 16px; }
    .report-header .header-text h1 { font-size: 26px; color: var(--primary); font-weight: 700; margin-bottom: 4px; }
    .report-header .header-text .period { font-size: 16px; color: #555; }
    .report-header .header-text .period strong { color: #333; }
    .header-logo { height: 48px; width: auto; background: var(--primary); color: white; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 18px; display: flex; align-items: center; letter-spacing: -0.5px; }

    .property-card { display: flex; gap: 24px; margin-bottom: 32px; align-items: flex-start; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    .property-photo { width: 260px; height: 180px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: linear-gradient(135deg, #d1d5db, #9ca3af); display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 13px; }
    .property-info { flex: 1; padding: 4px 0; }
    .property-type { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .property-address { font-size: 20px; font-weight: 700; color: #333; margin-bottom: 4px; }
    .property-location { font-size: 14px; color: var(--primary); margin-bottom: 12px; }
    .property-features { display: flex; gap: 16px; margin-bottom: 12px; color: #555; font-size: 14px; }
    .property-operation { font-size: 13px; color: #777; }
    .property-price { font-size: 20px; font-weight: 700; color: #333; margin-top: 4px; }

    .section { margin-bottom: 32px; }
    .section-header { margin-bottom: 16px; }
    .section-title { font-size: 19px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
    .section-subtitle { font-size: 13px; color: #888; }

    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .metrics-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .metric-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 18px 14px; border-radius: 10px; text-align: center; }
    .metric-card .value { font-size: 34px; font-weight: 800; color: var(--primary); line-height: 1; }
    .metric-card .label { font-size: 13px; color: #555; margin-top: 6px; font-weight: 500; }
    .metric-card .change { font-size: 11px; margin-top: 4px; font-weight: 600; }
    .metric-card.secondary .value { color: #1e40af; }

    .funnel { display: flex; align-items: center; gap: 0; margin-bottom: 16px; }
    .funnel-step { flex: 1; text-align: center; padding: 16px 8px; }
    .funnel-step .funnel-value { font-size: 30px; font-weight: 800; color: var(--primary); line-height: 1; }
    .funnel-step .funnel-label { font-size: 12px; color: #555; margin-top: 6px; font-weight: 500; }
    .funnel-arrow { font-size: 24px; color: #d1d5db; flex-shrink: 0; padding: 0 4px; }
    .funnel-step:first-child { background: #fef2f2; border-radius: 10px 0 0 10px; border: 1px solid #fecaca; }
    .funnel-step:nth-child(3) { background: #fff7ed; border-top: 1px solid #fed7aa; border-bottom: 1px solid #fed7aa; }
    .funnel-step:last-child { background: #f0fdf4; border-radius: 0 10px 10px 0; border: 1px solid #bbf7d0; }
    .funnel-step:last-child .funnel-value { color: #16a34a; }

    .portal-exposure { margin-top: 20px; }
    .portal-exposure-title { font-size: 15px; font-weight: 600; color: var(--primary); margin-bottom: 12px; }
    .exposure-funnel { display: flex; gap: 0; align-items: stretch; margin-bottom: 16px; }
    .exposure-step { flex: 1; padding: 16px 12px; text-align: center; }
    .exposure-step .exp-value { font-size: 28px; font-weight: 700; }
    .exposure-step .exp-label { font-size: 11px; color: #666; margin-top: 2px; }
    .exposure-step .exp-segment { font-size: 10px; color: #999; margin-top: 4px; }
    .exposure-step:first-child { background: #fef2f2; border-radius: 10px 0 0 10px; border: 1px solid #fecaca; }
    .exposure-step:first-child .exp-value { color: #dc2626; }
    .exposure-step:nth-child(2) { background: #fff7ed; border-top: 1px solid #fed7aa; border-bottom: 1px solid #fed7aa; }
    .exposure-step:nth-child(2) .exp-value { color: #ea580c; }
    .exposure-step:last-child { background: #f0fdf4; border-radius: 0 10px 10px 0; border: 1px solid #bbf7d0; }
    .exposure-step:last-child .exp-value { color: #16a34a; }
    .portal-performance { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .perf-alto { background: #dcfce7; color: #166534; }

    .sources-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .source-tag { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #555; }

    .notes { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 16px 20px; font-size: 15px; line-height: 1.6; }

    .guide-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
    .guide-title { font-size: 17px; font-weight: 700; color: var(--primary); margin-bottom: 16px; }
    .guide-item { margin-bottom: 14px; }
    .guide-item .guide-label { font-weight: 600; font-size: 14px; color: #333; margin-bottom: 2px; }
    .guide-item .guide-text { font-size: 13px; color: #555; line-height: 1.5; }

    .footer { margin-top: 36px; padding-top: 24px; border-top: 2px solid #e5e7eb; }
    .footer-content { display: flex; gap: 24px; align-items: center; }
    .footer-agent .name { font-weight: 600; font-size: 14px; }
    .footer-agent .detail { font-size: 12px; color: #666; }
    .footer-company { flex: 1; text-align: right; }
    .footer-company .company-name { font-weight: 600; font-size: 14px; }
    .footer-note { text-align: center; padding: 16px 0; color: #999; font-size: 11px; }

    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0 28px; }

    @media (max-width: 600px) {
      .property-card { flex-direction: column; }
      .property-photo { width: 100%; }
      .metrics-grid, .metrics-grid-3 { grid-template-columns: repeat(2, 1fr); }
      .funnel { flex-direction: column; }
      .funnel-arrow { transform: rotate(90deg); }
      .funnel-step:first-child, .funnel-step:nth-child(3), .funnel-step:last-child { border-radius: 10px; border: 1px solid #e5e7eb; }
    }
  </style>
</head>
<body>
  <div class="demo-banner">
    Este es un reporte de ejemplo. Asi se ve el reporte que reciben tus propietarios cada mes.
  </div>

  <div class="container">
    <!-- Header -->
    <div class="report-header">
      <div class="header-logo">GP</div>
      <div class="header-text">
        <h1>Reporte al propietario</h1>
        <div class="period">Resumen de actividad del mes de <strong>febrero de 2026</strong> (ultimos 30 dias)</div>
      </div>
    </div>

    <!-- Property Card -->
    <div class="property-card">
      <div class="property-photo"><img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=520&h=360&fit=crop&q=80" alt="Departamento en Caballito" style="width:100%;height:100%;object-fit:cover;" /></div>
      <div class="property-info">
        <div class="property-type">Departamento</div>
        <div class="property-address">Av. Rivadavia 4500, 3ro B</div>
        <div class="property-location">📍 Caballito, CABA</div>
        <div class="property-features">
          <span>🏠 3 amb.</span>
          <span>🛏 2 dorm.</span>
          <span>🚿 1 baño</span>
        </div>
        <div class="property-operation">Venta</div>
        <div class="property-price">USD 128.000</div>
      </div>
    </div>

    <!-- SECCION 1: PORTALES -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">Actividad en portales inmobiliarios</div>
        <div class="section-subtitle">Datos de los ultimos 30 dias en ZonaProp, MercadoLibre, ArgenProp y otros portales</div>
      </div>

      <div class="funnel">
        <div class="funnel-step">
          <div class="funnel-value">847</div>
          <div class="funnel-label">Fichas enviadas</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-step">
          <div class="funnel-value">23</div>
          <div class="funnel-label">Consultas recibidas</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-step">
          <div class="funnel-value">9</div>
          <div class="funnel-label">Contactos directos</div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="value">847</div>
          <div class="label">Fichas enviadas por email</div>
        </div>
        <div class="metric-card">
          <div class="value">23</div>
          <div class="label">Personas interesadas</div>
        </div>
        <div class="metric-card">
          <div class="value">7</div>
          <div class="label">Mensajes por WhatsApp</div>
        </div>
        <div class="metric-card">
          <div class="value">2</div>
          <div class="label">Visitas coordinadas</div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <div style="font-size: 14px; color: #555; margin-bottom: 8px; font-weight: 600;">¿De donde llegaron los interesados?</div>
        <div class="sources-list">
          <span class="source-tag">ZonaProp: 12</span>
          <span class="source-tag">MercadoLibre: 6</span>
          <span class="source-tag">ArgenProp: 3</span>
          <span class="source-tag">Sitio web: 2</span>
        </div>
      </div>

      <!-- Portal stats -->
      <div class="portal-exposure" style="margin-top: 24px;">
        <div class="portal-exposure-title">📊 Rendimiento en ZonaProp (ultimos 30 dias)</div>
        <div class="exposure-funnel">
          <div class="exposure-step">
            <div class="exp-value">3.241</div>
            <div class="exp-label">Exposicion</div>
            <div class="exp-segment">Promedio: 2.100</div>
          </div>
          <div class="exposure-step">
            <div class="exp-value">186</div>
            <div class="exp-label">Vistas del aviso</div>
            <div class="exp-segment">Promedio: 95</div>
          </div>
          <div class="exposure-step">
            <div class="exp-value">12</div>
            <div class="exp-label">Contactos interesados</div>
            <div class="exp-segment">Promedio: 5</div>
          </div>
        </div>
        <div style="margin-top: 8px; text-align: center;">
          <span class="portal-performance perf-alto">Desempeño: Alto</span>
        </div>
      </div>
    </div>

    <hr class="divider" />

    <!-- SECCION 2: WEB -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">Actividad en nuestra pagina web</div>
        <div class="section-subtitle">Visitas, consultas y contactos en nuestro sitio web durante los ultimos 30 dias</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card secondary">
          <div class="value">64</div>
          <div class="label">Veces que se vio su propiedad</div>
          <div class="change" style="color: #22c55e;">↑ +18.5% vs mes anterior</div>
        </div>
        <div class="metric-card secondary">
          <div class="value">41</div>
          <div class="label">Personas diferentes que la vieron</div>
        </div>
        <div class="metric-card secondary">
          <div class="value">3</div>
          <div class="label">Consultas recibidas</div>
          <div class="change" style="color: #22c55e;">↑ +50.0%</div>
        </div>
        <div class="metric-card secondary">
          <div class="value">8</div>
          <div class="label">Guardada como favorita</div>
        </div>
      </div>
    </div>

    <!-- EN TOTAL -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">En total</div>
        <div class="section-subtitle">Sumando todos los portales y nuestra pagina web</div>
      </div>
      <div class="metrics-grid-3">
        <div class="metric-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="value" style="font-size: 38px;">3.305</div>
          <div class="label">Vistas</div>
        </div>
        <div class="metric-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="value" style="font-size: 38px;">227</div>
          <div class="label">Personas que la vieron</div>
        </div>
        <div class="metric-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="value" style="font-size: 38px;">26</div>
          <div class="label">Consultas</div>
        </div>
      </div>
    </div>

    <!-- Nota del agente -->
    <div class="section">
      <div class="section-title">Comentario de su agente</div>
      <div class="notes">
        Hola Maria! Excelente mes para tu departamento. Las visitas en ZonaProp estan muy por encima del promedio de la zona, lo cual confirma que el precio esta bien posicionado. Coordinamos 2 visitas presenciales esta semana, ambas con muy buena devolucion. Seguimos trabajando para conseguir una oferta concreta. Cualquier duda me escribis!
      </div>
    </div>

    <!-- Guia -->
    <div class="guide-section">
      <div class="guide-title">Maria, ¿que significa cada numero?</div>

      <div class="guide-item">
        <div class="guide-label">📬 Fichas enviadas</div>
        <div class="guide-text">Cuantas personas recibieron los datos de tu propiedad. Mas fichas = mas gente viendo tu aviso.</div>
      </div>

      <div class="guide-item">
        <div class="guide-label">💬 Consultas</div>
        <div class="guide-text">Cada consulta es alguien que pidio mas informacion. Ya sea que coordinamos una visita o no, nos hemos contactado y conversamos sobre tu propiedad.</div>
      </div>

      <div class="guide-item">
        <div class="guide-label">📱 Contactos directos</div>
        <div class="guide-text">Los que nos escribieron por WhatsApp o pidieron visita. Son los mas interesados.</div>
      </div>

      <div class="guide-item">
        <div class="guide-label">📈 Rendimiento en portales</div>
        <div class="guide-text">Cuantas veces aparecio tu aviso en busquedas, cuantos lo abrieron y cuantos nos contactaron. El "promedio" te compara con propiedades similares de la zona.</div>
      </div>

      <div class="guide-item">
        <div class="guide-label">🌐 Nuestra web</div>
        <div class="guide-text">Visitas a tu propiedad en nuestro sitio web, personas distintas que la vieron, y consultas recibidas.</div>
      </div>

      <div class="guide-item">
        <div class="guide-text" style="margin-top: 8px; color: #333;">Tu propiedad esta activa y trabajando en multiples canales. Si tenes alguna duda, escribinos y lo charlamos.</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-content">
        <div class="footer-agent">
          <div>
            <div class="name">Carlos Gutierrez</div>
            <div class="detail">Agente inmobiliario</div>
          </div>
        </div>
        <div class="footer-company">
          <div class="company-name">Gutierrez Propiedades</div>
          <div class="detail">Caballito, CABA</div>
        </div>
      </div>
      <div class="footer-note">
        Reporte generado el 01/03/2026 | Datos de los ultimos 30 dias | Confidencial
      </div>
    </div>
  </div>
</body>
</html>
`;
