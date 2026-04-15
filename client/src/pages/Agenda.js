import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { format, addDays, subDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rdvs, setRdvs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ patient_id: '', date_rdv: '', type_soin: '', duree_minutes: 30, notes: '' });

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const loadRdvs = useCallback(() => {
    api.getAgenda({ date: dateStr }).then(setRdvs).catch(() => {});
  }, [dateStr]);

  useEffect(() => {
    loadRdvs();
    api.getPatients().then(setPatients).catch(() => {});
  }, [loadRdvs]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createRdv({ ...form, date_rdv: `${dateStr} ${form.heure || '08:00'}:00` });
      setShowModal(false);
      setForm({ patient_id: '', date_rdv: '', type_soin: '', duree_minutes: 30, notes: '', heure: '' });
      loadRdvs();
    } catch (err) { alert(err.message); }
  };

  const updateStatut = async (id, statut) => {
    try {
      const rdv = rdvs.find(r => r.id === id);
      await api.updateRdv(id, { ...rdv, statut });
      loadRdvs();
    } catch (err) { alert(err.message); }
  };

  const deleteRdv = async (id) => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return;
    try {
      await api.deleteRdv(id);
      loadRdvs();
    } catch (err) { alert(err.message); }
  };

  const getStatusBadge = (statut) => {
    const map = {
      effectue: { cls: 'badge-green', label: 'Effectué' },
      en_cours: { cls: 'badge-amber', label: 'En cours' },
      planifie: { cls: 'badge-blue', label: 'À venir' },
      annule: { cls: 'badge-red', label: 'Annulé' },
    };
    const s = map[statut] || map.planifie;
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  // Semaine courante
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="section-title">
        {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
      </div>

      {/* Week selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, justifyContent: 'space-between' }}>
        {weekDays.map(day => {
          const isSelected = format(day, 'yyyy-MM-dd') === dateStr;
          return (
            <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
              style={{
                flex: 1, padding: '8px 2px', borderRadius: 10, border: 'none',
                background: isSelected ? '#0A3D62' : '#fff',
                color: isSelected ? '#fff' : '#3d4555',
                cursor: 'pointer', fontFamily: 'inherit', boxShadow: isSelected ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
              <span style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.7 }}>
                {format(day, 'EEE', { locale: fr })}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      {/* Navigation jour */}
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDate(d => subDays(d, 1))}>← Veille</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDate(new Date())}>Aujourd'hui</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDate(d => addDays(d, 1))}>Lendemain →</button>
      </div>

      {/* Liste des RDV */}
      {rdvs.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 4v3M16 4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <p>Aucun rendez-vous ce jour</p>
        </div>
      ) : (
        rdvs.map(rdv => (
          <div className="card" key={rdv.id}>
            <div className="card-row" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0A3D62' }}>
                {format(new Date(rdv.date_rdv), 'HH:mm')}
              </span>
              {getStatusBadge(rdv.statut)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {rdv.patient_prenom} {rdv.patient_nom}
            </div>
            <div style={{ fontSize: 11, color: '#7a8499', marginTop: 2 }}>
              {rdv.patient_adresse}{rdv.patient_ville ? `, ${rdv.patient_ville}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#7a8499', marginTop: 2 }}>
              {rdv.type_soin}
            </div>
            {rdv.notes && <div style={{ fontSize: 11, color: '#7a8499', marginTop: 2, fontStyle: 'italic' }}>{rdv.notes}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {rdv.statut === 'planifie' && (
                <button className="btn btn-sm btn-secondary" onClick={() => updateStatut(rdv.id, 'en_cours')}>Démarrer</button>
              )}
              {rdv.statut === 'en_cours' && (
                <button className="btn btn-sm btn-green" onClick={() => updateStatut(rdv.id, 'effectue')}>Terminer</button>
              )}
              <button className="btn btn-sm btn-danger" onClick={() => deleteRdv(rdv.id)}>Supprimer</button>
            </div>
          </div>
        ))
      )}

      <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 8 }}>
        + Nouveau rendez-vous
      </button>

      {/* Modal création RDV */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nouveau rendez-vous</div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Patient</label>
                <select value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} required>
                  <option value="">Choisir un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Heure</label>
                <input type="time" value={form.heure || ''} onChange={e => setForm({...form, heure: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Durée (minutes)</label>
                <input type="number" value={form.duree_minutes} onChange={e => setForm({...form, duree_minutes: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Type de soin</label>
                <input value={form.type_soin} onChange={e => setForm({...form, type_soin: e.target.value})} placeholder="Ex: Pansement, Injection..." />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <button className="btn btn-primary" type="submit">Créer le rendez-vous</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
