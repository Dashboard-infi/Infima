import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../api';

export default function Profil() {
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [km, setKm] = useState({ total_km: 0, jours: [] });

  useEffect(() => {
    api.getProfil().then(data => { if (data) setForm(data); });
    api.getKm({}).then(data => { if (data) setKm(data); }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await api.updateProfil(form);
      setUser({ ...user, ...form });
      setEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const initials = (form.prenom?.[0] || '') + (form.nom?.[0] || '');

  return (
    <div>
      <div className="profil-header">
        <div className="profil-avatar">{initials.toUpperCase()}</div>
        <div className="profil-name">{form.prenom} {form.nom}</div>
        <div className="profil-email">{form.email}</div>
      </div>

      <div className="card">
        <div className="card-row mb-2">
          <span className="section-title" style={{ margin: 0 }}>Informations</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
            {editing ? 'Annuler' : 'Modifier'}
          </button>
        </div>
        {editing ? (
          <>
            <div className="form-group"><label>Nom</label><input value={form.nom || ''} onChange={e => setForm({...form, nom: e.target.value})} /></div>
            <div className="form-group"><label>Prénom</label><input value={form.prenom || ''} onChange={e => setForm({...form, prenom: e.target.value})} /></div>
            <div className="form-group"><label>Téléphone</label><input value={form.telephone || ''} onChange={e => setForm({...form, telephone: e.target.value})} /></div>
            <div className="form-group"><label>Adresse</label><input value={form.adresse || ''} onChange={e => setForm({...form, adresse: e.target.value})} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
              <div className="form-group"><label>Ville</label><input value={form.ville || ''} onChange={e => setForm({...form, ville: e.target.value})} /></div>
              <div className="form-group"><label>Code postal</label><input value={form.code_postal || ''} onChange={e => setForm({...form, code_postal: e.target.value})} /></div>
            </div>
            <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
          </>
        ) : (
          <div style={{ fontSize: 13 }}>
            <p style={{ padding: '6px 0', borderBottom: '1px solid #f0f2f5' }}><strong>Téléphone :</strong> {form.telephone || '—'}</p>
            <p style={{ padding: '6px 0', borderBottom: '1px solid #f0f2f5' }}><strong>Adresse :</strong> {form.adresse || '—'}</p>
            <p style={{ padding: '6px 0' }}><strong>Ville :</strong> {form.code_postal} {form.ville}</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title" style={{ margin: '0 0 8px' }}>Compteur kilométrique</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0A3D62' }}>{Number(km.total_km || 0).toFixed(1)} km</div>
          <div style={{ fontSize: 11, color: '#7a8499' }}>Total cumulé</div>
        </div>
        {km.jours && km.jours.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {km.jours.slice(0, 7).map((j, i) => (
              <div key={i} className="card-row" style={{ padding: '4px 0', fontSize: 12 }}>
                <span style={{ color: '#7a8499' }}>{new Date(j.date_jour).toLocaleDateString('fr-FR')}</span>
                <span style={{ fontWeight: 600 }}>{Number(j.km_journalier).toFixed(1)} km</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-danger" onClick={logout} style={{ marginTop: 12 }}>
        Se déconnecter
      </button>
    </div>
  );
}
