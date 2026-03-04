import { useState, useRef } from 'react';
import Link from 'next/link';

interface ImportResult {
  row: number;
  owner_name: string;
  property_address: string;
  status: 'created' | 'error';
  error?: string;
}

interface ImportResponse {
  success: boolean;
  summary: {
    total_rows: number;
    owners_created: number;
    properties_created: number;
    errors: number;
  };
  results: ImportResult[];
  error?: string;
  details?: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResponse(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const rows = lines.slice(0, 6).map(line => {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current.trim());
        return fields;
      });
      setPreview(rows);
    };
    reader.readAsText(selected);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const text = await file.text();

      const res = await fetch('/api/import/owners-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: text }),
      });

      const data: ImportResponse = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al importar');
        if (data.details) {
          setError(data.error + '\n' + data.details.join('\n'));
        }
      } else {
        setResponse(data);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '14px' }}>
          &larr; Volver al inicio
        </Link>
      </div>

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
        Importar Propietarios y Propiedades
      </h1>
      <p style={{ color: '#64748b', marginBottom: '32px' }}>
        Cargá un archivo CSV con los datos de tus propietarios y sus propiedades.
      </p>

      {/* Download template */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px',
        padding: '16px', marginBottom: '24px',
      }}>
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>Formato del CSV</p>
        <p style={{ fontSize: '14px', color: '#475569', marginBottom: '12px' }}>
          Descargá la plantilla con las columnas correctas. Completá los datos y subí el archivo.
          <br />
          <strong>Columnas obligatorias:</strong> nombre_propietario, direccion_propiedad
          <br />
          <strong>Opcionales:</strong> email, telefono, whatsapp, barrio, tipo_operacion (sale/rent), precio, superficie_total, ambientes, banos
        </p>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          Si un propietario tiene varias propiedades, repetí el nombre y teléfono en cada fila con distinta dirección.
        </p>
        <a
          href="/plantilla_propietarios.csv"
          download
          style={{
            display: 'inline-block', padding: '8px 16px',
            background: '#0284c7', color: 'white', borderRadius: '6px',
            textDecoration: 'none', fontSize: '14px',
          }}
        >
          Descargar plantilla CSV
        </a>
      </div>

      {/* File upload */}
      <div style={{
        border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '32px',
        textAlign: 'center', marginBottom: '24px', cursor: 'pointer',
        background: file ? '#f0fdf4' : '#fafafa',
      }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {file ? (
          <p style={{ fontSize: '16px', color: '#16a34a' }}>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        ) : (
          <p style={{ fontSize: '16px', color: '#94a3b8' }}>
            Hacé click para seleccionar un archivo CSV
          </p>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div style={{ marginBottom: '24px', overflowX: 'auto' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Vista previa (primeras {Math.min(preview.length - 1, 5)} filas)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {preview[0].map((header, i) => (
                  <th key={i} style={{
                    padding: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                    textAlign: 'left', whiteSpace: 'nowrap',
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(1).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{
                      padding: '8px', border: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload button */}
      {file && !response && (
        <button
          onClick={handleUpload}
          disabled={loading}
          style={{
            padding: '12px 24px', background: loading ? '#94a3b8' : '#0070f3',
            color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '24px',
          }}
        >
          {loading ? 'Importando...' : 'Importar datos'}
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '16px', marginBottom: '24px', whiteSpace: 'pre-wrap',
        }}>
          <p style={{ color: '#dc2626', fontWeight: 600 }}>Error</p>
          <p style={{ color: '#b91c1c', fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {response && (
        <div>
          <div style={{
            background: response.summary.errors === 0 ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${response.summary.errors === 0 ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '8px', padding: '16px', marginBottom: '24px',
          }}>
            <p style={{ fontWeight: 600, fontSize: '18px', marginBottom: '12px' }}>
              Importación completada
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{response.summary.total_rows}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Filas procesadas</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0284c7' }}>{response.summary.owners_created}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Propietarios</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{response.summary.properties_created}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Propiedades creadas</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: response.summary.errors > 0 ? '#dc2626' : '#16a34a' }}>
                  {response.summary.errors}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Errores</div>
              </div>
            </div>
          </div>

          {/* Detail table */}
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Detalle</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', textAlign: 'left' }}>Propietario</th>
                <th style={{ padding: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', textAlign: 'left' }}>Propiedad</th>
                <th style={{ padding: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', textAlign: 'left' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {response.results.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{r.owner_name}</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{r.property_address}</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>
                    {r.status === 'created' ? (
                      <span style={{ color: '#16a34a' }}>Creado</span>
                    ) : (
                      <span style={{ color: '#dc2626' }} title={r.error}>Error: {r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
