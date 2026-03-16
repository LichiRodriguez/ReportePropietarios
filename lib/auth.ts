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
  portals: string[] | null;
  notification_email: string | null;
}

const COOKIE_NAME = 'tenant_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export function buildSessionCookie(tenantId: string, secure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${tenantId}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`;
}

function getTenantIdFromCookies(cookies: Partial<Record<string, string>>): string | null {
  return cookies[COOKIE_NAME] || null;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const TENANT_COLUMNS = 'id, name, tokko_api_key, ga_property_id, ga_credentials_base64, agent_name, company_name, logo_url, primary_color, portals, notification_email';

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const { data } = await getSupabase()
    .from('tenants')
    .select(TENANT_COLUMNS)
    .eq('id', tenantId)
    .single();
  return data;
}

export async function getTenantByToken(token: string): Promise<Tenant | null> {
  const { data } = await getSupabase()
    .from('tenants')
    .select(TENANT_COLUMNS)
    .eq('access_token', token)
    .single();
  return data;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data } = await getSupabase()
    .from('tenants')
    .select(TENANT_COLUMNS)
    .eq('slug', slug)
    .single();
  return data;
}

// Busca primero por slug, luego por access_token (retrocompatible)
export async function getTenantBySlugOrToken(value: string): Promise<Tenant | null> {
  const bySlug = await getTenantBySlug(value);
  if (bySlug) return bySlug;
  return getTenantByToken(value);
}

// Para getServerSideProps de paginas protegidas
export async function getTenantFromPageContext(
  req: IncomingMessage & { cookies: Partial<Record<string, string>> }
): Promise<Tenant | null> {
  const tenantId = getTenantIdFromCookies(req.cookies);

  // Fallback en desarrollo: primer tenant disponible
  if (!tenantId && process.env.NODE_ENV === 'development') {
    const { data } = await getSupabase()
      .from('tenants')
      .select(TENANT_COLUMNS)
      .limit(1)
      .single();
    return data;
  }

  if (!tenantId) return null;
  return getTenantById(tenantId);
}

// Para API routes
export async function getTenantFromApiRequest(req: NextApiRequest): Promise<Tenant | null> {
  const tenantId = getTenantIdFromCookies(req.cookies);

  // Fallback en desarrollo: primer tenant disponible
  if (!tenantId && process.env.NODE_ENV === 'development') {
    const { data } = await getSupabase()
      .from('tenants')
      .select(TENANT_COLUMNS)
      .limit(1)
      .single();
    return data;
  }

  if (!tenantId) return null;
  return getTenantById(tenantId);
}
