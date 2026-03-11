# Próximos Pasos — MVP Multi-tenant

Objetivo: que el primer cliente externo pueda usar el sistema en 6 días.
Arquitectura elegida: **URL secreta por tenant** (cookie de sesión, sin login con contraseña).

---

## Tarea 1 — SQL: tabla `tenants` + agregar `tenant_id` a todas las tablas
**Archivo a crear:** `supabase_migration_multitenancy.sql`
**Dónde ejecutarlo:** Supabase Dashboard → SQL Editor

### Qué hace:
1. Crea la tabla `tenants` con todos los campos necesarios
2. Agrega columna `tenant_id` a cada tabla existente (nullable primero)
3. Inserta el primer tenant (tu inmobiliaria actual, con los datos de branding reales)
4. Asigna ese `tenant_id` a TODOS los registros existentes (para que no se rompa nada)
5. Pone las columnas como NOT NULL (ya que están todas pobladas)
6. Actualiza las RLS policies para incluir filtrado por tenant

### SQL completo:
```sql
-- ============================================================
-- PASO 1: Crear tabla tenants
-- ============================================================
CREATE TABLE tenants (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  access_token     TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  tokko_api_key    TEXT,
  ga_property_id   TEXT,
  ga_credentials_base64 TEXT,
  agent_name       TEXT,
  company_name     TEXT,
  logo_url         TEXT,
  primary_color    TEXT DEFAULT '#1e40af',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- PASO 2: Agregar tenant_id a todas las tablas (nullable primero)
-- ============================================================
ALTER TABLE owners                  ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE properties              ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE property_metrics        ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE monthly_property_metrics ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE monthly_property_reports ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE report_deliveries       ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE traffic_sources         ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- ============================================================
-- PASO 3: Crear primer tenant y poblar datos existentes
-- ============================================================
DO $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO tenants (name, agent_name, company_name, primary_color)
  VALUES (
    'Mi Inmobiliaria',        -- CAMBIAR: nombre real
    'Lisandro Rodriguez',     -- CAMBIAR: nombre del agente
    'Mi Inmobiliaria',        -- CAMBIAR: nombre empresa para el reporte
    '#1e40af'                 -- CAMBIAR: color principal (hex)
  )
  RETURNING id INTO v_id;

  UPDATE owners                   SET tenant_id = v_id;
  UPDATE properties               SET tenant_id = v_id;
  UPDATE property_metrics         SET tenant_id = v_id;
  UPDATE monthly_property_metrics SET tenant_id = v_id;
  UPDATE monthly_property_reports SET tenant_id = v_id;
  UPDATE report_deliveries        SET tenant_id = v_id;
  UPDATE traffic_sources          SET tenant_id = v_id;

  RAISE NOTICE 'Tenant creado con ID: %', v_id;
END $$;

-- ============================================================
-- PASO 4: Hacer tenant_id NOT NULL (ya poblado)
-- ============================================================
ALTER TABLE owners                   ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE properties               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE property_metrics         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE monthly_property_metrics ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE monthly_property_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_deliveries        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE traffic_sources          ALTER COLUMN tenant_id SET NOT NULL;
```

### Después de ejecutar:
Ir a la tabla `tenants` en Supabase y anotar el `access_token` del primer tenant.
Tu URL de acceso quedará: `https://tuapp.vercel.app/auth/[ese_token]`

---

## Tarea 2 — Auth: URL secreta → cookie de sesión
**Archivos a crear/modificar:**

### `lib/auth.ts` (nuevo)
Helper central que leen todos los otros archivos para obtener el tenant.

```ts
import type { NextApiRequest } from 'next';
import type { IncomingMessage } from 'http';
import { createClient } from '@supabase/supabase-js';

export interface Tenant {
  id: string;
  name: string;
  tokko_api_key: string | null;
  ga_property_id: string | null;
  ga_credentials_base64: string | null;
  agent_name: string | null;
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
}

const COOKIE_NAME = 'tenant_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function buildSessionCookie(tenantId: string): string {
  return `${COOKIE_NAME}=${tenantId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`;
}

export function getTenantIdFromCookies(cookies: Partial<Record<string, string>>): string | null {
  return cookies[COOKIE_NAME] || null;
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('tenants')
    .select('id, name, tokko_api_key, ga_property_id, ga_credentials_base64, agent_name, company_name, logo_url, primary_color')
    .eq('id', tenantId)
    .single();
  return data;
}

// Para usar en getServerSideProps de páginas
export async function getTenantFromPageContext(req: IncomingMessage & { cookies: Partial<Record<string, string>> }): Promise<Tenant | null> {
  const tenantId = getTenantIdFromCookies(req.cookies);
  if (!tenantId) return null;
  return getTenantById(tenantId);
}

// Para usar en API routes
export async function getTenantFromApiRequest(req: NextApiRequest): Promise<Tenant | null> {
  const tenantId = getTenantIdFromCookies(req.cookies);
  if (!tenantId) return null;
  return getTenantById(tenantId);
}
```

### `pages/auth/[token].tsx` (nuevo)
La "URL mágica" que cada cliente recibe. Valida el token, setea la cookie, redirige al panel.

```tsx
import type { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import { buildSessionCookie } from '@/lib/auth';

export default function AuthPage({ error }: { error?: boolean }) {
  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2>Enlace inválido o expirado</h2>
        <p>Contactá a tu asesor para obtener un nuevo enlace de acceso.</p>
      </div>
    );
  }
  return <div>Redirigiendo...</div>;
}

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const token = params?.token as string;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('access_token', token)
    .single();

  if (!tenant) {
    return { props: { error: true } };
  }

  res.setHeader('Set-Cookie', buildSessionCookie(tenant.id));

  return {
    redirect: { destination: '/reports', permanent: false },
  };
};
```

### Modificar `pages/reports.tsx` (y cada página protegida)
Agregar `getServerSideProps` que verifica la cookie. Si no hay sesión, redirige a `/auth-required`.

```tsx
import type { GetServerSideProps } from 'next';
import { getTenantFromPageContext } from '@/lib/auth';

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const tenant = await getTenantFromPageContext(req);
  if (!tenant) {
    return { redirect: { destination: '/auth-required', permanent: false } };
  }
  return { props: { tenantId: tenant.id } };
};
```

Páginas a proteger: `pages/reports.tsx`, `pages/index.tsx`, `pages/import.tsx`, `pages/vincular.tsx`, `pages/propietario/[id].tsx`

### `pages/auth-required.tsx` (nuevo)
Página simple que dice "Acceso no autorizado. Usá el enlace que te enviamos."

---

## Tarea 3 — APIs: filtrar todo por `tenant_id`
**Patrón estándar** que va en CADA endpoint de API:

```ts
import { getTenantFromApiRequest } from '@/lib/auth';

export default async function handler(req, res) {
  const tenant = await getTenantFromApiRequest(req);
  if (!tenant) return res.status(401).json({ error: 'No autorizado' });

  // A partir de acá, TODAS las queries de Supabase llevan:
  // .eq('tenant_id', tenant.id)
}
```

**Endpoints a modificar** (todos los que hacen queries a Supabase):

| Archivo | Cambio |
|---------|--------|
| `api/reports/pending.ts` | Agregar `.eq('tenant_id', tenant.id)` a la query |
| `api/reports/generate.ts` | Pasar `tenant_id` al ReportGenerationService |
| `api/reports/[id]/prepare-send.ts` | Verificar que el reporte pertenece al tenant |
| `api/reports/[id]/mark-sent.ts` | Idem |
| `api/reports/[id]/notes.ts` | Idem |
| `api/properties.ts` | Agregar `.eq('tenant_id', tenant.id)` |
| `api/properties/[id]/edit.ts` | Verificar que la propiedad pertenece al tenant |
| `api/properties/[id]/link.ts` | Idem |
| `api/owners/[id].ts` | Verificar que el owner pertenece al tenant |
| `api/import/owners-properties.ts` | Insertar con `tenant_id` |
| `api/tokko/properties.ts` | Usar config de Tokko del tenant |
| `api/tokko/sync-property.ts` | Idem |

**Endpoints que NO necesitan auth** (acceso público — el propietario los abre desde WhatsApp):
- `api/reports/[id]/view.ts` — sin cambios
- `api/reports/[id]/preview.ts` — sin cambios
- `api/reports/[id]/pdf.ts` — sin cambios

**El cron** (`api/cron/generate-monthly-reports.ts`) no usa cookie sino Bearer token.
Hay que modificarlo para que itere sobre TODOS los tenants y genere reportes para cada uno.

---

## Tarea 4 — Servicios: config por tenant (Tokko + Google Analytics)

### `services/tokkobrokerService.ts`
Hoy lee `process.env.TOKKO_API_KEY`. Pasar a aceptar la key en el constructor:

```ts
// Antes:
constructor() {
  this.apiKey = process.env.TOKKO_API_KEY;
}

// Después:
constructor(apiKey: string) {
  this.apiKey = apiKey;
}
```

Todos los lugares que instancian `TokkobrokerService` pasan `tenant.tokko_api_key`.

### `services/googleAnalyticsService.ts`
Hoy lee `GA_PROPERTY_ID` y credenciales de `process.env`. Pasar a aceptar config en constructor:

```ts
// Antes:
constructor() {
  this.propertyId = process.env.GA_PROPERTY_ID;
  // lee credenciales de env
}

// Después:
constructor(propertyId: string, credentialsBase64: string) {
  this.propertyId = propertyId;
  // usa credentialsBase64 directamente
}
```

### `services/reportGenerationService.ts`
El método `generatePropertyReport()` recibe el tenant completo y lo pasa a los servicios.
También inserta `tenant_id` en el registro del reporte.

---

## Tarea 5 — Branding por tenant en el reporte PDF

### `services/reportTemplateEngine.ts`
El método `renderReport(reportId)` pasa a `renderReport(reportId, tenant)`.
Los datos del tenant se inyectan en los datos del template como `tenant: { agent_name, company_name, logo_url, primary_color }`.

### Template Handlebars (dentro del mismo archivo)
Reemplazar valores hardcodeados por variables del tenant:

```html
<!-- Antes (hardcodeado) -->
<div class="agent-name">Lisandro Rodriguez</div>
<div class="company">Mi Inmobiliaria</div>

<!-- Después (dinámico) -->
<div class="agent-name">{{tenant.agent_name}}</div>
<div class="company">{{tenant.company_name}}</div>
{{#if tenant.logo_url}}
  <img src="{{tenant.logo_url}}" alt="Logo" />
{{/if}}
```

También actualizar el color primario usando CSS inline:
```html
<style>
  :root { --color-primary: {{tenant.primary_color}}; }
</style>
```

---

## Tarea 6 — Panel de admin para crear tenants
**Archivos a crear:**

### `pages/admin/index.tsx`
Página protegida con `ADMIN_SECRET` (query param: `/admin?secret=xxx`).
Muestra:
- Lista de todos los tenants con su access_token y URL de acceso
- Formulario para crear un tenant nuevo (nombre, agent_name, company_name, primary_color, tokko_api_key, ga_property_id, ga_credentials_base64)
- Botón "Copiar URL de acceso" para cada tenant

### `pages/api/admin/tenants.ts`
- `GET`: lista todos los tenants (requiere header `x-admin-secret`)
- `POST`: crea un tenant nuevo y devuelve el access_token generado

---

## Orden de ejecución recomendado

```
Día 1:  Tarea 1  (SQL en Supabase)
Día 2:  Tarea 2  (Auth)
Día 3:  Tarea 3  (APIs)
Día 4:  Tarea 4  (Servicios)
Día 5:  Tarea 5  (Branding)  +  Tarea 6  (Admin panel)
Día 6:  Testing end-to-end  +  Onboarding primer cliente
```

## Regla para no romper el sistema propio mientras se desarrolla

Después de la Tarea 1 (SQL), la app sigue funcionando en desarrollo:
- En dev, podés agregar un fallback en `getTenantFromApiRequest()` que devuelva el primer tenant si no hay cookie.
- En producción (Vercel), el fallback NO se activa.
- Esto permite desarrollar sin estar autenticado localmente.

```ts
// lib/auth.ts — solo en desarrollo
export async function getTenantFromApiRequest(req: NextApiRequest): Promise<Tenant | null> {
  const tenantId = getTenantIdFromCookies(req.cookies);

  if (!tenantId && process.env.NODE_ENV === 'development') {
    // Dev fallback: primer tenant
    const supabase = createClient(...);
    const { data } = await supabase.from('tenants').select('*').limit(1).single();
    return data;
  }

  if (!tenantId) return null;
  return getTenantById(tenantId);
}
```

---

## Checklist de verificación antes de dar acceso al primer cliente

- [ ] Tarea 1 ejecutada: tabla `tenants` existe, todos los registros tienen `tenant_id`
- [ ] Tu propia URL de acceso funciona: `/auth/[token]` → redirige a `/reports`
- [ ] Las páginas sin cookie redirigen a `/auth-required`
- [ ] Los reportes de un tenant no son visibles desde el tenant B
- [ ] El PDF se genera correctamente para el tenant
- [ ] El PDF usa el branding del tenant (nombre agente, empresa)
- [ ] La generación de reportes usa la Tokko API key del tenant
- [ ] Creaste el tenant del cliente desde `/admin`
- [ ] Le enviaste su URL de acceso
- [ ] Importaste sus propiedades
- [ ] Hiciste una llamada para conectar su Tokko key y GA property
