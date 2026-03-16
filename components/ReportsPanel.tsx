import React, { useState, useEffect } from 'react';
import { generateWhatsAppUrl } from '../lib/whatsapp';

interface Report {
  id: string;
  property_id: string;
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

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface Props {
  propertiesCount?: number;
}

export default function ReportsPanel({ propertiesCount = 0 }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'reviewed' | 'sent'>('all');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  useEffect(() => {
    fetchReports();
  }, [selectedMonth]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/pending?month=${selectedMonth}`);
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

  const handleGenerateReports = async (force = false) => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
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

  const handleRegenerate = async (report: Report) => {
    if (!confirm(`¿Regenerar el reporte de "${report.properties?.address}"? Se va a borrar el actual y crear uno nuevo con métricas de Tokko.`)) return;

    setRegenerating(report.id);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: report.property_id,
          month: report.report_month,
          force: true,
        }),
      });

      if (!res.ok) throw new Error('Error al regenerar');
      await fetchReports();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRegenerating(null);
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

  const isCurrentMonth = selectedMonth === getCurrentMonth();

  // Welcome screen for tenants with no properties
  if (!loading && propertiesCount === 0) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '60px 24px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Bienvenido al Sistema de Reportes</h1>
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '40px' }}>
          Para empezar a generar reportes, segui estos 3 pasos:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
          <a href="/import" style={welcomeCard}>
            <div style={stepNum}>1</div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Importar</div>
            <div style={{ fontSize: '13px', color: '#666' }}>Carga tus propietarios y propiedades desde un CSV</div>
          </a>
          <a href="/vincular" style={welcomeCard}>
            <div style={stepNum}>2</div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Vincular con Tokko</div>
            <div style={{ fontSize: '13px', color: '#666' }}>Conecta cada propiedad con TokkoBoker para traer metricas</div>
          </a>
          <div style={welcomeCard}>
            <div style={stepNum}>3</div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Generar reportes</div>
            <div style={{ fontSize: '13px', color: '#666' }}>Se generan automaticamente el 1ro de cada mes o manualmente</div>
          </div>
        </div>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {reports.length > 0 && (
            <button
              onClick={() => handleGenerateReports(true)}
              style={{
                padding: '10px 20px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Regenerar Todos
            </button>
          )}
          <button
            onClick={() => handleGenerateReports(false)}
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
      </div>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          style={navBtn}
        >
          &larr;
        </button>
        <span style={{ fontSize: '16px', fontWeight: 600, minWidth: '180px', textAlign: 'center' }}>
          {formatMonth(selectedMonth)}
        </span>
        <button
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          disabled={isCurrentMonth}
          style={{ ...navBtn, opacity: isCurrentMonth ? 0.3 : 1, cursor: isCurrentMonth ? 'default' : 'pointer' }}
        >
          &rarr;
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <p>Cargando reportes...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <p>No hay reportes para {formatMonth(selectedMonth)}</p>
          {propertiesCount > 0 && reports.length === 0 && isCurrentMonth && (
            <p style={{ marginTop: '8px', fontSize: '14px' }}>
              Genera tu primer reporte con el boton de arriba
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredReports.map((report) => (
            <div
              key={report.id}
              style={{
                background: report.status === 'sent' ? '#fafafa' : 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    {report.properties?.address || 'Sin dirección'}
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Propietario: {report.properties?.owners?.name || 'Sin asignar'}
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
                  onClick={() => handleRegenerate(report)}
                  disabled={regenerating === report.id}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    cursor: regenerating === report.id ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {regenerating === report.id ? 'Regenerando...' : 'Regenerar'}
                </button>
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
                    {sending === report.id ? 'Preparando...' : 'Enviar WhatsApp'}
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

const welcomeCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '24px 16px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  textDecoration: 'none',
  color: 'inherit',
};

const stepNum: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  background: '#1e40af',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: 700,
  marginBottom: '12px',
};

const navBtn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: 'white',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 600,
};
