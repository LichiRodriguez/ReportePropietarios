import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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

export default function VincularPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tokkoProperties, setTokkoProperties] = useState<TokkoProperty[]>([]);
  const [tokkoConfigured, setTokkoConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTokkoId, setEditTokkoId] = useState('');
  const [editWebUrl, setEditWebUrl] = useState('');
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

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

  const startEditing = (prop: Property) => {
    setEditingId(prop.id);
    setEditTokkoId(prop.tokko_id || '');
    setEditWebUrl(prop.web_url || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTokkoId('');
    setEditWebUrl('');
  };

  const saveLink = async (propertyId: string) => {
    setSaving(propertyId);
    setMessage(null);

    try {
      const res = await fetch(`/api/properties/${propertyId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokko_id: editTokkoId || null,
          web_url: editWebUrl || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setMessage({ type: 'success', text: `Propiedad vinculada correctamente` });
      setEditingId(null);
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

      if (!res.ok) {
        throw new Error(data.error);
      }

      setMessage({ type: 'success', text: 'Datos sincronizados desde Tokko' });
      fetchProperties();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(null);
    }
  };

  const linkFromTokko = (tokkoId: number, tokkoAddress: string, tokkoWebUrl: string) => {
    // Find a matching property by address similarity or let user choose
    const match = properties.find(p =>
      !p.tokko_id &&
      (p.address.toLowerCase().includes(tokkoAddress.toLowerCase().slice(0, 15)) ||
       tokkoAddress.toLowerCase().includes(p.address.toLowerCase().slice(0, 15)))
    );

    if (match) {
      setEditingId(match.id);
      setEditTokkoId(String(tokkoId));
      setEditWebUrl(tokkoWebUrl || editWebUrl);
      setMessage({ type: 'success', text: `Coincidencia encontrada: "${match.address}". Confirmá para vincular.` });
    } else {
      setMessage({ type: 'error', text: `No se encontró coincidencia automática para "${tokkoAddress}". Editá manualmente la propiedad que corresponda o usá "Crear y vincular".` });
      setEditTokkoId(String(tokkoId));
      setEditWebUrl(tokkoWebUrl || '');
    }
  };

  const createAndLink = async (tokko: TokkoProperty) => {
    setSaving(String(tokko.id));
    setMessage(null);

    try {
      // Create local property from Tokko data
      const createRes = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: tokko.address,
          price: tokko.price || null,
          tokko_id: String(tokko.id),
          web_url: tokko.web_url || null,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error);

      // Now link it to sync Tokko data
      const linkRes = await fetch(`/api/properties/${createData.property.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokko_id: String(tokko.id),
          web_url: tokko.web_url || null,
        }),
      });

      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error);

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
                      <strong>{prop.owners?.name || '-'}</strong>
                      {prop.owners?.whatsapp && (
                        <div style={{ fontSize: '12px', color: '#666' }}>{prop.owners.whatsapp}</div>
                      )}
                    </td>
                    <td style={tdStyle}>{prop.address}</td>
                    <td style={tdStyle}>{prop.neighborhood || '-'}</td>
                    <td style={tdStyle}>
                      {prop.price ? `USD ${prop.price.toLocaleString()}` : '-'}
                    </td>

                    {editingId === prop.id ? (
                      <>
                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={editTokkoId}
                            onChange={e => setEditTokkoId(e.target.value)}
                            placeholder="Ej: 12345"
                            style={inputStyle}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={editWebUrl}
                            onChange={e => setEditWebUrl(e.target.value)}
                            placeholder="https://..."
                            style={{ ...inputStyle, minWidth: '200px' }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => saveLink(prop.id)}
                              disabled={saving === prop.id}
                              style={btnSave}
                            >
                              {saving === prop.id ? '...' : 'Guardar'}
                            </button>
                            <button onClick={cancelEditing} style={btnCancel}>
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
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
                            <button onClick={() => startEditing(prop)} style={btnEdit}>
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
                      </>
                    )}
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
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px', verticalAlign: 'top',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px',
};

const btnEdit: React.CSSProperties = {
  padding: '4px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
};

const btnSave: React.CSSProperties = {
  padding: '4px 12px', background: '#0070f3', color: 'white', border: 'none',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
};

const btnCancel: React.CSSProperties = {
  padding: '4px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1',
  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
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
