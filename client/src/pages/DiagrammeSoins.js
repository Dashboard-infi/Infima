import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function DiagrammeSoins() {
  const [diagrammes, setDiagrammes] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const now = new Date();
  const [form, setForm] = useState({
    patient_id: '', medecin: '', mois: now.getMonth() + 1, annee: now.getFullYear(), type_soin: '', notes: ''
  });

  useEffect(() => {
    api.getDiagrammes({}).then(setDiagrammes).catch(() => {});
    api.getPatients().then(setPatients).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await api.createDiagramme(form);
      setShowModal(false);
      setForm({ patient_id: '', medecin: '', mois: now.getMonth() + 1, annee: now.getFullYear(), type_soin: '', notes: '' });
      api.getDiagrammes({}).then(setDiagrammes);
      navigate(`/soins/${result.id}`);
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="section-title">Mes diagrammes de soins</div>

      {diagrammes.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
          <p>Aucun diagramme créé</p>
        </div>
      ) : (
        diagrammes.map(d => (
          <div className="card" key={d.id} onClick={() => navigate(`/soins/${d.id}`)} style={{ cursor: 'pointer', borderLeft: `4px solid ${d.signe_le ? '#1D9E75' : '#D4A017'}` }}>
            <div className="card-row" style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.signe_le ? '#E1F5EE' : '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {d.signe_le ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#D4A017"/></svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.patient_nom} {d.patient_prenom}</div>
                  <div style={{ fontSize: 11, color: '#7a8499' }}>{d.type_soin} — {MOIS_LABELS[d.mois]} {d.annee}</div>
                </div>
              </div>
              <span className={`badge ${d.signe_le ? 'badge-green' : 'badge-amber'}`}>
                {d.signe_le ? 'Signé' : 'En cours'}
              </span>
            </div>
          </div>
        ))
      )}

      <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 8 }}>
        + Nouveau diagramme
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nouveau diagramme de soins</div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Patient</label>
                <select value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} required>
                  <option value="">Choisir un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Médecin prescripteur</label>
                <input value={form.medecin} onChange={e => setForm({...form, medecin: e.target.value})} placeholder="Dr. Martin" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-group">
                  <label>Mois</label>
                  <select value={form.mois} onChange={e => setForm({...form, mois: parseInt(e.target.value)})}>
                    {MOIS_LABELS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Année</label>
                  <input type="number" value={form.annee} onChange={e => setForm({...form, annee: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label>Type de soin</label>
                <input value={form.type_soin} onChange={e => setForm({...form, type_soin: e.target.value})} placeholder="Pansement, Injection..." required />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <button className="btn btn-primary" type="submit">Créer le diagramme</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
