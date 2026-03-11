import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getTenantFromPageContext } from '@/lib/auth';

export default function Home() {
  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <h1>Sistema de Reportes Automaticos</h1>
      <p>Generacion mensual de reportes para propietarios</p>
      <br />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href="/reports"
          style={{
            padding: '10px 20px',
            background: '#0070f3',
            color: 'white',
            borderRadius: '5px',
            textDecoration: 'none'
          }}>
          Ver Panel de Reportes
        </Link>
        <Link href="/import"
          style={{
            padding: '10px 20px',
            background: '#0284c7',
            color: 'white',
            borderRadius: '5px',
            textDecoration: 'none'
          }}>
          Importar Propietarios
        </Link>
        <Link href="/vincular"
          style={{
            padding: '10px 20px',
            background: '#6366f1',
            color: 'white',
            borderRadius: '5px',
            textDecoration: 'none'
          }}>
          Vincular con Tokko
        </Link>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const tenant = await getTenantFromPageContext(req);
  if (!tenant) {
    return { redirect: { destination: '/auth-required', permanent: false } };
  }
  return { props: {} };
};
