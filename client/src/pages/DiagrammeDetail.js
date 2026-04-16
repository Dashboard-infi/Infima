import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { api } from '../api';

const JOURS_SEMAINE = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const COULEURS_LEGENDE = ['#0A3D62', '#1D9E75', '#D4A017', '#A32D2D', '#7C3AED', '#DB2777', '#0891B2', '#EA580C'];

export default function DiagrammeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [diag, setDiag] = useState(null);
  const [cases, setCases] = useState([]);
  const [legendes, setLegendes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showLegendeForm, setShowLegendeForm] = useState(false);
  const [newLegende, setNewLegende] = useState({ label: '', couleur: '#0A3D62' });
  const [selectedLegendes, setSelectedLegendes] = useState({});
  const sigRef = useRef();

  const loadDiagramme = useCallback(() => {
    api.getDiagramme(id).then(data => {
      setDiag(data);
      const loadedCases = data.cases || [];
      setCases(loadedCases);
      const sel = {};
      loadedCases.forEach(c => {
        if (c.legendes) {
          try { sel[c.id] = typeof c.legendes === 'string' ? JSON.parse(c.legendes) : c.legendes; }
          catch { sel[c.id] = []; }
        } else { sel[c.id] = []; }
      });
      setSelectedLegendes(sel);
    }).catch(() => navigate('/soins'));
  }, [id, navigate]);

  const loadLegendes = useCallback(() => {
    if (!diag) return;
    api.getLegendes(diag.patient_id).then(setLegendes).catch(() => {});
  }, [diag]);

  useEffect(() => { loadDiagramme(); }, [loadDiagramme]);
  useEffect(() => { loadLegendes(); }, [loadLegendes]);

  const toggleCase = (caseId, field) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, [field]: !c[field] } : c));
  };

  const toggleLegendeOnCase = (caseId, legendeId) => {
    setSelectedLegendes(prev => {
      const current = prev[caseId] || [];
      const updated = current.includes(legendeId) ? current.filter(l => l !== legendeId) : [...current, legendeId];
      return { ...prev, [caseId]: updated };
    });
  };

  const saveCases = async () => {
    setSaving(true);
    try {
      const casesWithLegendes = cases.map(c => ({ ...c, legendes: JSON.stringify(selectedLegendes[c.id] || []) }));
      await api.updateCases(id, { cases: casesWithLegendes });
      alert('Diagramme sauvegardé !');
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const addLegende = async () => {
    if (!newLegende.label.trim()) return;
    try {
      await api.createLegende(diag.patient_id, newLegende);
      setNewLegende({ label: '', couleur: '#0A3D62' });
      setShowLegendeForm(false);
      loadLegendes();
    } catch (err) { alert(err.message); }
  };

  const removeLegende = async (legendeId) => {
    if (!window.confirm('Supprimer cette légende ?')) return;
    try {
      await api.deleteLegende(legendeId);
      loadLegendes();
    } catch (err) { alert(err.message); }
  };

  const signer = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Veuillez signer avant de valider');
      return;
    }
    try {
      const signatureData = sigRef.current.toDataURL();
      const casesWithLegendes = cases.map(c => ({ ...c, legendes: JSON.stringify(selectedLegendes[c.id] || []) }));
      await api.updateCases(id, { cases: casesWithLegendes });
      await api.signerDiagramme(id, { signature_data: signatureData });
      alert('Diagramme signé avec succès !');
      loadDiagramme();
    } catch (err) { alert(err.message); }
  };

  const clearSignature = () => { if (sigRef.current) sigRef.current.clear(); };

  const getLegendeById = (lid) => legendes.find(l => l.id === lid);

  if (!diag) return <div style={{ textAlign: 'center', padding: 40, color: '#7a8499' }}>Chargement...</div>;

  return (
    <div>
      <button className="header-back" onClick={() => navigate('/soins')} style={{ color: '#0A3D62', marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Retour
      </button>

      <div className="card" style={{ background: 'linear-gradient(135deg, #0A3D62 0%, #185FA5 100%)', color: '#fff', border: 'none' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {diag.patient_nom} {diag.patient_prenom}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 2 }}>{diag.type_soin}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Dr. {diag.medecin || diag.medecin_traitant || '—'}
        </div>
        {diag.notes && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Notes : {diag.notes}</div>}
        {diag.signe_le && (
          <span style={{ display: 'inline-block', marginTop: 8, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
            Signé le {new Date(diag.signe_le).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>

      {/* Légendes */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1f2e', textTransform: 'uppercase', letterSpacing: 0.5 }}>Légende des soins</div>
          {!diag.signe_le && (
            <button onClick={() => setShowLegendeForm(!showLegendeForm)}
              style={{ fontSize: 11, fontWeight: 600, color: '#185FA5', background: '#E6F1FB', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
              {showLegendeForm ? 'Annuler' : '+ Ajouter'}
            </button>
          )}
        </div>

        {showLegendeForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <input value={newLegende.label} onChange={e => setNewLegende({ ...newLegende, label: e.target.value })}
                placeholder="Ex: Pansement, Injection..." style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e3ea', borderRadius: 8, fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {COULEURS_LEGENDE.map(c => (
                <div key={c} onClick={() => setNewLegende({ ...newLegende, couleur: c })}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: newLegende.couleur === c ? '3px solid #1a1f2e' : '2px solid transparent' }} />
              ))}
            </div>
            <button onClick={addLegende} style={{ background: '#0A3D62', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>OK</button>
          </div>
        )}

        {legendes.length === 0 ? (
          <div style={{ fontSize: 11, color: '#7a8499', textAlign: 'center', padding: '8px 0' }}>Aucune légende. Ajoutez des soins types pour ce patient.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {legendes.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: l.couleur + '18', padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${l.couleur}40` }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.couleur }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: l.couleur }}>{l.label}</span>
                {!diag.signe_le && (
                  <button onClick={() => removeLegende(l.id)} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '0 2px', lineHeight: 1 }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grille par jour */}
      {cases.map((c, idx) => {
        const d = new Date(c.jour);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isToday = new Date().toDateString() === d.toDateString();
        const jourLabel = `${JOURS_SEMAINE[d.getDay()]} ${d.getDate()}`;
        const caseLeg = selectedLegendes[c.id] || [];
        return (
          <div key={c.id} className="card" style={{
            padding: '10px 12px', marginBottom: 6,
            borderLeft: isToday ? '4px solid #0A3D62' : isWeekend ? '4px solid #A32D2D' : '4px solid transparent',
            background: isToday ? '#E6F1FB' : idx % 2 === 0 ? '#fff' : '#fafbfc'
          }}>
            {/* Jour + Matin/Midi/Soir */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: legendes.length > 0 ? 8 : 0 }}>
              <div style={{
                fontSize: 11, fontWeight: isToday ? 700 : 600, minWidth: 44,
                color: isToday ? '#0A3D62' : isWeekend ? '#A32D2D' : '#3d4555'
              }}>{jourLabel}</div>
              {['matin', 'midi', 'soir'].map(field => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                  <div
                    className={`check-box ${c[field] ? 'done' : ''}`}
                    onClick={() => !diag.signe_le && toggleCase(c.id, field)}
                    style={{ width: 22, height: 22, cursor: diag.signe_le ? 'default' : 'pointer' }}
                  >
                    {c[field] && (
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: '#7a8499', textTransform: 'capitalize' }}>{field}</span>
                </div>
              ))}
            </div>
            {/* Légendes verticales avec checkbox */}
            {legendes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid #f0f2f5' }}>
                {legendes.map(l => {
                  const isSelected = caseLeg.includes(l.id);
                  return (
                    <div key={l.id}
                      onClick={() => !diag.signe_le && toggleLegendeOnCase(c.id, l.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: diag.signe_le ? 'default' : 'pointer' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: isSelected ? `2px solid ${l.couleur}` : '2px solid #c8ccd6',
                        background: isSelected ? l.couleur : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: isSelected ? l.couleur : '#7a8499' }}>{l.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!diag.signe_le && (
        <>
          <button className="btn btn-secondary mb-2" onClick={saveCases} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.5"/><path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="1.5"/></svg>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
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
