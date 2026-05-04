import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const STATUS_MAP = {
  effectue: { cls: 'badge-green', label: 'Effectué' },
  en_cours: { cls: 'badge-amber', label: 'En cours' },
  planifie: { cls: 'badge-blue',  label: 'À venir' },
  annule:   { cls: 'badge-red',   label: 'Annulé' },
};

function emptyForm() {
  return { patient_id: '', type_soin: '', duree_minutes: 30, notes: '', heure: '08:00' };
}

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rdvs,         setRdvs]         = useState([]);
  const [patients,     setPatients]      = useState([]);
  const [showModal,    setShowModal]     = useState(false);
  const [editRdv,      setEditRdv]       = useState(null);
  const [form,         setForm]          = useState(emptyForm());
  const [loading,      setLoading]       = useState(false);

  const dateStr  = selectedDate.toISOString().split('T')[0];
  const weekStart = new Date(selectedDate);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  const weekDays  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const loadRdvs = useCallback(() => {
    api.getAgenda({ date: dateStr }).then(setRdvs).catch(() => {});
  }, [dateStr]);

  useEffect(() => {
    loadRdvs();
    api.getPatients().then(setPatients).catch(() => {});
  }, [loadRdvs]);

  const openCreate = () => {
    setEditRdv(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (rdv) => {
    setEditRdv(rdv);
    const heureExistante = rdv.date_rdv ? rdv.date_rdv.substring(11, 16) : '08:00';
    setForm({
      patient_id:    rdv.patient_id || '',
      type_soin:     rdv.type_soin  || '',
      duree_minutes: rdv.duree_minutes || 30,
      notes:         rdv.notes || '',
      heure:         heureExistante,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const date_rdv = `${dateStr} ${form.heure}:00`;
      if (editRdv) {
        await api.updateRdv(editRdv.id, { ...form, date_rdv });
      } else {
        await api.createRdv({ ...form, date_rdv });
      }
      setShowModal(false);
      // BUG FIX: réinitialiser correctement le formulaire (heure incluse)
      setForm(emptyForm());
      setEditRdv(null);
      loadRdvs();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatut = async (id, statut) => {
    const rdv = rdvs.find(r => r.id === id);
    if (!rdv) return;
    try {
      await api.updateRdv(id, { ...rdv, statut });
      loadRdvs();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteRdv = async (id) => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return;
    try {
      await api.deleteRdv(id);
      loadRdvs();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (statut) => {
    const s = STATUS_MAP[statut] || STATUS_MAP.planifie;
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div>
      {/* Titre de la journée */}
      <div className="section-title">
        {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

      {/* Sélecteur de semaine */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, background: '#fff', borderRadius: 12, padding: '5px 4px', border: '1px solid #DFE4EB' }}>
        {weekDays.map(day => {
          const dayStr = day.toISOString().split('T')[0];
          const isSelected = dayStr === dateStr;
          const isToday    = dayStr === new Date().toISOString().split('T')[0];
          return (
            <button
              key={day.toISOString()}
              className="week-day-btn"
              onClick={() => setSelectedDate(day)}
              style={{
                background: isSelected ? '#0C2D4E' : 'transparent',
                color: isSelected ? '#fff' : isToday ? '#0C2D4E' : '#6B7A8D',
                cursor: 'pointer',
              }}
            >
              <div className="day-name">{day.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
              <div className="day-num"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '2px auto 0',
                  background: isSelected ? 'rgba(255,255,255,0.15)' : isToday ? '#EBF3FB' : 'transparent',
                  fontWeight: isToday || isSelected ? 700 : 400,
                }}
              >
                {day.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Liste des RDV */}
      {rdvs.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h4>Journée libre</h4>
          <p>Aucun rendez-vous ce jour</p>
        </div>
      ) : (
        rdvs.map(rdv => {
          const heure = rdv.date_rdv ? rdv.date_rdv.substring(11, 16) : '—';
          const patient = patients.find(p => p.id === rdv.patient_id);
          return (
            <div key={rdv.id} className="card" style={{ borderLeft: `3px solid ${rdv.statut === 'effectue' ? '#1A8C6A' : rdv.statut === 'annule' ? '#B02020' : '#0C2D4E'}` }}>
              <div className="card-row" style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0C2D4E', minWidth: 38 }}>{heure}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#16202E' }}>
                      {patient ? `${patient.prenom} ${patient.nom}` : rdv.patient_nom || 'Patient'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7A8D' }}>{rdv.type_soin || '—'}</div>
                  </div>
                </div>
                {getStatusBadge(rdv.statut)}
              </div>

              {rdv.notes && (
                <div style={{ fontSize: 11.5, color: '#6B7A8D', marginBottom: 8, paddingLeft: 48 }}>{rdv.notes}</div>
              )}

              <div style={{ display: 'flex', gap: 6, paddingLeft: 48, flexWrap: 'wrap' }}>
                {rdv.statut !== 'effectue' && (
                  <button className="btn btn-sm btn-green" onClick={() => updateStatut(rdv.id, 'effectue')}>✓ Effectué</button>
                )}
                {rdv.statut === 'planifie' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => updateStatut(rdv.id, 'annule')}>Annuler</button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(rdv)}>Modifier</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteRdv(rdv.id)}>Supprimer</button>
              </div>
            </div>
          );
        })
      )}

      {/* FAB */}
      <button className="fab" onClick={openCreate} title="Nouveau rendez-vous">+</button>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{editRdv ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Patient *</label>
                <select value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} required>
                  <option value="">Sélectionner un patient…</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Heure *</label>
                  <input type="time" value={form.heure} onChange={e => setForm({...form, heure: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Durée (min)</label>
                  <input type="number" min="5" max="240" step="5" value={form.duree_minutes} onChange={e => setForm({...form, duree_minutes: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label>Type de soin</label>
                <input value={form.type_soin} onChange={e => setForm({...form, type_soin: e.target.value})} placeholder="Pansement, injection…" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Informations complémentaires…" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Enregistrement…' : editRdv ? 'Mettre à jour' : 'Créer le rendez-vous'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
