import { useState, useEffect } from 'react';

interface Tenant {
  id: string;
  name: string;
  slug: string | null;
  company_name: string | null;
  agent_name: string | null;
  logo_url: string | null;
  primary_color: string;
  portals: string[] | null;
  notification_email: string | null;
  tokko_api_key: string | null;
  ga_property_id: string | null;
  access_token: string;
  created_at: string;
  properties_count?: number;
  owners_count?: number;
  reports_this_month?: number;
  reports_sent_this_month?: number;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const PORTAL_OPTIONS = ['ZonaProp', 'MercadoLibre', 'ArgenProp', 'BuscadorProp', 'Properati', 'Inmuebles24'];

const EMPTY_FORM = {
  name: '',
  slug: '',
  company_name: '',
  agent_name: '',
  logo_url: '',
  primary_color: '#c0392b',
  portals: ['ZonaProp', 'MercadoLibre', 'ArgenProp'] as string[],
  notification_email: '',
  tokko_api_key: '',
  ga_property_id: '',
  ga_credentials_base64: '',
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const adminHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    'X-Admin-Key': adminKey,
  });

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants', { headers: adminHeaders() });
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/tenants', {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (!res.ok) throw new Error('Clave incorrecta');
      setAuthenticated(true);
      setLoading(true);
      const data = await res.json();
      setTenants(data.tenants || []);
      setLoading(false);
    } catch {
      setLoginError('Clave incorrecta');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch('/api/admin/tenants', {
        method,
        headers: adminHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchTenants();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setForm({
      name: tenant.name,
      slug: tenant.slug || '',
      company_name: tenant.company_name || '',
      agent_name: tenant.agent_name || '',
      logo_url: tenant.logo_url || '',
      primary_color: tenant.primary_color || '#c0392b',
      portals: tenant.portals || ['ZonaProp', 'MercadoLibre', 'ArgenProp'],
      notification_email: tenant.notification_email || '',
      tokko_api_key: tenant.tokko_api_key || '',
      ga_property_id: tenant.ga_property_id || '',
      ga_credentials_base64: '',
    });
    setShowForm(true);
  };

  const getAuthUrl = (tenant: Tenant) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/auth/${tenant.slug || tenant.access_token}`;
  };

  const copyToClipboard = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!authenticated) {
    return (
      <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <form onSubmit={handleLogin} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Admin</h1>
          <p style={{ fontSize: '14px', color: '#666', textAlign: 'center', marginBottom: '24px' }}>Ingresa la clave de administrador</p>
          {loginError && <div style={styles.error}>{loginError}</div>}
          <input
            type="password"
            style={{ ...styles.input, width: '100%', marginBottom: '16px', boxSizing: 'border-box' }}
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
            placeholder="Clave de admin"
            autoFocus
            required
          />
          <button type="submit" style={{ ...styles.primaryBtn, width: '100%' }}>
            Entrar
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <div style={styles.container}><p>Cargando...</p></div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel de Administracion</h1>
        <button
          style={styles.primaryBtn}
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(EMPTY_FORM);
          }}
        >
          + Nuevo Cliente
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {showForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Nombre interno *</label>
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    const updates: any = { ...form, name };
                    if (!editingId || !form.slug) {
                      updates.slug = generateSlug(name);
                    }
                    setForm(updates);
                  }}
                  placeholder="Ej: Inmobiliaria Perez"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Slug (URL de acceso)</label>
                <input
                  style={styles.input}
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="Ej: inmobiliaria-perez"
                />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  URL: /auth/{form.slug || '...'}
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Nombre de la empresa (reportes)</label>
                <input
                  style={styles.input}
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Ej: Perez Propiedades"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Nombre del agente (reportes)</label>
                <input
                  style={styles.input}
                  value={form.agent_name}
                  onChange={e => setForm({ ...form, agent_name: e.target.value })}
                  placeholder="Ej: Juan Perez"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>URL del logo</label>
                <input
                  style={styles.input}
                  value={form.logo_url}
                  onChange={e => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Color primario</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm({ ...form, primary_color: e.target.value })}
                    style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={form.primary_color}
                    onChange={e => setForm({ ...form, primary_color: e.target.value })}
                    placeholder="#c0392b"
                  />
                </div>
              </div>
              <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Portales donde publica</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PORTAL_OPTIONS.map(portal => (
                    <label key={portal} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', border: form.portals.includes(portal) ? '2px solid #1e40af' : '1px solid #d1d5db', background: form.portals.includes(portal) ? '#eff6ff' : 'white' }}>
                      <input
                        type="checkbox"
                        checked={form.portals.includes(portal)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.portals, portal]
                            : form.portals.filter(p => p !== portal);
                          setForm({ ...form, portals: next });
                        }}
                        style={{ display: 'none' }}
                      />
                      {portal}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Se muestran en el subtítulo de la sección de portales del reporte
                </div>
              </div>
              <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Email de notificacion (cuando los reportes mensuales estan listos)</label>
                <input
                  style={styles.input}
                  type="email"
                  value={form.notification_email}
                  onChange={e => setForm({ ...form, notification_email: e.target.value })}
                  placeholder="Ej: admin@inmobiliaria.com"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Tokko API Key</label>
                <input
                  style={styles.input}
                  value={form.tokko_api_key}
                  onChange={e => setForm({ ...form, tokko_api_key: e.target.value })}
                  placeholder="API key de TokkoBoker"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>GA Property ID</label>
                <input
                  style={styles.input}
                  value={form.ga_property_id}
                  onChange={e => setForm({ ...form, ga_property_id: e.target.value })}
                  placeholder="Ej: 123456789"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>GA Credentials (base64)</label>
                <textarea
                  style={{ ...styles.input, minHeight: '60px', fontFamily: 'monospace', fontSize: '12px' }}
                  value={form.ga_credentials_base64}
                  onChange={e => setForm({ ...form, ga_credentials_base64: e.target.value })}
                  placeholder="JSON de credenciales en base64 (solo si se cambia)"
                />
              </div>
            </div>
            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setEditingId(null); }}>
                Cancelar
              </button>
              <button type="submit" style={styles.primaryBtn} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {tenants.map(tenant => {
          const checklist = [
            { label: 'Slug', ok: !!tenant.slug },
            { label: 'Tokko API', ok: !!tenant.tokko_api_key },
            { label: 'Google Analytics', ok: !!tenant.ga_property_id, optional: true },
            { label: 'Logo', ok: !!tenant.logo_url },
            { label: 'Propiedades', ok: (tenant.properties_count || 0) > 0 },
            { label: 'Reportes', ok: (tenant.reports_this_month || 0) > 0 },
          ];
          const done = checklist.filter(c => c.ok).length;
          const total = checklist.length;

          return (
            <div key={tenant.id} style={styles.card}>
              {/* Header */}
              <div style={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <span style={{ width: '10px', height: '40px', borderRadius: '4px', background: tenant.primary_color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{tenant.name}</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {tenant.company_name || 'Sin empresa'} {tenant.agent_name ? `· ${tenant.agent_name}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                    {tenant.tokko_api_key && <span style={{ ...styles.badge, background: '#dcfce7', color: '#166534' }}>Tokko</span>}
                    {tenant.ga_property_id && <span style={{ ...styles.badge, background: '#dbeafe', color: '#1e40af' }}>GA</span>}
                    {tenant.logo_url && <span style={{ ...styles.badge, background: '#f3e8ff', color: '#7c3aed' }}>Logo</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.editBtn} onClick={() => startEdit(tenant)}>Editar</button>
                </div>
              </div>

              {/* Body */}
              <div style={styles.cardBody}>
                {/* Checklist */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                    Onboarding {done}/{total}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                    {checklist.map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <span style={{ color: item.ok ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: '14px' }}>
                          {item.ok ? '\u2713' : '\u2717'}
                        </span>
                        <span style={{ color: item.ok ? '#333' : '#999' }}>
                          {item.label}{item.optional ? ' (opc.)' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Counts */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={styles.statBox}>
                    <div style={styles.statNum}>{tenant.properties_count || 0}</div>
                    <div style={styles.statLabel}>Propiedades</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statNum}>{tenant.owners_count || 0}</div>
                    <div style={styles.statLabel}>Propietarios</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statNum}>{tenant.reports_this_month || 0}</div>
                    <div style={styles.statLabel}>Reportes</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statNum}>{tenant.reports_sent_this_month || 0}</div>
                    <div style={styles.statLabel}>Enviados</div>
                  </div>
                </div>
              </div>

              {/* Footer: URL */}
              <div style={styles.cardFooter}>
                <span style={{ fontSize: '12px', color: '#666' }}>URL:</span>
                <code style={{ fontSize: '12px', background: '#f3f4f6', padding: '3px 8px', borderRadius: '4px' }}>
                  {getAuthUrl(tenant)}
                </code>
                <button
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard(getAuthUrl(tenant), tenant.id)}
                >
                  {copiedToken === tenant.id ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          );
        })}
        {tenants.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            No hay clientes. Crea el primero con el boton de arriba.
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '28px', fontWeight: 700 },
  primaryBtn: { background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#333', border: '1px solid #e5e7eb', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  error: { background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' },
  formCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px' },
  formTitle: { fontSize: '20px', fontWeight: 700, marginBottom: '16px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#555' },
  input: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' },
  badge: { padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 500 },
  copyBtn: { background: '#e5e7eb', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  editBtn: { background: 'white', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  card: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' },
  cardBody: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', gap: '24px' },
  cardFooter: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#f9fafb', borderTop: '1px solid #f3f4f6' },
  statBox: { textAlign: 'center' as const, padding: '8px 12px', background: '#f9fafb', borderRadius: '8px', minWidth: '70px' },
  statNum: { fontSize: '20px', fontWeight: 700, color: '#1e40af' },
  statLabel: { fontSize: '11px', color: '#666', marginTop: '2px' },
};
