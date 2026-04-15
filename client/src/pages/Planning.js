import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_LABELS = {
  travail: 'Travail', conge: 'Congé', garde: 'Garde', formation: 'Formation', autre: 'Autre'
};
const TYPE_COLORS = {
  travail: '#0A3D62', conge: '#1D9E75', garde: '#D85A30', formation: '#185FA5', autre: '#7a8499'
};

export default function Planning() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ date_debut: '', date_fin: '', type_event: 'travail', titre: '', description: '', couleur: '#0A3D62' });

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => { loadEvents(); }, [weekStart]);

  const loadEvents = () => {
    api.getPlanning({
      debut: format(weekStart, 'yyyy-MM-dd'),
      fin: format(weekEnd, 'yyyy-MM-dd')
    }).then(setEvents).catch(() => {});
  };

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
      setForm({ date_debut: '', date_fin: '', type_event: 'travail', titre: '', description: '', couleur: '#0A3D62' });
      loadEvents();
    } catch (err) { alert(err.message); }
  };

  const editEvent = (event) => {
    setEditId(event.id);
    setForm({
      date_debut: format(new Date(event.date_debut), "yyyy-MM-dd'T'HH:mm"),
      date_fin: format(new Date(event.date_fin), "yyyy-MM-dd'T'HH:mm"),
      type_event: event.type_event,
      titre: event.titre || '',
      description: event.description || '',
      couleur: event.couleur || '#0A3D62'
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
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => {
      const start = format(new Date(e.date_debut), 'yyyy-MM-dd');
      const end = format(new Date(e.date_fin), 'yyyy-MM-dd');
      return dayStr >= start && dayStr <= end;
    });
  };

  return (
    <div>
      {/* Navigation semaine */}
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-sm btn-secondary" onClick={() => setWeekStart(w => subWeeks(w, 1))}>← Sem.</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0A3D62' }}>
          {format(weekStart, 'd MMM', { locale: fr })} — {format(weekEnd, 'd MMM yyyy', { locale: fr })}
        </span>
        <button className="btn btn-sm btn-secondary" onClick={() => setWeekStart(w => addWeeks(w, 1))}>Sem. →</button>
      </div>

      {/* Planning semaine */}
      {weekDays.map(day => {
        const dayEvents = getEventsForDay(day);
        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        return (
          <div key={day.toISOString()} style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: '8px 8px 0 0',
              background: isToday ? '#0A3D62' : '#e8eaf0',
              color: isToday ? '#fff' : '#3d4555'
            }}>
              {format(day, 'EEEE d MMMM', { locale: fr })}
            </div>
            <div style={{ background: '#fff', borderRadius: '0 0 8px 8px', border: '1px solid #e8eaf0', borderTop: 'none', padding: dayEvents.length > 0 ? 8 : 0, minHeight: dayEvents.length > 0 ? 0 : 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dayEvents.length === 0 && (
                <div style={{ fontSize: 11, color: '#c8ccd6', textAlign: 'center', padding: 8 }}>—</div>
              )}
              {dayEvents.map(event => (
                <div key={event.id} className="planning-event" style={{ borderLeftColor: event.couleur || TYPE_COLORS[event.type_event] || '#0A3D62', background: (event.couleur || TYPE_COLORS[event.type_event] || '#0A3D62') + '15' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="planning-event-title">{event.titre || TYPE_LABELS[event.type_event]}</div>
                      <div className="planning-event-sub">
                        {format(new Date(event.date_debut), 'HH:mm')} — {format(new Date(event.date_fin), 'HH:mm')}
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

      <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ date_debut: '', date_fin: '', type_event: 'travail', titre: '', description: '', couleur: '#0A3D62' }); setShowModal(true); }} style={{ marginTop: 8 }}>
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
