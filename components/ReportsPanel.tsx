import React, { useState, useEffect } from 'react';
import { generateWhatsAppUrl } from '../lib/whatsapp';

interface Report {
  id: string;
  status: string;
  report_month: string;
  generated_at: string;
  sent_at: string | null;
  custom_notes: string | null;
  metrics: {
    total_views: number;
    leads_count: number;
    visit_requests: number;
    favorites_count: number;
  };
  properties: {
    address: string;
    price: number;
    owners: {
      name: string;
      phone: string;
      whatsapp: string;
    };
  };
}

export default function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'reviewed' | 'sent'>('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports/pending');
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (reportId: string) => {
    try {
      setSending(reportId);

      const res = await fetch(`/api/reports/${reportId}/prepare-send`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to prepare report');

      const data = await res.json();

      const whatsappUrl = generateWhatsAppUrl(data.phone, data.message);
      window.open(whatsappUrl, '_blank');

      await fetch(`/api/reports/${reportId}/mark-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone }),
      });

      await fetchReports();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSending(null);
    }
  };

  const handlePreview = (reportId: string) => {
    window.open(`/api/reports/${reportId}/preview`, '_blank');
  };

  const handleGenerateReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to generate reports');

      const result = await res.json();
      alert(`Reportes generados: ${result.reports_generated || 0}`);
      await fetchReports();
    } catch (err: any) {
      alert(`Error generando reportes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter((r) => r.status === filter);

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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <p>Cargando reportes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        <p>Error: {error}</p>
        <button onClick={fetchReports} style={{ marginTop: '16px', padding: '8px 16px' }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Panel de Reportes</h1>
        <button
          onClick={handleGenerateReports}
          style={{
            padding: '10px 20px',
            background: '#1e40af',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Generar Reportes
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['all', 'draft', 'reviewed', 'sent'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: filter === f ? '#1e40af' : 'white',
              color: filter === f ? 'white' : '#64748b',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {f === 'all' ? 'Todos' : f === 'draft' ? 'Borradores' : f === 'reviewed' ? 'Revisados' : 'Enviados'}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <p>No hay reportes para mostrar</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredReports.map((report) => (
            <div
              key={report.id}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    {report.properties.address}
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Propietario: {report.properties.owners.name}
                  </p>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {new Date(report.report_month).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>{getStatusBadge(report.status)}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '16px 0' }}>
                <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                    {report.metrics?.total_views || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Vistas</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                    {report.metrics?.leads_count || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Consultas</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                    {report.metrics?.visit_requests || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Visitas</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                    {report.metrics?.favorites_count || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Favoritos</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handlePreview(report.id)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Vista Previa
                </button>
                {report.status !== 'sent' && (
                  <button
                    onClick={() => handleSend(report.id)}
                    disabled={sending === report.id}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#22c55e',
                      color: 'white',
                      cursor: sending === report.id ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {sending === report.id ? 'Enviando...' : 'Enviar WhatsApp'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
