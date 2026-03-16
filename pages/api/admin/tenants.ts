import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function isAdmin(req: NextApiRequest): boolean {
  // En desarrollo, siempre permitir
  if (process.env.NODE_ENV === 'development') return true;
  // En produccion, requiere header X-Admin-Key = CRON_SECRET
  const adminKey = req.headers['x-admin-key'];
  return adminKey === process.env.CRON_SECRET;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // GET - Listar todos los tenants
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, company_name, agent_name, logo_url, primary_color, portals, notification_email, tokko_api_key, ga_property_id, access_token, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ tenants: data });
  }

  // POST - Crear nuevo tenant
  if (req.method === 'POST') {
    const { name, slug, company_name, agent_name, logo_url, primary_color, portals, notification_email, tokko_api_key, ga_property_id, ga_credentials_base64 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const access_token = crypto.randomBytes(16).toString('hex');

    const { data, error } = await supabase
      .from('tenants')
      .insert({
        name,
        slug: slug || null,
        company_name: company_name || null,
        agent_name: agent_name || null,
        logo_url: logo_url || null,
        primary_color: primary_color || '#c0392b',
        tokko_api_key: tokko_api_key || null,
        ga_property_id: ga_property_id || null,
        portals: portals || ['ZonaProp', 'MercadoLibre', 'ArgenProp'],
        notification_email: notification_email || null,
        ga_credentials_base64: ga_credentials_base64 || null,
        access_token,
      })
      .select('id, name, slug, company_name, agent_name, logo_url, primary_color, portals, notification_email, tokko_api_key, ga_property_id, access_token, created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ tenant: data });
  }

  // PUT - Editar tenant
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'El id del tenant es obligatorio' });
    }

    // Solo permitir actualizar campos validos
    const allowedFields = ['name', 'slug', 'company_name', 'agent_name', 'logo_url', 'primary_color', 'portals', 'notification_email', 'tokko_api_key', 'ga_property_id', 'ga_credentials_base64'];
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field] || null;
      }
    }

    // No permitir setear name a null
    if (updateData.name === null) delete updateData.name;

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select('id, name, slug, company_name, agent_name, logo_url, primary_color, portals, notification_email, tokko_api_key, ga_property_id, access_token, created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ tenant: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
