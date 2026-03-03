# Sistema de Reportes Automaticos - Inmobiliaria

Sistema completo de generacion automatica de reportes mensuales para propietarios.

## Features

- Generacion automatica mensual via cron job
- Integracion con TokkoBoker para metricas de portales
- Integracion con Google Analytics para trafico web
- Panel de revision y edicion de reportes
- Envio semi-automatico por WhatsApp Web
- Analisis de mercado automatico
- Templates personalizables

## Setup

1. Configurar variables de entorno en `.env.local`
2. Ejecutar migracion SQL en Supabase
3. `npm install`
4. `npm run dev`
5. Visitar http://localhost:3000/reports

## Configuracion Requerida

### Variables de Entorno Minimas
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEARCH_ENGINE_URL=
CRON_SECRET=
```

### Variables Opcionales
```env
TOKKO_API_KEY=
GOOGLE_ANALYTICS_CREDENTIALS_PATH=
GA_PROPERTY_ID=
```

## Uso

1. Los reportes se generan automaticamente el dia 1 de cada mes
2. Revisa los reportes en `/reports`
3. Edita notas personalizadas si es necesario
4. Envia a propietarios por WhatsApp

## Stack

- Next.js 14
- TypeScript
- Supabase
- Handlebars (templates)
- Google Analytics Data API
- TokkoBoker API
