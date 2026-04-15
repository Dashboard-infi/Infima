import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { api } from '../api';

const JOURS_SEMAINE = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function DiagrammeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [diag, setDiag] = useState(null);
  const [cases, setCases] = useState([]);
  const [saving, setSaving] = useState(false);
  const sigRef = useRef();

  const loadDiagramme = useCallback(() => {
    api.getDiagramme(id).then(data => {
      setDiag(data);
      setCases(data.cases || []);
    }).catch(() => navigate('/soins'));
  }, [id, navigate]);

  useEffect(() => {
    loadDiagramme();
  }, [loadDiagramme]);

  const toggleCase = (caseId, field) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, [field]: !c[field] } : c));
  };

  const saveCases = async () => {
    setSaving(true);
    try {
      await api.updateCases(id, { cases });
      alert('Diagramme sauvegardé !');
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const signer = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Veuillez signer avant de valider');
      return;
    }
    try {
      const signatureData = sigRef.current.toDataURL();
      await api.updateCases(id, { cases });
      await api.signerDiagramme(id, { signature_data: signatureData });
      alert('Diagramme signé avec succès !');
      loadDiagramme();
    } catch (err) { alert(err.message); }
  };

  const clearSignature = () => {
    if (sigRef.current) sigRef.current.clear();
  };

  if (!diag) return <div style={{ textAlign: 'center', padding: 40, color: '#7a8499' }}>Chargement...</div>;

  return (
    <div>
      <button className="header-back" onClick={() => navigate('/soins')} style={{ color: '#0A3D62', marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Retour
      </button>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {diag.patient_nom} {diag.patient_prenom} — {diag.type_soin}
        </div>
        <div style={{ fontSize: 11, color: '#7a8499' }}>
          Dr. {diag.medecin || diag.medecin_traitant || '—'}
        </div>
        {diag.notes && <div style={{ fontSize: 11, color: '#7a8499', marginTop: 4 }}>Notes : {diag.notes}</div>}
        {diag.signe_le && <span className="badge badge-green" style={{ marginTop: 6 }}>Signé le {new Date(diag.signe_le).toLocaleDateString('fr-FR')}</span>}
      </div>

      {/* Grille Matin / Midi / Soir */}
      <div className="card">
        <div className="diag-grid">
          <div></div>
          <div className="diag-header">Matin</div>
          <div className="diag-header">Midi</div>
          <div className="diag-header">Soir</div>

          {cases.map(c => {
            const d = new Date(c.jour);
            const jourLabel = `${JOURS_SEMAINE[d.getDay()]} ${d.getDate()}`;
            return (
              <React.Fragment key={c.id}>
                <div className="diag-day">{jourLabel}</div>
                {['matin', 'midi', 'soir'].map(field => (
                  <div className="diag-cell" key={field}>
                    <div
                      className={`check-box ${c[field] ? 'done' : ''}`}
                      onClick={() => !diag.signe_le && toggleCase(c.id, field)}
                      style={{ width: 20, height: 20, cursor: diag.signe_le ? 'default' : 'pointer' }}
                    >
                      {c[field] && (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {!diag.signe_le && (
        <>
          <button className="btn btn-secondary mb-2" onClick={saveCases} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder les cases'}
          </button>

          <div className="section-title">Signature infirmière</div>
          <div className="signature-zone">
            <SignatureCanvas
              ref={sigRef}
              penColor="#0A3D62"
              canvasProps={{ style: { width: '100%', height: 120 } }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={clearSignature} style={{ flex: 1 }}>Effacer</button>
            <button className="btn btn-primary" onClick={signer} style={{ flex: 2 }}>Valider et signer</button>
          </div>
        </>
      )}

      {diag.signe_le && diag.signature_data && (
        <div className="card mt-3">
          <div className="section-title" style={{ margin: '0 0 8px' }}>Signature</div>
          <img src={diag.signature_data} alt="Signature" style={{ maxWidth: '100%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
