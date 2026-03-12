# Informe Propietarios - Contexto del Proyecto

## Descripcion General

Sistema de reportes automaticos mensuales para propietarios de una inmobiliaria.
Genera reportes HTML con metricas de portales (TokkoBoker), trafico web (Google Analytics)
y analisis de mercado, y los envia por WhatsApp.

## Tech Stack

- **Framework**: Next.js 14 con Pages Router (NO App Router)
- **Lenguaje**: TypeScript
- **Base de datos**: Supabase (PostgreSQL) con RLS habilitado
- **Templates**: Handlebars para reportes HTML
- **APIs externas**: TokkoBoker REST API, Google Analytics Data API v1
- **Deploy**: Vercel con cron job (1ro de cada mes)
- **Comunicacion**: WhatsApp Web (semi-automatico)

## Estructura del Proyecto

```
pages/                    # Next.js pages y API routes
  index.tsx               # Home con links de navegacion
  reports.tsx             # Dashboard de reportes
  import.tsx              # Importador CSV de propietarios/propiedades
  vincular.tsx            # Vinculacion de propiedades con Tokko
  propietario/[id].tsx    # Detalle de propietario
  api/
    cron/generate-monthly-reports.ts   # Cron job (Bearer CRON_SECRET)
    import/owners-properties.ts        # Import CSV
    owners/[id].ts                     # CRUD propietarios
    properties/                        # CRUD propiedades
    reports/                           # Generacion, listado, preview, envio
    tokko/                             # Sync con TokkoBoker

services/                 # Logica de negocio
  reportGenerationService.ts    # Orquestacion principal de generacion
  reportTemplateEngine.ts       # Rendering Handlebars de reportes HTML
  googleAnalyticsService.ts     # Google Analytics Data API
  tokkobrokerService.ts         # TokkoBoker API client
  propertyMetricsService.ts     # Agregacion de metricas
  marketAnalysisService.ts      # Analisis de mercado y comparacion

components/
  ReportsPanel.tsx        # UI principal del panel de reportes

lib/
  whatsapp.ts             # Generacion de mensajes WhatsApp
```

## Base de Datos (Supabase)

8 tablas principales:
- **owners**: Propietarios (name, email, phone, whatsapp)
- **properties**: Propiedades (address, neighborhood, price, tokko_id, web_url, owner_id)
- **property_metrics**: Metricas diarias por propiedad
- **monthly_property_metrics**: Metricas mensuales agregadas (JSONB)
- **monthly_property_reports**: Reportes generados (status: draft/reviewed/sent)
- **report_templates**: Templates HTML/WhatsApp
- **report_deliveries**: Tracking de envios
- **traffic_sources**: Fuentes de trafico

Migraciones SQL en archivos `supabase_migration_*.sql` en la raiz.

## Variables de Entorno

```env
# Obligatorias
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEARCH_ENGINE_URL=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=

# Opcionales (integraciones)
TOKKO_API_KEY=
GOOGLE_ANALYTICS_CREDENTIALS_PATH=      # Local: path al JSON
GOOGLE_ANALYTICS_CREDENTIALS_BASE64=     # Produccion: JSON en base64
GA_PROPERTY_ID=
RESEND_API_KEY=                          # Para envio de emails de notificacion
RESEND_FROM_EMAIL=                       # Ej: Reportes <reportes@tudominio.com>
```

Para Vercel, las credenciales de Google Analytics van en base64 (GOOGLE_ANALYTICS_CREDENTIALS_BASE64).

## API Endpoints

| Metodo | Ruta | Funcion |
|--------|------|---------|
| POST | /api/cron/generate-monthly-reports | Cron mensual (requiere Bearer CRON_SECRET) |
| POST | /api/reports/generate | Generar reportes (por propiedad o todos) |
| GET | /api/reports/pending | Listar reportes pendientes |
| GET | /api/reports/[id]/preview | Preview HTML con banner |
| GET | /api/reports/[id]/view | Vista final del reporte |
| POST | /api/reports/[id]/prepare-send | Obtener mensaje WhatsApp + telefono |
| POST | /api/reports/[id]/mark-sent | Marcar como enviado |
| POST | /api/reports/[id]/notes | Editar notas personalizadas |
| POST | /api/import/owners-properties | Import CSV masivo |
| GET/POST | /api/properties | CRUD propiedades |
| POST | /api/properties/[id]/link | Vincular con Tokko |
| GET | /api/tokko/properties | Listar propiedades Tokko |
| POST | /api/tokko/sync-property | Sincronizar propiedad Tokko |

## Flujo Principal

1. **Cron job** (dia 1 de cada mes) genera reportes para todas las propiedades activas
2. Cada reporte agrega metricas de Tokko + Google Analytics + DB interna
3. Se genera HTML con Handlebars y se guarda en Supabase como draft
4. El usuario revisa reportes en `/reports`, edita notas si quiere
5. Envia por WhatsApp (se abre WhatsApp Web con mensaje pre-armado)
6. Marca como enviado

## Convenciones de Codigo

- API routes usan Supabase con service_role key (backend)
- Frontend usa anon key via NEXT_PUBLIC_
- Todas las tablas tienen RLS habilitado con politicas para service_role
- Los reportes almacenan metricas como JSONB para flexibilidad
- Handlebars helpers personalizados: formatNumber, formatCurrency, formatPercent, trendIcon, trendColor
- Idioma del proyecto: Espanol (Argentina)

## Comandos

```bash
npm run dev      # Servidor de desarrollo en localhost:3000
npm run build    # Build de produccion
npm run start    # Servidor de produccion
```

## Deploy (Vercel)

- vercel.json configura el cron: `0 0 1 * *` en `/api/cron/generate-monthly-reports`
- Variables de entorno se configuran en Vercel Dashboard > Settings > Environment Variables
- Google Analytics credentials van como base64 en GOOGLE_ANALYTICS_CREDENTIALS_BASE64
- NEXT_PUBLIC_APP_URL debe apuntar a la URL de Vercel en produccion

## Integraciones

### TokkoBoker
- API REST para metricas de portales inmobiliarios (ZonaProp, MercadoLibre, ArgenProp)
- Cada propiedad se vincula via `tokko_id` en la tabla properties
- UI de vinculacion en `/vincular`

### Google Analytics
- Google Analytics Data API v1 (BetaAnalyticsDataClient)
- Service account con permisos de Viewer en la propiedad GA4
- Metricas: pageviews, unique_visitors, avg_session_duration, bounce_rate
- Autenticacion: JSON file (local) o base64 (Vercel)

### WhatsApp
- Genera mensajes con metricas clave + link al reporte
- Abre WhatsApp Web con mensaje pre-llenado
- Tracking de envio en report_deliveries

## Generacion de PDF (lib/pdfGenerator.ts)

- El endpoint `/api/reports/[id]/pdf` genera el PDF on-demand con Puppeteer y lo devuelve como `application/pdf`
- El link al PDF va incluido en el mensaje de WhatsApp (sin almacenamiento en disco ni Supabase Storage)
- `vercel.json` configura 1024 MB de memoria y 60s de timeout para ese endpoint

### Como funciona segun entorno

| Entorno | Chromium |
|---------|----------|
| Local (macOS dev) | Chrome del sistema en `/Applications/Google Chrome.app/...` |
| Vercel (produccion) | `@sparticuz/chromium-min` descarga el binario en runtime |

### Regla critica: NO usar propiedades de @sparticuz/chromium que no existen en chromium-min

Usamos `@sparticuz/chromium-min` (version liviana). Este paquete **NO tiene** la propiedad `defaultViewport` — esa solo existe en el paquete completo `@sparticuz/chromium`.

**NUNCA escribir:**
```ts
defaultViewport: chromium.defaultViewport  // ERROR de TypeScript en build
```

**SIEMPRE usar viewport fijo:**
```ts
defaultViewport: { width: 1280, height: 800 }
```

Este error rompe el build de Vercel con `Command "npm run build" exited with 1` y un Type error sobre `defaultViewport`.

Propiedades disponibles en `@sparticuz/chromium-min`:
- `chromium.args` — array de flags para el browser
- `chromium.executablePath(url?)` — funcion async que descarga y devuelve el path al binario

## Troubleshooting Comun

- Si falta algun modulo: `npm install`
- Si las tablas no existen: ejecutar migraciones SQL en Supabase SQL Editor
- Si Google Analytics da Permission denied: verificar que el service account este como Viewer en GA4
- Si Tokko da 401: verificar TOKKO_API_KEY
- Si el cron no corre en Vercel: verificar vercel.json y que el plan soporte crons
- **Si el build de Vercel falla con Type error en pdfGenerator.ts**: ver seccion "Generacion de PDF" arriba — probablemente se uso `chromium.defaultViewport` que no existe en chromium-min
