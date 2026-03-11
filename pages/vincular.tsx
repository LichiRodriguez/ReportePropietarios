import { useState, useEffect, useCallback } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getTenantFromPageContext } from '@/lib/auth';

interface Owner {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
}

interface Property {
  id: string;
  address: string;
  neighborhood: string;
  property_type: string;
  price: number;
  status: string;
  tokko_id: string | null;
  web_url: string | null;
  synced_at: string | null;
  owners: Owner | null;
}

interface TokkoProperty {
  id: number;
  address: string;
  reference_code: string;
  publication_title: string;
  price: number;
  currency: string;
  web_url: string;
  photos: string[];
}

interface EditForm {
  address: string;
  neighborhood: string;
  price: string;
  owner_name: string;
  owner_phone: string;
  tokko_id: string;
  web_url: string;
}

export default function VincularPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tokkoProperties, setTokkoProperties] = useState<TokkoProperty[]>([]);
  const [tokkoConfigured, setTokkoConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Edit modal state
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    address: '', neighborhood: '', price: '', owner_name: '', owner_phone: '', tokko_id: '', web_url: '',
  });

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      setProperties(data.properties || []);
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar propiedades' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTokkoProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/tokko/properties');
      const data = await res.json();
      setTokkoConfigured(data.configured);
      setTokkoProperties(data.properties || []);
    } catch {
      // Tokko not available
    }
  }, []);

  useEffect(() => {
    fetchProperties();
    fetchTokkoProperties();
  }, [fetchProperties, fetchTokkoProperties]);

  const openEditModal = (prop: Property) => {
    setEditingProperty(prop);
    setEditForm({
      address: prop.address || '',
      neighborhood: prop.neighborhood || '',
      price: prop.price ? String(prop.price) : '',
      owner_name: prop.owners?.name || '',
      owner_phone: prop.owners?.phone || prop.owners?.whatsapp || '',
      tokko_id: prop.tokko_id || '',
      web_url: prop.web_url || '',
    });
  };

  const closeEditModal = () => {
    setEditingProperty(null);
  };

  const saveEdit = async () => {
    if (!editingProperty) return;
    setSaving(editingProperty.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/properties/${editingProperty.id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: editForm.address,
          neighborhood: editForm.neighborhood,
          price: editForm.price ? Number(editForm.price) : null,
          owner_name: editForm.owner_name,
          owner_phone: editForm.owner_phone,
          tokko_id: editForm.tokko_id || null,
          web_url: editForm.web_url || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Propiedad actualizada correctamente' });
      closeEditModal();
      fetchProperties();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(null);
    }
  };

  const syncProperty = async (propertyId: string) => {
    setSaving(propertyId);
    setMessage(null);

    try {
      const res = await fetch('/api/tokko/sync-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Datos sincronizados desde Tokko' });
      fetchProperties();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(null);
    }
  };

  const linkFromTokko = (tokkoId: number, tokkoAddress: string, tokkoWebUrl: string) => {
    const match = properties.find(p =>
      !p.tokko_id &&
      (p.address.toLowerCase().includes(tokkoAddress.toLowerCase().slice(0, 15)) ||
       tokkoAddress.toLowerCase().includes(p.address.toLowerCase().slice(0, 15)))
    );

    if (match) {
      openEditModal(match);
      setEditForm(prev => ({
        ...prev,
        tokko_id: String(tokkoId),
        web_url: tokkoWebUrl || prev.web_url,
      }));
      setMessage({ type: 'success', text: `Coincidencia encontrada: "${match.address}". Confirmá para vincular.` });
    } else {
      setMessage({ type: 'error', text: `No se encontró coincidencia automática para "${tokkoAddress}". Editá manualmente la propiedad que corresponda o usá "Crear y vincular".` });
    }
  };

  const safeJson = async (res: Response, url: string) => {
    const text = await res.text();
    if (!text) throw new Error(`El servidor respondió vacío (status ${res.status}) en ${url}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Respuesta inválida del servidor (status ${res.status}) en ${url}: ${text.slice(0, 200)}`);
    }
  };

  const createAndLink = async (tokko: TokkoProperty) => {
    setSaving(String(tokko.id));
    setMessage(null);

    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: tokko.address,
          price: tokko.price || null,
          tokko_id: String(tokko.id),
          web_url: tokko.web_url || null,
        }),
      });

      const data = await safeJson(res, '/api/properties');
      if (!res.ok) throw new Error(data.error || 'Error al crear la propiedad');

      setMessage({ type: 'success', text: `Propiedad "${tokko.address}" creada y vinculada correctamente.` });
      fetchProperties();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(null);
    }
  };

  const filtered = properties.filter(p => {
    if (filter === 'linked') return p.tokko_id || p.web_url;
    if (filter === 'unlinked') return !p.tokko_id && !p.web_url;
    return true;
  });

  const linkedCount = properties.filter(p => p.tokko_id || p.web_url).length;
  const unlinkedCount = properties.filter(p => !p.tokko_id && !p.web_url).length;

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Vincular Propiedades</h1>
          <p style={{ color: '#666', margin: '5px 0 0' }}>
            Conectá cada propiedad con su ID de Tokko y URL de tu página
          </p>
        </div>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Volver al inicio
        </Link>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '6px',
          background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          padding: '12px 20px', borderRadius: '8px', background: '#f0f9ff', border: '1px solid #bae6fd',
          cursor: 'pointer', fontWeight: filter === 'all' ? 'bold' : 'normal'
        }} onClick={() => setFilter('all')}>
          Total: {properties.length}
        </div>
        <div style={{
          padding: '12px 20px', borderRadius: '8px', background: '#dcfce7', border: '1px solid #86efac',
          cursor: 'pointer', fontWeight: filter === 'linked' ? 'bold' : 'normal'
        }} onClick={() => setFilter('linked')}>
          Vinculadas: {linkedCount}
        </div>
        <div style={{
          padding: '12px 20px', borderRadius: '8px', background: '#fef9c3', border: '1px solid #fde047',
          cursor: 'pointer', fontWeight: filter === 'unlinked' ? 'bold' : 'normal'
        }} onClick={() => setFilter('unlinked')}>
          Sin vincular: {unlinkedCount}
        </div>
      </div>

      {loading ? (
        <p>Cargando propiedades...</p>
      ) : (
        <>
          {/* Properties table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyle}>Propietario</th>
                  <th style={thStyle}>Dirección</th>
                  <th style={thStyle}>Barrio</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>ID Tokko</th>
                  <th style={thStyle}>URL Propiedad</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(prop => (
                  <tr key={prop.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>
                      {prop.owners?.id ? (
                        <Link
                          href={`/propietario/${prop.owners.id}`}
                          style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}
                        >
                          {prop.owners.name || '-'}
                        </Link>
                      ) : (
                        <strong>{prop.owners?.name || '-'}</strong>
                      )}
                      {prop.owners?.whatsapp && (
                        <div style={{ fontSize: '12px', color: '#666' }}>{prop.owners.whatsapp}</div>
                      )}
                    </td>
                    <td style={tdStyle}>{prop.address}</td>
                    <td style={tdStyle}>{prop.neighborhood || '-'}</td>
                    <td style={tdStyle}>
                      {prop.price ? `USD ${prop.price.toLocaleString()}` : '-'}
                    </td>
                    <td style={tdStyle}>
                      {prop.tokko_id ? (
                        <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '13px' }}>
                          {prop.tokko_id}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {prop.web_url ? (
                        <a href={prop.web_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#0070f3', fontSize: '13px', wordBreak: 'break-all' }}>
                          {prop.web_url.length > 40 ? prop.web_url.slice(0, 40) + '...' : prop.web_url}
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEditModal(prop)} style={btnEdit}>
                          Editar
                        </button>
                        {prop.tokko_id && tokkoConfigured && (
                          <button
                            onClick={() => syncProperty(prop.id)}
                            disabled={saving === prop.id}
                            style={btnSync}
                          >
                            {saving === prop.id ? '...' : 'Sync'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
              <p>No hay propiedades{filter !== 'all' ? ` ${filter === 'linked' ? 'vinculadas' : 'sin vincular'}` : ''}.</p>
              {properties.length === 0 && tokkoProperties.length > 0 && (
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Usá el botón <strong>&quot;Crear y vincular&quot;</strong> en las propiedades de Tokko de abajo para crear propiedades directamente.
                  <br />
                  También podés <Link href="/import" style={{ color: '#0070f3' }}>importar propiedades desde un CSV</Link>.
                </p>
              )}
              {properties.length === 0 && tokkoProperties.length === 0 && (
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  <Link href="/import" style={{ color: '#0070f3' }}>Importá propiedades desde un CSV</Link> para empezar.
                </p>
              )}
            </div>
          )}

          {/* Tokko properties section */}
          {tokkoConfigured && tokkoProperties.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <h2>Propiedades en Tokko Broker</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Hacé click en &quot;Vincular&quot; para asociar una propiedad de Tokko con una de tu base.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {tokkoProperties.map(tp => {
                  const alreadyLinked = properties.some(p => p.tokko_id === String(tp.id));
                  return (
                    <div key={tp.id} style={{
                      border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px',
                      background: alreadyLinked ? '#f0fdf4' : 'white',
                    }}>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>ID: {tp.id}</div>
                      <div style={{ fontWeight: 'bold', margin: '4px 0' }}>{tp.address}</div>
                      {tp.publication_title && (
                        <div style={{ fontSize: '13px', color: '#475569' }}>{tp.publication_title}</div>
                      )}
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        {tp.currency} {tp.price?.toLocaleString()}
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {alreadyLinked ? (
                          <span style={{ color: '#16a34a', fontSize: '13px' }}>Ya vinculada</span>
                        ) : (
                          <>
                            <button
                              onClick={() => linkFromTokko(tp.id, tp.address, tp.web_url)}
                              style={btnLink}
                            >
                              Vincular
                            </button>
                            <button
                              onClick={() => createAndLink(tp)}
                              disabled={saving === String(tp.id)}
                              style={btnCreate}
                            >
                              {saving === String(tp.id) ? 'Creando...' : 'Crear y vincular'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!tokkoConfigured && (
            <div style={{
              marginTop: '30px', padding: '20px', background: '#fffbeb',
              border: '1px solid #fde68a', borderRadius: '8px',
            }}>
              <strong>Tokko API no configurada</strong>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#92400e' }}>
                Para vincular automáticamente con Tokko, configurá <code>TOKKO_API_KEY</code> en tu archivo <code>.env.local</code>.
                Mientras tanto, podés vincular manualmente ingresando el ID de Tokko y la URL de cada propiedad.
              </p>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingProperty && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
        >
          <div style={{
            background: 'white', borderRadius: '12px', padding: '28px', width: '500px', maxWidth: '95vw',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px' }}>Editar Propiedad</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Dirección</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Barrio</label>
                  <input
                    type="text"
                    value={editForm.neighborhood}
                    onChange={e => setEditForm(f => ({ ...f, neighborhood: e.target.value }))}
                    placeholder="Ej: Palermo"
                    style={modalInputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Precio (USD)</label>
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ej: 150000"
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '10px' }}>
                  Datos del propietario
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Nombre</label>
                    <input
                      type="text"
                      value={editForm.owner_name}
                      onChange={e => setEditForm(f => ({ ...f, owner_name: e.target.value }))}
                      style={modalInputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Teléfono</label>
                    <input
                      type="text"
                      value={editForm.owner_phone}
                      onChange={e => setEditForm(f => ({ ...f, owner_phone: e.target.value }))}
                      placeholder="Ej: 1155667788"
                      style={modalInputStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '10px' }}>
                  Vinculación
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>ID Tokko</label>
                    <input
                      type="text"
                      value={editForm.tokko_id}
                      onChange={e => setEditForm(f => ({ ...f, tokko_id: e.target.value }))}
                      placeholder="Ej: 12345"
                      style={modalInputStyle}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>URL Propiedad</label>
                    <input
                      type="text"
                      value={editForm.web_url}
                      onChange={e => setEditForm(f => ({ ...f, web_url: e.target.value }))}
                      placeholder="https://..."
                      style={modalInputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button onClick={closeEditModal} style={btnCancel}>
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving === editingProperty.id}
                style={btnSave}
              >
                {saving === editingProperty.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px', verticalAlign: 'top',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px',
};

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px',
  fontSize: '14px', boxSizing: 'border-box',
};

const btnEdit: React.CSSProperties = {
  padding: '4px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
};

const btnSave: React.CSSProperties = {
  padding: '8px 20px', background: '#0070f3', color: 'white', border: 'none',
  borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
};

const btnCancel: React.CSSProperties = {
  padding: '8px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1',
  borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
};

const btnSync: React.CSSProperties = {
  padding: '4px 12px', background: '#059669', color: 'white', border: 'none',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
};

const btnLink: React.CSSProperties = {
  padding: '4px 12px', background: '#6366f1', color: 'white', border: 'none',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
};

const btnCreate: React.CSSProperties = {
  padding: '4px 12px', background: '#0891b2', color: 'white', border: 'none',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
};

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const tenant = await getTenantFromPageContext(req);
  if (!tenant) {
    return { redirect: { destination: '/auth-required', permanent: false } };
  }
  return { props: {} };
};
