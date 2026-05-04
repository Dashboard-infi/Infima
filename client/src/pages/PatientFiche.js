import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const API_BASE = process.env.REACT_APP_API_URL || 'https://infima-production.up.railway.app';

/* ============================================================
   BANNIÈRE D'ALERTES — Allergies & Médicaments
   ============================================================ */
function AlertBanner({ patient, onEdit }) {
  const allergies  = patient.allergies  ? patient.allergies.split(',').map(s => s.trim()).filter(Boolean)  : [];
  const medicaments= patient.medicaments? patient.medicaments.split(',').map(s => s.trim()).filter(Boolean): [];
  const hasAlerts  = allergies.length > 0 || medicaments.length > 0;

  return (
    <div style={{ margin: '10px 0' }}>
      {/* Bloc Allergies */}
      {allergies.length > 0 && (
        <div style={{
          background: '#FCEAEA',
          border: '1.5px solid #E24B4A',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          {/* Icône danger */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#E24B4A', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, marginTop: 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="white"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="17" r="1" fill="#E24B4A"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#791F1F', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ⚠ Allergies connues
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {allergies.map((a, i) => (
                <span key={i} style={{
                  background: '#E24B4A', color: '#fff',
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 9px', borderRadius: 20,
                }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 11, fontWeight: 600, flexShrink: 0, paddingTop: 2 }}
          >
            Modifier
          </button>
        </div>
      )}

      {/* Bloc Médicaments */}
      {medicaments.length > 0 && (
        <div style={{
          background: '#FEF3DC',
          border: '1.5px solid #BA7517',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#BA7517', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, marginTop: 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10.5 3.5a6 6 0 0 0 0 8.49l1.06 1.06 8.49-8.49a6 6 0 0 0-9.55-1.06z" fill="white" opacity="0.9"/>
              <path d="M13.5 20.5a6 6 0 0 0 8.49-8.49L12.5 2.51" stroke="white" strokeWidth="0" />
              <rect x="3" y="10" width="18" height="4" rx="2" fill="white" transform="rotate(-45 12 12)"/>
              <circle cx="8.5" cy="15.5" r="5.5" fill="white" opacity="0.9"/>
              <line x1="6" y1="15.5" x2="11" y2="15.5" stroke="#BA7517" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="8.5" y1="13" x2="8.5" y2="18" stroke="#BA7517" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#633806', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              💊 Traitement en cours
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {medicaments.map((m, i) => (
                <span key={i} style={{
                  background: '#BA7517', color: '#fff',
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 9px', borderRadius: 20,
                }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854F0B', fontSize: 11, fontWeight: 600, flexShrink: 0, paddingTop: 2 }}
          >
            Modifier
          </button>
        </div>
      )}

      {/* État vide — inviter à renseigner */}
      {!hasAlerts && (
        <div
          onClick={onEdit}
          style={{
            background: '#F7F9FB',
            border: '1.5px dashed #C8D0DA',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', marginBottom: 8,
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF1F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98A4B3" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7A8D' }}>Aucune alerte renseignée</div>
            <div style={{ fontSize: 11, color: '#98A4B3' }}>Appuyer pour ajouter allergies / médicaments</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MODAL ÉDITION ALERTES
   ============================================================ */
function AlertModal({ patient, onClose, onSave }) {
  const [allergiesText,   setAllergiesText]   = useState(patient.allergies   || '');
  const [medicamentsText, setMedicamentsText] = useState(patient.medicaments || '');
  const [loading, setLoading] = useState(false);

  // Helpers pour ajouter/retirer des chips
  const parseList = (str) => str.split(',').map(s => s.trim()).filter(Boolean);

  const removeItem = (setter, currentText, item) => {
    const newList = parseList(currentText).filter(i => i !== item);
    setter(newList.join(', '));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave({
        allergies:   allergiesText.trim() || null,
        medicaments: medicamentsText.trim() || null,
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 200 }}
    >
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Alertes médicales</div>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* ---- Allergies ---- */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E24B4A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#791F1F' }}>Allergies</span>
          </div>

          {/* Chips allergies existantes */}
          {parseList(allergiesText).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {parseList(allergiesText).map((a, i) => (
                <span key={i} style={{
                  background: '#FCEAEA', border: '1px solid #E24B4A',
                  color: '#791F1F', fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 20,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {a}
                  <button
                    onClick={() => removeItem(setAllergiesText, allergiesText, a)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 13, padding: 0, lineHeight: 1 }}
                  >×</button>
                </span>
              ))}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              value={allergiesText}
              onChange={e => setAllergiesText(e.target.value)}
              placeholder="Pénicilline, Aspirine, Latex… (séparés par des virgules)"
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#98A4B3', marginTop: 4 }}>
            Séparez chaque allergie par une virgule
          </div>
        </div>

        {/* ---- Médicaments ---- */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#BA7517', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="10" width="18" height="4" rx="2" fill="white" transform="rotate(-45 12 12)"/>
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#633806' }}>Traitement en cours</span>
          </div>

          {/* Chips médicaments existants */}
          {parseList(medicamentsText).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {parseList(medicamentsText).map((m, i) => (
                <span key={i} style={{
                  background: '#FEF3DC', border: '1px solid #BA7517',
                  color: '#633806', fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 20,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {m}
                  <button
                    onClick={() => removeItem(setMedicamentsText, medicamentsText, m)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854F0B', fontSize: 13, padding: 0, lineHeight: 1 }}
                  >×</button>
                </span>
              ))}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              value={medicamentsText}
              onChange={e => setMedicamentsText(e.target.value)}
              placeholder="Metformine 1000mg, Doliprane 500mg, Amlodipine… (séparés par des virgules)"
              rows={3}
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#98A4B3', marginTop: 4 }}>
            Incluez le dosage si connu : ex. Metformine 500mg
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer les alertes'}
        </button>
        <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 8 }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   COMPOSANT PRINCIPAL
   ============================================================ */
export default function PatientFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [vitaux, setVitaux] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState('info');
  const [showVitaux, setShowVitaux] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [vForm, setVForm] = useState({ tension: '', saturation: '', pouls: '', glycemie: '', temperature: '', eva: '', notes: '' });
  const [photoDesc, setPhotoDesc] = useState('');
  const fileRef = useRef();

  // === ÉVALUATION COMPLÈTE ===
  const [showEval, setShowEval]           = useState(false);
  const [evalPhotos, setEvalPhotos]       = useState([]);   // { file, src }
  const [evalLong, setEvalLong]           = useState('');
  const [evalLarg, setEvalLarg]           = useState('');
  const [evalLitSel, setEvalLitSel]       = useState([]);   // chips lit de plaie
  const [evalExsudat, setEvalExsudat]     = useState('');
  const [evalInfSel, setEvalInfSel]       = useState([]);   // chips infection
  const [evalEva, setEvalEva]             = useState(0);
  const [evalPans, setEvalPans]           = useState(['Mepilex Border Flex Oval 7,5 × 9,5 cm','Sorbact Gel Dressing 7,5 × 7,5 cm']);
  const [evalCompSel, setEvalCompSel]     = useState([]);
  const [evalNotes, setEvalNotes]         = useState('');
  const [evalSaving, setEvalSaving]       = useState(false);

  const loadPatient = () => {
    api.getPatient(id).then(setPatient).catch(() => navigate('/patients'));
  };

  useEffect(() => {
    loadPatient();
    api.getVitaux(id).then(setVitaux).catch(() => {});
    api.getPhotos(id).then(setPhotos).catch(() => {});
  }, [id]);

  const handleSaveAlerts = async ({ allergies, medicaments }) => {
    await api.updatePatient(id, { ...patient, allergies, medicaments });
    setPatient(prev => ({ ...prev, allergies, medicaments }));
  };

  const addVitaux = async (e) => {
    e.preventDefault();
    try {
      await api.addVitaux(id, vForm);
      setShowVitaux(false);
      setVForm({ tension: '', saturation: '', pouls: '', glycemie: '', temperature: '', eva: '', notes: '' });
      api.getVitaux(id).then(setVitaux);
    } catch (err) { alert(err.message); }
  };

  const uploadPhoto = async () => {
    const file = fileRef.current?.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('description', photoDesc);
    try {
      await api.uploadPhoto(id, formData);
      setPhotoDesc('');
      fileRef.current.value = '';
      api.getPhotos(id).then(setPhotos);
    } catch (err) { alert(err.message); }
  };

  const handleMultiPhotoUpload = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setEvalPhotos(prev => [...prev, { file, src: ev.target.result }]);
      reader.readAsDataURL(file);
    });
  };

  const toggleLit = (v) => setEvalLitSel(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev,v]);
  const toggleInf = (v) => setEvalInfSel(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev,v]);
  const toggleComp= (v) => setEvalCompSel(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev,v]);

  const saveEvaluation = async () => {
    setEvalSaving(true);
    try {
      // Upload photos
      for (const ph of evalPhotos) {
        const fd = new FormData();
        fd.append('photo', ph.file);
        fd.append('description', `Évaluation ${new Date().toLocaleDateString('fr-FR')}`);
        await api.uploadPhoto(id, fd).catch(()=>{});
      }
      // Save vitaux with eval data
      await api.addVitaux(id, {
        eva: evalEva,
        notes: [
          evalExsudat ? `Exsudat: ${evalExsudat}` : '',
          evalInfSel.length ? `Infection (${evalInfSel.length} signe(s)): ${evalInfSel.join(', ')}` : '',
          evalLitSel.length ? `Lit de plaie: ${evalLitSel.join(', ')}` : '',
          evalPans.length ? `Pansements: ${evalPans.join(', ')}` : '',
          evalCompSel.length ? `Compression: ${evalCompSel.join(', ')}` : '',
          evalLong && evalLarg ? `Surface: ${(parseFloat(evalLong)*parseFloat(evalLarg)).toFixed(2)} cm²` : '',
          evalNotes,
        ].filter(Boolean).join(' | '),
      });
      // Reload
      api.getPhotos(id).then(setPhotos);
      api.getVitaux(id).then(setVitaux);
      setShowEval(false);
      setEvalPhotos([]); setEvalLong(''); setEvalLarg('');
      setEvalLitSel([]); setEvalExsudat(''); setEvalInfSel([]);
      setEvalEva(0); setEvalPans(['Mepilex Border Flex Oval 7,5 × 9,5 cm','Sorbact Gel Dressing 7,5 × 7,5 cm']);
      setEvalCompSel([]); setEvalNotes('');
    } catch(err){ alert(err.message); }
    finally { setEvalSaving(false); }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Supprimer cette photo ?')) return;
    try {
      await api.deletePhoto(photoId);
      api.getPhotos(id).then(setPhotos);
    } catch (err) { alert(err.message); }
  };

  const handleDownloadPhoto = async (photoId, filename) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/photos/${photoId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur de telechargement');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `photo_${photoId}.webp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
  };

  if (!patient) return <div style={{ textAlign: 'center', padding: 40, color: '#7a8499' }}>Chargement...</div>;

  const initials = (patient.prenom?.[0] || '') + (patient.nom?.[0] || '');
  const latestVitaux = vitaux[0];

  return (
    <div>
      <button className="header-back" onClick={() => navigate('/patients')} style={{ color: '#0A3D62', marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Retour
      </button>

      {/* En-tête patient */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0C2D4E 0%, #1A4A6E 100%)', color: '#fff', border: 'none', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{patient.nom} {patient.prenom}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              Dr. {patient.medecin_traitant || '—'} {patient.date_naissance ? `• Né(e) ${new Date(patient.date_naissance).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
          <span style={{ background: patient.actif ? 'rgba(29,158,117,0.3)' : 'rgba(163,45,45,0.3)', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
            {patient.actif ? 'Actif' : 'Inactif'}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, opacity: 0.85 }}>
          {patient.adresse && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/></svg>
              {patient.adresse}{patient.ville ? `, ${patient.code_postal} ${patient.ville}` : ''}
            </div>
          )}
          {patient.telephone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.86 19.86 0 013.09 5.18 2 2 0 015.11 3h3a2 2 0 012 1.72c.12.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 11.91a16 16 0 006 6l2.27-2.27a2 2 0 012.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5"/></svg>
              {patient.telephone}
            </div>
          )}
          {patient.numero_secu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.5"/></svg>
              Sécu: {patient.numero_secu}
            </div>
          )}
        </div>
      </div>

      {/* ===== BANNIÈRE ALERTES ===== */}
      <AlertBanner patient={patient} onEdit={() => setShowAlertModal(true)} />

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>Vitaux</button>
        <button className={`tab ${tab === 'photos' ? 'active' : ''}`} onClick={() => setTab('photos')}>Photos</button>
        <button className={`tab ${tab === 'historique' ? 'active' : ''}`} onClick={() => setTab('historique')}>Historique</button>
      </div>

      {/* Tab Vitaux */}
      {tab === 'info' && (
        <div>
          <div className="section-title">Paramètres vitaux</div>
          {latestVitaux ? (
            <div className="vital-grid">
              <div className="vital-card" style={{ borderLeft: '3px solid #E53E3E' }}><div className="vital-val" style={{ color: '#E53E3E' }}>{latestVitaux.tension || '—'}</div><div className="vital-label">Tension (cmHg)</div></div>
              <div className="vital-card" style={{ borderLeft: '3px solid #3182CE' }}><div className="vital-val" style={{ color: '#3182CE' }}>{latestVitaux.saturation ? `${latestVitaux.saturation}%` : '—'}</div><div className="vital-label">Saturation O2</div></div>
              <div className="vital-card" style={{ borderLeft: '3px solid #D69E2E' }}><div className="vital-val" style={{ color: '#D69E2E' }}>{latestVitaux.pouls || '—'}</div><div className="vital-label">Pouls (bpm)</div></div>
              <div className="vital-card" style={{ borderLeft: '3px solid #38A169' }}><div className="vital-val" style={{ color: '#38A169' }}>{latestVitaux.glycemie || '—'}</div><div className="vital-label">Glycémie (g/L)</div></div>
              <div className="vital-card" style={{ borderLeft: '3px solid #DD6B20' }}><div className="vital-val" style={{ color: '#DD6B20' }}>{latestVitaux.temperature ? `${latestVitaux.temperature}°` : '—'}</div><div className="vital-label">Température</div></div>
              <div className="vital-card" style={{ borderLeft: '3px solid #805AD5' }}><div className="vital-val" style={{ color: '#805AD5' }}>{latestVitaux.eva != null ? `EVA ${latestVitaux.eva}/10` : '—'}</div><div className="vital-label">Douleur</div></div>
            </div>
          ) : (
            <div className="card"><p style={{ fontSize: 12, color: '#7a8499', textAlign: 'center', padding: 10 }}>Aucune mesure enregistrée</p></div>
          )}

          <button className="btn btn-primary mt-3" onClick={() => setShowVitaux(true)}>
            + Nouvelle mesure
          </button>

          {showVitaux && (
            <div className="modal-overlay" onClick={() => setShowVitaux(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-title">Nouvelle mesure</div>
                <form onSubmit={addVitaux}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="form-group"><label>Tension</label><input value={vForm.tension} onChange={e => setVForm({...vForm, tension: e.target.value})} placeholder="13/8" /></div>
                    <div className="form-group"><label>Saturation %</label><input type="number" step="0.1" value={vForm.saturation} onChange={e => setVForm({...vForm, saturation: e.target.value})} placeholder="98" /></div>
                    <div className="form-group"><label>Pouls (bpm)</label><input type="number" value={vForm.pouls} onChange={e => setVForm({...vForm, pouls: e.target.value})} placeholder="72" /></div>
                    <div className="form-group"><label>Glycémie (g/L)</label><input type="number" step="0.01" value={vForm.glycemie} onChange={e => setVForm({...vForm, glycemie: e.target.value})} placeholder="1.12" /></div>
                    <div className="form-group"><label>Température</label><input type="number" step="0.1" value={vForm.temperature} onChange={e => setVForm({...vForm, temperature: e.target.value})} placeholder="36.8" /></div>
                    <div className="form-group"><label>EVA (0-10)</label><input type="number" min="0" max="10" value={vForm.eva} onChange={e => setVForm({...vForm, eva: e.target.value})} placeholder="2" /></div>
                  </div>
                  <div className="form-group"><label>Notes</label><textarea value={vForm.notes} onChange={e => setVForm({...vForm, notes: e.target.value})} /></div>
                  <button className="btn btn-primary" type="submit">Enregistrer</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowVitaux(false)} style={{ marginTop: 8 }}>Annuler</button>
                </form>
              </div>
            </div>
          )}

          {patient.notes && (
            <div className="card mt-3">
              <div className="section-title" style={{ margin: '0 0 4px' }}>Notes</div>
              <p style={{ fontSize: 12, color: '#7a8499' }}>{patient.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Photos */}
      {tab === 'photos' && (
        <div>
          <div className="section-title">Photos &amp; Évaluations</div>
          <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => setShowEval(true)}>
            📷 + Nouvelle évaluation complète
          </button>

          {photos.length > 0 ? (
            <div>
              {photos.map(p => {
                const joursRestants = p.jours_restants != null ? p.jours_restants : 60;
                const isUrgent = joursRestants <= 3;
                const datePrise = p.date_prise ? new Date(p.date_prise).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
                return (
                  <div className="card" key={p.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <img src={`${API_BASE}${p.url}`} alt={p.description} className="photo-thumb" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1f2e' }}>Photo {datePrise}</div>
                        {p.description && <div style={{ fontSize: 11, color: '#7a8499', marginTop: 2 }}>{p.description}</div>}
                        {p.taille_octets > 0 && <div style={{ fontSize: 10, color: '#7a8499', marginTop: 2 }}>{(p.taille_octets / 1024).toFixed(0)} KB</div>}
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: isUrgent ? '#A32D2D' : '#1D9E75' }}>
                          {joursRestants <= 0 ? 'Expiration imminente' : `Expire dans : ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button onClick={() => handleDownloadPhoto(p.id, p.filename)}
                            style={{ fontSize: 11, fontWeight: 600, color: '#185FA5', background: '#E6F1FB', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                            Telecharger
                          </button>
                          <button onClick={() => handleDeletePhoto(p.id)}
                            style={{ fontSize: 11, fontWeight: 600, color: '#A32D2D', background: '#FCEBEB', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><p>Aucune photo</p></div>
          )}
        </div>
      )}

      {/* Tab Historique vitaux */}
      {tab === 'historique' && (
        <div>
          <div className="section-title">Historique des mesures</div>
          {vitaux.length === 0 ? (
            <div className="empty-state"><p>Aucun historique</p></div>
          ) : (
            vitaux.map(v => (
              <div className="card" key={v.id}>
                <div style={{ fontSize: 11, color: '#7a8499', marginBottom: 6 }}>
                  {new Date(v.date_mesure).toLocaleString('fr-FR')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div><strong>TA:</strong> {v.tension || '—'}</div>
                  <div><strong>SpO2:</strong> {v.saturation ? `${v.saturation}%` : '—'}</div>
                  <div><strong>Pouls:</strong> {v.pouls || '—'}</div>
                  <div><strong>Glyc:</strong> {v.glycemie || '—'}</div>
                  <div><strong>Temp:</strong> {v.temperature ? `${v.temperature}°` : '—'}</div>
                  <div><strong>EVA:</strong> {v.eva != null ? `${v.eva}/10` : '—'}</div>
                </div>
                {v.notes && <div style={{ fontSize: 11, color: '#7a8499', marginTop: 4, fontStyle: 'italic' }}>{v.notes}</div>}
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== MODAL ÉVALUATION COMPLÈTE ===== */}
      {showEval && (
        <div className="modal-overlay" onClick={() => setShowEval(false)}>
          <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: 24 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <button className="modal-close" onClick={() => setShowEval(false)}>✕</button>
            <div className="modal-title" style={{ fontSize: 16, marginBottom: 16 }}>📷 Nouvelle évaluation</div>

            {/* Infos patient */}
            <div style={{ background: '#ebf3fb', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: '#0c2d4e', fontWeight: 600 }}>
              Patient : {patient.prenom} {patient.nom}
            </div>

            {/* PHOTOS */}
            <div className="form-group">
              <label>📷 Photos de la plaie</label>
              <div className="photo-up-zone">
                <input type="file" accept="image/*" multiple onChange={handleMultiPhotoUpload} />
                <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3a4555' }}>Ajouter des photos</div>
                <div style={{ fontSize: 11, color: '#98a4b3', marginTop: 3 }}>Galerie ou appareil photo</div>
              </div>
              {evalPhotos.length > 0 && (
                <div className="photo-prev-grid">
                  {evalPhotos.map((p, i) => (
                    <div className="photo-prev-item" key={i}>
                      <img src={p.src} alt="" />
                      <button className="photo-prev-rm" onClick={() => setEvalPhotos(prev => prev.filter((_,j)=>j!==i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SURFACE */}
            <div className="form-group">
              <label>📐 Surface (cm)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <input value={evalLong} onChange={e => setEvalLong(e.target.value)} type="number" placeholder="Longueur" />
                <input value={evalLarg} onChange={e => setEvalLarg(e.target.value)} type="number" placeholder="Largeur" />
              </div>
              <div style={{ fontSize: 12, color: '#98a4b3' }}>
                Surface calculée : <strong>{evalLong && evalLarg ? (parseFloat(evalLong)*parseFloat(evalLarg)).toFixed(2)+' cm²' : '—'}</strong>
              </div>
            </div>

            {/* LIT DE LA PLAIE */}
            <div className="form-group">
              <label>🔬 Aspect du lit de la plaie</label>
              <div className="eval-chip-row">
                {['Granulation 🌱','Fibrine 🟡','Nécrose 🔴','Hypergranulation','Épidermisation ✨','Mixte'].map(v => (
                  <button key={v} className={`eval-chip${evalLitSel.includes(v)?' sel':''}`} onClick={() => toggleLit(v)}>{v}</button>
                ))}
              </div>
            </div>

            {/* EXSUDAT */}
            <div className="form-group">
              <label>💧 Exsudat</label>
              <div className="eval-opt-grid">
                {[{ico:'🔵',lbl:'Nul'},{ico:'💧',lbl:'Faible'},{ico:'💦',lbl:'Modéré'},{ico:'🌊',lbl:'Abondant'}].map(o => (
                  <div key={o.lbl} className={`eval-opt${evalExsudat===o.lbl?' sel':''}`} onClick={() => setEvalExsudat(o.lbl)}>
                    <div className="eo-icon">{o.ico}</div>
                    <div className="eo-lbl">{o.lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* INFECTION */}
            <div className="form-group">
              <label>⚠️ Signes d'infection <strong style={{ color: '#b02020' }}>({evalInfSel.length})</strong></label>
              <div className="eval-chip-row">
                {['Rougeur','Chaleur','Œdème','Douleur','Odeur','Purulent','Fièvre','Biofilm'].map(v => (
                  <button key={v} className={`eval-chip${evalInfSel.includes(v)?' sel-red':''}`} onClick={() => toggleInf(v)}
                    style={evalInfSel.includes(v) ? { borderColor:'#b02020', background:'#fceaea', color:'#b02020' } : {}}>{v}</button>
                ))}
              </div>
            </div>

            {/* DOULEUR EVA */}
            <div className="form-group">
              <label>🩹 Douleur EVA : <strong>{evalEva}</strong> / 10</label>
              <input type="range" min="0" max="10" value={evalEva} onChange={e => setEvalEva(Number(e.target.value))} className="eva-slider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#98a4b3', marginTop: 4 }}>
                <span>0 — Nulle</span><span>10 — Maximale</span>
              </div>
            </div>

            {/* PANSEMENTS */}
            <div className="form-group">
              <label>🩹 Pansements appliqués</label>
              <div>
                {evalPans.map((p, i) => (
                  <div className="pan-item-row" key={i}>
                    🩹 {p}
                    <button onClick={() => setEvalPans(prev => prev.filter((_,j)=>j!==i))}>✕</button>
                  </div>
                ))}
              </div>
              <button className="pan-add-btn" onClick={() => {
                const n = window.prompt('Nom du pansement :');
                if (n) setEvalPans(prev => [...prev, n]);
              }}>＋ Ajouter un pansement</button>
            </div>

            {/* COMPRESSION */}
            <div className="form-group">
              <label>🧦 Compression &amp; décharge</label>
              <div className="eval-chip-row">
                {['Bas de compression','Bande cohésive','Semelle de décharge','Aucune'].map(v => (
                  <button key={v} className={`eval-chip${evalCompSel.includes(v)?' sel':''}`} onClick={() => toggleComp(v)}>{v}</button>
                ))}
              </div>
            </div>

            {/* NOTES */}
            <div className="form-group">
              <label>📝 Notes</label>
              <textarea value={evalNotes} onChange={e => setEvalNotes(e.target.value)} placeholder="Observations cliniques…" rows={3} />
            </div>

            <button className="btn btn-primary" onClick={saveEvaluation} disabled={evalSaving}>
              {evalSaving ? 'Enregistrement…' : "✅ Enregistrer l'évaluation"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL ALERTES ===== */}
      {showAlertModal && (
        <AlertModal
          patient={patient}
          onClose={() => setShowAlertModal(false)}
          onSave={handleSaveAlerts}
        />
      )}
    </div>
  );
}
