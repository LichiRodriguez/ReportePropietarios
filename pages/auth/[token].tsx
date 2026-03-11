import type { GetServerSideProps } from 'next';
import { getTenantByToken, buildSessionCookie } from '@/lib/auth';

export default function AuthPage({ error }: { error?: boolean }) {
  if (error) {
    return (
      <div style={{
        padding: '60px 40px',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '0 auto',
      }}>
        <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Enlace invalido o expirado</h2>
        <p style={{ color: '#64748b' }}>
          Contacta a tu asesor para obtener un nuevo enlace de acceso.
        </p>
      </div>
    );
  }
  return <p style={{ padding: '40px', fontFamily: 'sans-serif' }}>Redirigiendo...</p>;
}

export const getServerSideProps: GetServerSideProps = async ({ params, res, req }) => {
  const token = params?.token as string;

  const tenant = await getTenantByToken(token);

  if (!tenant) {
    return { props: { error: true } };
  }

  const secure = req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', buildSessionCookie(tenant.id, secure));

  return {
    redirect: { destination: '/reports', permanent: false },
  };
};
