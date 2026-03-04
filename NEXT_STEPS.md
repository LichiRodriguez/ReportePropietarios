# Proyecto Configurado - Proximos Pasos

El proyecto esta completamente configurado. Ahora necesitas:

## 1. Configurar Base de Datos

Ejecuta el archivo `supabase_migration_reports.sql` en Supabase:
1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. SQL Editor -> New Query
4. Pega el contenido del archivo de migracion
5. Run

## 2. Configurar Variables de Entorno

Edita `.env.local` con tus valores reales:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

Obten estos valores de: Supabase -> Settings -> API

## 3. Configurar Integraciones (Opcional)

### TokkoBoker
1. Obten API Key de TokkoBoker
2. Agrega a .env.local: `TOKKO_API_KEY=xxx`
3. Mapea propiedades con IDs de TokkoBoker

### Google Analytics
1. Crea Service Account en Google Cloud
2. Habilita Google Analytics Data API
3. Descarga credenciales JSON
4. Configura variables en .env.local

## 4. Probar Localmente
```bash
npm run dev
```

Visita:
- http://localhost:3000 (Home)
- http://localhost:3000/reports (Panel de reportes)

## 5. Deploy a Produccion
```bash
git add .
git commit -m "Initial setup - Reports system"
git push origin main

# Deploy en Vercel
vercel --prod
```

Configura las mismas variables de entorno en Vercel Dashboard.
