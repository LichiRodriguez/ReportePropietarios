import { useState, useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getTenantFromPageContext, type Tenant } from '@/lib/auth';

interface Stats {
  total_properties: number;
  reports_generated: number;
  reports_sent: number;
  reports_pending: number;
}

export default function Dashboard({ tenant }: { tenant: Tenant }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const now = new Date();
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const progress = stats && stats.total_properties > 0
    ? Math.round((stats.reports_generated / stats.total_properties) * 100)
    : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</p>
        </div>
        {tenant.logo_url && (
          <img src={tenant.logo_url} alt="" style={{ height: '40px', objectFit: 'contain' }} />
        )}
      </div>

      {!stats ? (
        <p style={{ color: '#999' }}>Cargando...</p>
      ) : (
        <>
          <div style={styles.grid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_properties}</div>
              <div style={styles.statLabel}>Propiedades</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.reports_generated}</div>
              <div style={styles.statLabel}>Reportes generados</div>
              {stats.total_properties > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={styles.progressBg}>
                    <div style={{ ...styles.progressBar, width: `${progress}%` }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{progress}% del total</div>
                </div>
              )}
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#16a34a' }}>{stats.reports_sent}</div>
              <div style={styles.statLabel}>Enviados</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: stats.reports_pending > 0 ? '#f59e0b' : '#999' }}>{stats.reports_pending}</div>
              <div style={styles.statLabel}>Pendientes</div>
            </div>
          </div>

          <div style={{ marginTop: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#333' }}>Acciones rapidas</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/reports" style={styles.actionBtn}>
                Ver Reportes
              </Link>
              <Link href="/import" style={{ ...styles.actionBtn, background: '#0284c7' }}>
                Importar Propietarios
              </Link>
              <Link href="/vincular" style={{ ...styles.actionBtn, background: '#6366f1' }}>
                Vincular con Tokko
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const tenant = await getTenantFromPageContext(req);
  if (!tenant) {
    return { redirect: { destination: '/auth-required', permanent: false } };
  }
  return { props: { tenant } };
};

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '32px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  title: { fontSize: '28px', fontWeight: 700, margin: 0 },
  subtitle: { fontSize: '15px', color: '#666', margin: '4px 0 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  statCard: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' as const },
  statValue: { fontSize: '32px', fontWeight: 700, color: '#1e40af' },
  statLabel: { fontSize: '13px', color: '#666', marginTop: '4px' },
  progressBg: { background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' },
  progressBar: { background: '#1e40af', height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  actionBtn: { padding: '12px 24px', background: '#1e40af', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 },
};
