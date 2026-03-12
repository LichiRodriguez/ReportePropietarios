import { useState, useEffect } from 'react';

interface Tenant {
  id: string;
  name: string;
  company_name: string | null;
  agent_name: string | null;
  logo_url: string | null;
  primary_color: string;
  tokko_api_key: string | null;
  ga_property_id: string | null;
  access_token: string;
  created_at: string;
}

const EMPTY_FORM = {
  name: '',
  company_name: '',
  agent_name: '',
  logo_url: '',
  primary_color: '#c0392b',
  tokko_api_key: '',
  ga_property_id: '',
  ga_credentials_base64: '',
};

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants');
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch('/api/admin/tenants', {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      company_name: tenant.company_name || '',
      agent_name: tenant.agent_name || '',
      logo_url: tenant.logo_url || '',
      primary_color: tenant.primary_color || '#c0392b',
      tokko_api_key: tenant.tokko_api_key || '',
      ga_property_id: tenant.ga_property_id || '',
      ga_credentials_base64: '',
    });
    setShowForm(true);
  };

  const getAuthUrl = (token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/auth/${token}`;
  };

  const copyToClipboard = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

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
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Inmobiliaria Perez"
                  required
                />
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

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Empresa</th>
              <th style={styles.th}>Color</th>
              <th style={styles.th}>Tokko</th>
              <th style={styles.th}>GA</th>
              <th style={styles.th}>URL de acceso</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(tenant => (
              <tr key={tenant.id}>
                <td style={styles.td}>
                  <strong>{tenant.name}</strong>
                  {tenant.agent_name && <div style={{ fontSize: '12px', color: '#666' }}>{tenant.agent_name}</div>}
                </td>
                <td style={styles.td}>{tenant.company_name || '-'}</td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: tenant.primary_color, display: 'inline-block' }}></span>
                    <span style={{ fontSize: '12px', color: '#666' }}>{tenant.primary_color}</span>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: tenant.tokko_api_key ? '#dcfce7' : '#f3f4f6', color: tenant.tokko_api_key ? '#166534' : '#999' }}>
                    {tenant.tokko_api_key ? 'Configurado' : 'No'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: tenant.ga_property_id ? '#dcfce7' : '#f3f4f6', color: tenant.ga_property_id ? '#166534' : '#999' }}>
                    {tenant.ga_property_id ? 'Configurado' : 'No'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {getAuthUrl(tenant.access_token)}
                    </code>
                    <button
                      style={styles.copyBtn}
                      onClick={() => copyToClipboard(getAuthUrl(tenant.access_token), tenant.id)}
                    >
                      {copiedToken === tenant.id ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </td>
                <td style={styles.td}>
                  <button style={styles.editBtn} onClick={() => startEdit(tenant)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  tableWrapper: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'auto' },
  table: { width: '100%', minWidth: '900px', borderCollapse: 'collapse' as const, fontSize: '14px' },
  th: { textAlign: 'left' as const, padding: '12px 16px', background: '#f9fafb', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e5e7eb', fontSize: '13px' },
  td: { padding: '12px 16px', borderBottom: '1px solid #f3f4f6' },
  badge: { padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 500 },
  copyBtn: { background: '#e5e7eb', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  editBtn: { background: 'white', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
};
