import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const DELETE_REASONS = [
  { value: 'fin_prise_en_charge', label: 'Fin de prise en charge' },
  { value: 'rupture_contrat',     label: 'Rupture de contrat' },
  { value: 'deces',               label: 'Décès' },
  { value: 'erreur_creation',     label: 'Erreur de création' },
  { value: 'autre',               label: 'Autre' },
];

const AVATAR_COLORS = ['#0C2D4E', '#1A8C6A', '#D85A30', '#7B2D8E', '#185FA5'];

export default function Patients() {
  const [patients,     setPatients]     = useState([]);
  const [search,       setSearch]       = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState(emptyForm());
  const [menuOpen,     setMenuOpen]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('fin_prise_en_charge');
  const [loading,      setLoading]      = useState(false);
  const navigate = useNavigate();
  const menuRef  = useRef(null);

  function emptyForm() {
    return {
      nom: '', prenom: '', date_naissance: '', adresse: '', ville: '',
      code_postal: '', telephone: '', email: '', medecin_traitant: '',
      numero_secu: '', notes: '',
    };
  }

  const loadPatients = useCallback(() => {
    api.getPatients().then(setPatients).catch(() => {});
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // BUG FIX: fermer le menu dots en cliquant ailleurs
  useEffect(() => {
    if (menuOpen === null) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createPatient(form);
      setShowModal(false);
      setForm(emptyForm());
      loadPatients();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePatient(deleteTarget.id, deleteReason);
      setDeleteTarget(null);
      setDeleteReason('fin_prise_en_charge');
      loadPatients();
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = patients.filter(p =>
    `${p.nom} ${p.prenom}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Recherche */}
      <div className="form-group" style={{ marginBottom: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un patient…"
          style={{ background: '#fff' }}
        />
      </div>

      {/* Liste */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <h4>{search ? 'Aucun résultat' : 'Aucun patient'}</h4>
            <p>{search ? 'Essayez un autre nom' : 'Ajoutez votre premier patient'}</p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <div className="patient-row" key={p.id} style={{ position: 'relative' }}>
              {/* Infos patient */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, cursor: 'pointer' }}
                onClick={() => navigate(`/patients/${p.id}`)}
              >
                {/* BUG FIX: className corrigé de "p-avat" à "p-avatar" */}
                <div
                  className="p-avatar"
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff' }}
                >
                  {(p.prenom?.[0] || '') + (p.nom?.[0] || '')}
                </div>
                <div>
                  <div className="p-name">{p.prenom} {p.nom}</div>
                  <div className="p-addr">{p.ville || '—'}</div>
                  <div className="shared-badge">👥 Visible par l'équipe</div>
                </div>
              </div>

              {/* Menu contextuel */}
              <div style={{ position: 'relative' }} ref={menuOpen === p.id ? menuRef : null}>
                <button
                  className="dots-menu-btn"
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5"  r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                  </svg>
                </button>

                {menuOpen === p.id && (
                  <div className="dots-menu">
                    <button onClick={() => { navigate(`/patients/${p.id}`); setMenuOpen(null); }}>
                      Voir la fiche
                    </button>
                    <button
                      className="dots-menu-danger"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); setMenuOpen(null); }}
                    >
                      Supprimer…
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB ajout patient */}
      <button className="fab" onClick={() => setShowModal(true)} title="Nouveau patient">
        +
      </button>

      {/* ===== MODAL CRÉATION ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Nouveau patient</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group"><label>Nom *</label><input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required /></div>
                <div className="form-group"><label>Prénom *</label><input value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required /></div>
              </div>
              <div className="form-group"><label>Date de naissance</label><input type="date" value={form.date_naissance} onChange={e => setForm({...form, date_naissance: e.target.value})} /></div>
              <div className="form-group"><label>Adresse</label><input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div className="form-group"><label>Ville</label><input value={form.ville} onChange={e => setForm({...form, ville: e.target.value})} /></div>
                <div className="form-group"><label>Code postal</label><input value={form.code_postal} onChange={e => setForm({...form, code_postal: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Téléphone</label><input type="tel" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="form-group"><label>Médecin traitant</label><input value={form.medecin_traitant} onChange={e => setForm({...form, medecin_traitant: e.target.value})} /></div>
              <div className="form-group"><label>N° Sécurité sociale</label><input value={form.numero_secu} onChange={e => setForm({...form, numero_secu: e.target.value})} /></div>
              <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Création…' : 'Créer le patient'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Supprimer le patient</div>

            <p style={{ fontSize: 13, color: '#3A4555', textAlign: 'center', marginBottom: 18 }}>
              Vous allez archiver <strong>{deleteTarget.prenom} {deleteTarget.nom}</strong>.<br />Raison de la clôture :
            </p>

            <div className="form-group">
              <select value={deleteReason} onChange={e => setDeleteReason(e.target.value)}>
                {DELETE_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <button className="btn-danger-solid" onClick={handleDeletePatient}>
              Confirmer la suppression
            </button>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setDeleteTarget(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
