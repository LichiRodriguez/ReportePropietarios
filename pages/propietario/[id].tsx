import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Owner {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  created_at: string;
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
}

interface Report {
  id: string;
  report_month: string;
  status: string;
  metrics: {
    total_views: number;
    leads_count: number;
    visit_requests: number;
    favorites_count: number;
  } | null;
  custom_notes: string | null;
  generated_at: string;
  sent_at: string | null;
  property_id: string;
  properties: { address: string } | null;
}

interface Delivery {
  id: string;
  report_id: string;
  delivery_method: string;
  recipient_phone: string;
  status: string;
  sent_at: string;
}

export default function PropietarioPage() {
  const router = useRouter();
  const { id } = router.query;

  const [owner, setOwner] = useState<Owner | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Observations state
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchOwnerData();
  }, [id]);

  const fetchOwnerData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/owners/${id}`);
      if (!res.ok) throw new Error('No se pudo cargar el propietario');
      const data = await res.json();

      setOwner(data.owner);
      setProperties(data.properties || []);
      setReports(data.reports || []);
      setDeliveries(data.deliveries || []);

      // Initialize observations from custom_notes
      const notes: Record<string, string> = {};
      (data.reports || []).forEach((r: Report) => {
        if (r.custom_notes) notes[r.id] = r.custom_notes;
      });
      setObservations(notes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveObservation = async (reportId: string) => {
    setSavingNote(reportId);
    setNoteMessage(null);

    try {
      const res = await fetch(`/api/reports/${reportId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_notes: observations[reportId] || '' }),
      });

      if (!res.ok) throw new Error('Error al guardar');
      setNoteMessage({ id: reportId, type: 'success', text: 'Guardado' });
      setTimeout(() => setNoteMessage(null), 2000);
    } catch (err: any) {
      setNoteMessage({ id: reportId, type: 'error', text: err.message });
    } finally {
      setSavingNote(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      draft: { bg: '#fef3c7', color: '#92400e', label: 'Borrador' },
      reviewed: { bg: '#dbeafe', color: '#1e40af', label: 'Revisado' },
      sent: { bg: '#dcfce7', color: '#166534', label: 'Enviado' },
    };
    const s = styles[status] || styles.draft;
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

  const getDeliveriesForReport = (reportId: string) =>
    deliveries.filter(d => d.report_id === reportId);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Cargando...
      </div>
    );
  }

  if (error || !owner) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#ef4444' }}>{error || 'Propietario no encontrado'}</p>
        <Link href="/vincular" style={{ color: '#0070f3' }}>Volver</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link href="/vincular" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '14px' }}>
          &larr; Volver a Vincular
        </Link>
      </div>

      {/* Owner Info Card */}
      <div style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ margin: '0 0 16px', fontSize: '24px' }}>{owner.name}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {owner.phone && (
            <div>
              <div style={infoLabel}>Teléfono</div>
              <div style={infoValue}>{owner.phone}</div>
            </div>
          )}
          {owner.whatsapp && (
            <div>
              <div style={infoLabel}>WhatsApp</div>
              <div style={infoValue}>{owner.whatsapp}</div>
            </div>
          )}
          {owner.email && (
            <div>
              <div style={infoLabel}>Email</div>
              <div style={infoValue}>{owner.email}</div>
            </div>
          )}
          <div>
            <div style={infoLabel}>Propiedades</div>
            <div style={infoValue}>{properties.length}</div>
          </div>
          <div>
            <div style={infoLabel}>Reportes enviados</div>
            <div style={infoValue}>{reports.filter(r => r.status === 'sent').length}</div>
          </div>
        </div>
      </div>

      {/* Properties */}
      <div style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>Propiedades</h2>
        {properties.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Sin propiedades asignadas</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {properties.map(prop => (
              <div key={prop.id} style={{
                padding: '12px 16px', background: '#f8fafc', borderRadius: '8px',
                border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{prop.address}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {prop.neighborhood && <span>{prop.neighborhood} &middot; </span>}
                    {prop.property_type === 'rent' ? 'Alquiler' : 'Venta'}
                    {prop.price ? ` &middot; USD ${prop.price.toLocaleString()}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {prop.tokko_id && (
                    <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#166534' }}>
                      Tokko: {prop.tokko_id}
                    </span>
                  )}
                  {prop.web_url && (
                    <a href={prop.web_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: '#0070f3' }}>
                      Ver publicación
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reports History */}
      <div style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>Historial de Reportes</h2>
        {reports.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No se generaron reportes todavía</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reports.map(report => {
              const reportDeliveries = getDeliveriesForReport(report.id);
              return (
                <div key={report.id} style={{
                  border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px',
                  background: '#fafafa',
                }}>
                  {/* Report header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>
                        {new Date(report.report_month).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '8px' }}>
                        {report.properties?.address || ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {getStatusBadge(report.status)}
                      <button
                        onClick={() => window.open(`/api/reports/${report.id}/preview`, '_blank')}
                        style={{ padding: '4px 10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Ver
                      </button>
                    </div>
                  </div>

                  {/* Metrics */}
                  {report.metrics && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      <div style={metricBox}>
                        <div style={metricNumber}>{report.metrics.total_views || 0}</div>
                        <div style={metricLabel}>Vistas</div>
                      </div>
                      <div style={metricBox}>
                        <div style={metricNumber}>{report.metrics.leads_count || 0}</div>
                        <div style={metricLabel}>Consultas</div>
                      </div>
                      <div style={metricBox}>
                        <div style={metricNumber}>{report.metrics.visit_requests || 0}</div>
                        <div style={metricLabel}>Visitas</div>
                      </div>
                      <div style={metricBox}>
                        <div style={metricNumber}>{report.metrics.favorites_count || 0}</div>
                        <div style={metricLabel}>Favoritos</div>
                      </div>
                    </div>
                  )}

                  {/* Delivery info */}
                  {reportDeliveries.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                      {reportDeliveries.map(d => (
                        <div key={d.id}>
                          Enviado por {d.delivery_method} a {d.recipient_phone}
                          {d.sent_at && ` el ${new Date(d.sent_at).toLocaleDateString('es-AR')}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {report.sent_at && !reportDeliveries.length && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                      Enviado el {new Date(report.sent_at).toLocaleDateString('es-AR')}
                    </div>
                  )}

                  {/* Observations */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Observaciones
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <textarea
                        value={observations[report.id] || ''}
                        onChange={e => setObservations(prev => ({ ...prev, [report.id]: e.target.value }))}
                        placeholder="Qué respondió el propietario, notas, seguimiento..."
                        rows={2}
                        style={{
                          flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px',
                          fontSize: '13px', resize: 'vertical', fontFamily: 'sans-serif',
                        }}
                      />
                      <button
                        onClick={() => saveObservation(report.id)}
                        disabled={savingNote === report.id}
                        style={{
                          padding: '8px 14px', background: '#0070f3', color: 'white', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-start',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {savingNote === report.id ? '...' : 'Guardar'}
                      </button>
                    </div>
                    {noteMessage && noteMessage.id === report.id && (
                      <div style={{
                        fontSize: '12px', marginTop: '4px',
                        color: noteMessage.type === 'success' ? '#16a34a' : '#dc2626',
                      }}>
                        {noteMessage.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const infoLabel: React.CSSProperties = {
  fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '2px',
};

const infoValue: React.CSSProperties = {
  fontSize: '15px', color: '#1e293b',
};

const metricBox: React.CSSProperties = {
  textAlign: 'center', padding: '6px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0',
};

const metricNumber: React.CSSProperties = {
  fontSize: '18px', fontWeight: 'bold', color: '#1e40af',
};

const metricLabel: React.CSSProperties = {
  fontSize: '10px', color: '#64748b',
};
