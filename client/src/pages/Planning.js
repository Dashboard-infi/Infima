import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const TYPE_LABELS = {
  travail: 'Travail', conge: 'Congé', garde: 'Garde', formation: 'Formation', autre: 'Autre'
};
const TYPE_COLORS = {
  travail: '#0C2D4E', conge: '#1D9E75', garde: '#D85A30', formation: '#1A4A6E', autre: '#7a8499'
};

export default function Planning() {
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ date_debut: '', date_fin: '', type_event: 'travail', titre: '', description: '', couleur: '#0C2D4E' });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const loadEvents = useCallback(() => {
    api.getPlanning({
      debut: formatDate(weekStart),
      fin: formatDate(weekEnd)
    }).then(setEvents).catch(() => {});
  }, [weekEnd, weekStart]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.updatePlanning(editId, form);
      } else {
        await api.createPlanning(form);
      }
      setShowModal(false);
      setEditId(null);
      setForm({ date_debut: '', date_fin: '', type_event: 'travail', titre: '', description: '', couleur: '#0C2D4E' });
      loadEvents();
    } catch (err) { alert(err.message); }
  };

  const editEvent = (event) => {
    setEditId(event.id);
    setForm({
      date_debut: formatDateTime(new Date(event.date_debut)),
      date_fin: formatDateTime(new Date(event.date_fin)),
      type_event: event.type_event,
      titre: event.titre || '',
      description: event.description || '',
      couleur: event.couleur || '#0C2D4E'
    });
    setShowModal(true);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Supprimer cet événement ?')) return;
    try {
      await api.deletePlanning(id);
      loadEvents();
    } catch (err) { alert(err.message); }
  };

  const getEventsForDay = (day) => {
    const dayStr = formatDate(day);
    return events.filter(e => {
      const start = formatDate(new Date(e.date_debut));
      const end = formatDate(new Date(e.date_fin));
      return dayStr >= start && dayStr <= end;
    });
  };

  const prevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  return (
    <div>
      {/* Navigation semaine */}
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-sm btn-secondary" onClick={prevWeek}>← Sem.</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0C2D4E' }}>
          {formatDateFr(weekStart)} — {formatDateFr(weekEnd)}
        </span>
        <button className="btn btn-sm btn-secondary" onClick={nextWeek}>Sem. →</button>
      </div>

      {/* Planning semaine */}
      {weekDays.map(day => {
        const dayEvents = getEventsForDay(day);
        const isToday = formatDate(day) === formatDate(new Date());
        return (
          <div key={day.toISOString()} style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: '8px 8px 0 0',
              background: isToday ? '#0C2D4E' : '#e8eaf0',
              color: isToday ? '#fff' : '#3d4555'
            }}>
              {formatDateLong(day)}
            </div>
            <div style={{ background: '#fff', borderRadius: '0 0 8px 8px', border: '1px solid #e8eaf0', borderTop: 'none', padding: dayEvents.length > 0 ? 8 : 0, minHeight: dayEvents.length > 0 ? 0 : 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dayEvents.length === 0 && (
                <div style={{ fontSize: 11, color: '#c8ccd6', textAlign: 'center', padding: 8 }}>—</div>
              )}
              {dayEvents.map(event => (
                <div key={event.id} className="planning-event" style={{ borderLeftColor: event.couleur || TYPE_COLORS[event.type_event] || '#0C2D4E', background: (event.couleur || TYPE_COLORS[event.type_event] || '#0C2D4E') + '15' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="planning-event-title">{event.titre || TYPE_LABELS[event.type_event]}</div>
                      <div className="planning-event-sub">
                        {formatTime(new Date(event.date_debut))} — {formatTime(new Date(event.date_fin))}
                        {event.infirmier_nom && ` • ${event.infirmier_prenom} ${event.infirmier_nom}`}
                      </div>
                      {event.description && <div className="planning-event-sub">{event.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => editEvent(event)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                      <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ date_debut: '', date_fin: '', type_event: 'travail', titre: '', description: '', couleur: '#0C2D4E' }); setShowModal(true); }} style={{ marginTop: 8 }}>
        + Ajouter un événement
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditId(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editId ? 'Modifier' : 'Nouvel'} événement</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Titre</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder="Titre de l'événement" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.type_event} onChange={e => setForm({...form, type_event: e.target.value})}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-group"><label>Début</label><input type="datetime-local" value={form.date_debut} onChange={e => setForm({...form, date_debut: e.target.value})} required /></div>
                <div className="form-group"><label>Fin</label><input type="datetime-local" value={form.date_fin} onChange={e => setForm({...form, date_fin: e.target.value})} required /></div>
              </div>
              <div className="form-group">
                <label>Couleur</label>
                <input type="color" value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} style={{ width: 50, height: 35, padding: 2 }} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <button className="btn btn-primary" type="submit">{editId ? 'Modifier' : 'Créer'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => { setShowModal(false); setEditId(null); }} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions for date formatting without date-fns
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateFr(date) {
  const options = { day: 'numeric', month: 'short' };
  return date.toLocaleDateString('fr-FR', options);
}

function formatDateLong(date) {
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('fr-FR', options);
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
