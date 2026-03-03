import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface CsvRow {
  nombre_propietario: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
  direccion_propiedad: string;
  barrio?: string;
  tipo_operacion?: string;
  precio?: string;
  superficie_total?: string;
  ambientes?: string;
  banos?: string;
}

interface ImportResult {
  row: number;
  owner_name: string;
  property_address: string;
  status: 'created' | 'error';
  error?: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(header: string): string {
  const h = header.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mapping: Record<string, string> = {
    'nombre': 'nombre_propietario',
    'nombre propietario': 'nombre_propietario',
    'nombre del propietario': 'nombre_propietario',
    'propietario': 'nombre_propietario',
    'nombre_propietario': 'nombre_propietario',
    'direccion': 'direccion_propiedad',
    'direccion propiedad': 'direccion_propiedad',
    'direccion de la propiedad': 'direccion_propiedad',
    'direccion_propiedad': 'direccion_propiedad',
    'email': 'email',
    'correo': 'email',
    'mail': 'email',
    'telefono': 'telefono',
    'tel': 'telefono',
    'phone': 'telefono',
    'whatsapp': 'whatsapp',
    'wsp': 'whatsapp',
    'barrio': 'barrio',
    'zona': 'barrio',
    'neighborhood': 'barrio',
    'tipo operacion': 'tipo_operacion',
    'tipo_operacion': 'tipo_operacion',
    'tipo de operacion': 'tipo_operacion',
    'operacion': 'tipo_operacion',
    'precio': 'precio',
    'price': 'precio',
    'valor': 'precio',
    'superficie': 'superficie_total',
    'superficie total': 'superficie_total',
    'superficie_total': 'superficie_total',
    'm2': 'superficie_total',
    'metros': 'superficie_total',
    'ambientes': 'ambientes',
    'rooms': 'ambientes',
    'banos': 'banos',
    'bathrooms': 'banos',
  };
  return mapping[h] || header.trim();
}

function parseCsv(text: string): CsvRow[] {
  // Strip BOM and zero-width characters that Excel/Google Sheets may add
  const clean = text.replace(/^\uFEFF/, '').replace(/\u200B/g, '');
  const lines = clean.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row as unknown as CsvRow);
  }

  return rows;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { csv_content } = req.body;

  if (!csv_content || typeof csv_content !== 'string') {
    return res.status(400).json({ error: 'csv_content is required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const rows = parseCsv(csv_content);

  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV is empty or has no data rows' });
  }

  // Validate required fields
  const validationErrors: string[] = [];
  rows.forEach((row, idx) => {
    if (!row.nombre_propietario?.trim()) {
      validationErrors.push(`Row ${idx + 2}: nombre_propietario is required`);
    }
    if (!row.direccion_propiedad?.trim()) {
      validationErrors.push(`Row ${idx + 2}: direccion_propiedad is required`);
    }
    if (row.tipo_operacion && !['sale', 'rent'].includes(row.tipo_operacion.trim().toLowerCase())) {
      validationErrors.push(`Row ${idx + 2}: tipo_operacion must be 'sale' or 'rent'`);
    }
  });

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Validation errors',
      details: validationErrors.slice(0, 20),
    });
  }

  // Group rows by owner name + phone to avoid duplicate owners
  const ownerMap = new Map<string, { owner: Partial<CsvRow>; properties: CsvRow[] }>();

  for (const row of rows) {
    const ownerKey = `${row.nombre_propietario.trim().toLowerCase()}|${(row.telefono || row.whatsapp || '').trim()}`;
    if (!ownerMap.has(ownerKey)) {
      ownerMap.set(ownerKey, {
        owner: {
          nombre_propietario: row.nombre_propietario.trim(),
          email: row.email?.trim() || undefined,
          telefono: row.telefono?.trim() || undefined,
          whatsapp: row.whatsapp?.trim() || undefined,
        },
        properties: [],
      });
    }
    ownerMap.get(ownerKey)!.properties.push(row);
  }

  const results: ImportResult[] = [];
  let created = 0;
  let errors = 0;

  const entries = Array.from(ownerMap.values());
  for (const { owner, properties } of entries) {
    try {
      // Insert owner
      const { data: ownerData, error: ownerError } = await supabase
        .from('owners')
        .insert({
          name: owner.nombre_propietario,
          email: owner.email || null,
          phone: owner.telefono || null,
          whatsapp: owner.whatsapp || owner.telefono || null,
        })
        .select('id')
        .single();

      if (ownerError || !ownerData) {
        throw new Error(`Failed to create owner: ${ownerError?.message}`);
      }

      // Insert all properties for this owner
      for (const prop of properties) {
        try {
          const { error: propError } = await supabase
            .from('properties')
            .insert({
              address: prop.direccion_propiedad.trim(),
              neighborhood: prop.barrio?.trim() || null,
              property_type: prop.tipo_operacion?.trim().toLowerCase() || 'sale',
              price: prop.precio ? parseFloat(prop.precio) : null,
              surface_total: prop.superficie_total ? parseFloat(prop.superficie_total) : null,
              rooms: prop.ambientes ? parseInt(prop.ambientes, 10) : null,
              bathrooms: prop.banos ? parseInt(prop.banos, 10) : null,
              owner_id: ownerData.id,
              status: 'active',
              reports_enabled: true,
            });

          if (propError) {
            throw new Error(propError.message);
          }

          results.push({
            row: results.length + 2,
            owner_name: owner.nombre_propietario!,
            property_address: prop.direccion_propiedad,
            status: 'created',
          });
          created++;
        } catch (propErr: any) {
          results.push({
            row: results.length + 2,
            owner_name: owner.nombre_propietario!,
            property_address: prop.direccion_propiedad,
            status: 'error',
            error: propErr.message,
          });
          errors++;
        }
      }
    } catch (err: any) {
      for (const prop of properties) {
        results.push({
          row: results.length + 2,
          owner_name: owner.nombre_propietario!,
          property_address: prop.direccion_propiedad,
          status: 'error',
          error: err.message,
        });
        errors++;
      }
    }
  }

  return res.status(200).json({
    success: true,
    summary: {
      total_rows: rows.length,
      owners_created: ownerMap.size,
      properties_created: created,
      errors,
    },
    results,
  });
}
