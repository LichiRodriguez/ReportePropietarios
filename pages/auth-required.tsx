export default function AuthRequired() {
  return (
    <div style={{
      padding: '60px 40px',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      maxWidth: '500px',
      margin: '0 auto',
    }}>
      <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Acceso no autorizado</h2>
      <p style={{ color: '#64748b' }}>
        Para acceder al sistema de reportes necesitas el enlace que te envio tu asesor.
        Si no lo tenes, contactalo para que te lo reenvie.
      </p>
    </div>
  );
}
