import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const DELETE_REASONS = [
  { value: 'fin_prise_en_charge', label: 'Fin de prise en charge' },
  { value: 'rupture_contrat', label: 'Rupture de contrat' },
  { value: 'deces', label: 'Deces' },
  { value: 'erreur_creation', label: 'Erreur de creation' },
  { value: 'autre', label: 'Autre' },
];

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', date_naissance: '', adresse: '', ville: '', code_postal: '', telephone: '', email: '', medecin_traitant: '', numero_secu: '', notes: '' });
  const [menuOpen, setMenuOpen] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('fin_prise_en_charge');
  const navigate = useNavigate();

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = () => {
    api.getPatients().then(setPatients).catch(() => {});
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createPatient(form);
      setShowModal(false);
      setForm({ nom: '', prenom: '', date_naissance: '', adresse: '', ville: '', code_postal: '', telephone: '', email: '', medecin_traitant: '', numero_secu: '', notes: '' });
      loadPatients();
    } catch (err) { alert(err.message); }
  };

  const handleDeletePatient = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePatient(deleteTarget.id, deleteReason);
      setDeleteTarget(null);
      setDeleteReason('fin_prise_en_charge');
      loadPatients();
    } catch (err) { alert(err.message); }
  };

  const filtered = patients.filter(p =>
    `${p.nom} ${p.prenom}`.toLowerCase().includes(search.toLowerCase())
  );

  const colors = ['#0A3D62', '#1D9E75', '#D85A30', '#7B2D8E', '#185FA5'];

  return (
    <div>
      <div className="form-group" style={{ marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un patient..." style={{ background: '#fff' }} />
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <p>Aucun patient trouve</p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <div className="patient-row" key={p.id} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/patients/${p.id}`)}>
                <div className="p-avatar" style={{ background: colors[i % colors.length] + '20', color: colors[i % colors.length] }}>
                  {(p.prenom?.[0] || '') + (p.nom?.[0] || '')}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="p-name">{p.nom} {p.prenom}</div>
                  <div className="p-addr">{p.adresse}{p.ville ? `, ${p.ville}` : ''}</div>
                </div>
                <span className={`badge ${p.actif ? 'badge-green' : 'badge-red'}`}>
                  {p.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              {/* Menu "..." */}
              <button className="dots-menu-btn" onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" fill="#7a8499"/><circle cx="12" cy="12" r="2" fill="#7a8499"/><circle cx="12" cy="19" r="2" fill="#7a8499"/></svg>
              </button>
              {menuOpen === p.id && (
                <div className="dots-menu" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setMenuOpen(null); navigate(`/patients/${p.id}`); }}>Modifier</button>
                  <button className="dots-menu-danger" onClick={() => { setMenuOpen(null); setDeleteTarget(p); }}>Supprimer patient</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 8 }}>
        + Nouveau patient
      </button>

      {/* Modal Nouveau Patient */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nouveau patient</div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-group"><label>Nom</label><input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required /></div>
                <div className="form-group"><label>Prenom</label><input value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required /></div>
              </div>
              <div className="form-group"><label>Date de naissance</label><input type="date" value={form.date_naissance} onChange={e => setForm({...form, date_naissance: e.target.value})} /></div>
              <div className="form-group"><label>Adresse</label><input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <div className="form-group"><label>Ville</label><input value={form.ville} onChange={e => setForm({...form, ville: e.target.value})} /></div>
                <div className="form-group"><label>Code postal</label><input value={form.code_postal} onChange={e => setForm({...form, code_postal: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Telephone</label><input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="form-group"><label>Medecin traitant</label><input value={form.medecin_traitant} onChange={e => setForm({...form, medecin_traitant: e.target.value})} /></div>
              <div className="form-group"><label>N Securite sociale</label><input value={form.numero_secu} onChange={e => setForm({...form, numero_secu: e.target.value})} /></div>
              <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <button className="btn btn-primary" type="submit">Creer le patient</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Suppression Patient */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="#A32D2D" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1f2e' }}>Supprimer {deleteTarget.prenom} {deleteTarget.nom} ?</div>
              <div style={{ fontSize: 12, color: '#7a8499', marginTop: 8, lineHeight: 1.5 }}>
                Cette action supprimera :<br/>
                - fiche patient<br/>
                - photos<br/>
                - soins et signatures<br/>
                - historique vitaux<br/>
                - donnees associees
              </div>
            </div>
            <div className="form-group">
              <label>Raison de la suppression</label>
              <select value={deleteReason} onChange={e => setDeleteReason(e.target.value)}>
                {DELETE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button className="btn btn-danger" onClick={handleDeletePatient} style={{ fontWeight: 700 }}>Supprimer definitivement</button>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} style={{ marginTop: 8 }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
