import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function PatientFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [vitaux, setVitaux] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState('info');
  const [showVitaux, setShowVitaux] = useState(false);
  const [vForm, setVForm] = useState({ tension: '', saturation: '', pouls: '', glycemie: '', temperature: '', eva: '', notes: '' });
  const [photoDesc, setPhotoDesc] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.getPatient(id).then(setPatient).catch(() => navigate('/patients'));
    api.getVitaux(id).then(setVitaux).catch(() => {});
    api.getPhotos(id).then(setPhotos).catch(() => {});
  }, [id, navigate]);

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
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div className="p-avatar" style={{ background: '#E6F1FB', color: '#185FA5', width: 42, height: 42, fontSize: 15 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{patient.nom} {patient.prenom}</div>
            <div style={{ fontSize: 11, color: '#7a8499' }}>
              Dr. {patient.medecin_traitant || '—'} {patient.date_naissance ? `• Né(e) ${new Date(patient.date_naissance).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
          <span className={`badge ${patient.actif ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>
            {patient.actif ? 'Actif' : 'Inactif'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#7a8499' }}>
          {patient.adresse}{patient.ville ? `, ${patient.code_postal} ${patient.ville}` : ''}
        </div>
        {patient.telephone && <div style={{ fontSize: 11, color: '#7a8499', marginTop: 2 }}>Tél: {patient.telephone}</div>}
        {patient.numero_secu && <div style={{ fontSize: 11, color: '#7a8499', marginTop: 2 }}>Sécu: {patient.numero_secu}</div>}
      </div>

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
              <div className="vital-card"><div className="vital-val">{latestVitaux.tension || '—'}</div><div className="vital-label">Tension (cmHg)</div></div>
              <div className="vital-card"><div className="vital-val">{latestVitaux.saturation ? `${latestVitaux.saturation}%` : '—'}</div><div className="vital-label">Saturation O2</div></div>
              <div className="vital-card"><div className="vital-val">{latestVitaux.pouls || '—'}</div><div className="vital-label">Pouls (bpm)</div></div>
              <div className="vital-card"><div className="vital-val">{latestVitaux.glycemie || '—'}</div><div className="vital-label">Glycémie (g/L)</div></div>
              <div className="vital-card"><div className="vital-val">{latestVitaux.temperature ? `${latestVitaux.temperature}°` : '—'}</div><div className="vital-label">Température</div></div>
              <div className="vital-card"><div className="vital-val">{latestVitaux.eva != null ? `EVA ${latestVitaux.eva}/10` : '—'}</div><div className="vital-label">Douleur</div></div>
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
          <div className="section-title">Photos du patient</div>
          <div className="card">
            <div className="form-group">
              <label>Ajouter une photo</label>
              <input type="file" accept="image/*" ref={fileRef} style={{ fontSize: 12 }} />
            </div>
            <div className="form-group">
              <input value={photoDesc} onChange={e => setPhotoDesc(e.target.value)} placeholder="Description (optionnel)" />
            </div>
            <button className="btn btn-sm btn-primary" onClick={uploadPhoto}>Envoyer</button>
          </div>

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
    </div>
  );
}
