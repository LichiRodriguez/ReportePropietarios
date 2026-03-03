import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <h1>Sistema de Reportes Automaticos</h1>
      <p>Generacion mensual de reportes para propietarios</p>
      <br />
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
    </div>
  );
}
