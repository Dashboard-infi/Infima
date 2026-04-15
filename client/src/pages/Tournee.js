import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api';
import { format } from 'date-fns';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COLORS = ['#0A3D62', '#1D9E75', '#D85A30', '#7B2D8E', '#185FA5', '#A32D2D'];

function createIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function Tournee() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTournee, setSelectedTournee] = useState(null);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [villeDepart, setVilleDepart] = useState('');
  const [adresseDepart, setAdresseDepart] = useState('');
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [km, setKm] = useState(null);
  const [geocodedPoints, setGeocodedPoints] = useState([]);

  useEffect(() => {
    api.getPatients().then(setPatients).catch(() => {});
    api.getKm({}).then(setKm).catch(() => {});
  }, []);

  const loadTourneeDetail = useCallback((id) => {
    api.getTournee(id).then(data => {
      setSelectedTournee(data);
      geocodeEtapes(data.etapes || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.getTournees({ date }).then(data => {
      if (data.length > 0) loadTourneeDetail(data[0].id);
      else setSelectedTournee(null);
    }).catch(() => {});
  }, [date, loadTourneeDetail]);

  const geocodeEtapes = async (etapes) => {
    const points = [];
    for (const etape of etapes) {
      const addr = `${etape.adresse || ''}, ${etape.ville || ''}, France`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`);
        const data = await res.json();
        if (data.length > 0) {
          points.push({ ...etape, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        }
      } catch { /* skip */ }
    }
    setGeocodedPoints(points);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createTournee({
        date_tournee: date,
        ville_depart: villeDepart,
        adresse_depart: adresseDepart,
        patient_ids: selectedPatients
      });
      setShowModal(false);
      setSelectedPatients([]);
      setVilleDepart('');
      setAdresseDepart('');
      api.getTournees({ date }).then(data => {
        if (data.length > 0) loadTourneeDetail(data[0].id);
        else setSelectedTournee(null);
      });
    } catch (err) { alert(err.message); }
  };

  const updateEtapeStatut = async (etapeId, statut) => {
    if (!selectedTournee) return;
    try {
      await api.updateEtape(selectedTournee.id, etapeId, { statut, distance_km: 0 });
      loadTourneeDetail(selectedTournee.id);
      api.getKm({}).then(setKm).catch(() => {});
    } catch (err) { alert(err.message); }
  };

  const togglePatient = (pid) => {
    setSelectedPatients(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const getStatutBadge = (s) => {
    const map = { fait: { cls: 'badge-green', label: 'Fait' }, en_cours: { cls: 'badge-amber', label: 'En cours' }, a_venir: { cls: 'badge-blue', label: 'À venir' } };
    const x = map[s] || map.a_venir;
    return <span className={`badge ${x.cls}`}>{x.label}</span>;
  };

  const mapCenter = geocodedPoints.length > 0
    ? [geocodedPoints[0].lat, geocodedPoints[0].lon]
    : [43.4833, 1.5833]; // Donneville default

  return (
    <div>
      <div className="card-row mb-2">
        <div className="km-badge">
          {selectedTournee ? `${Number(selectedTournee.km_total || 0).toFixed(1)} km` : '0 km'} aujourd'hui
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ border: '1px solid #e0e3ea', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit' }} />
      </div>

      {/* Carte */}
      <div className="map-container">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
          {geocodedPoints.map((pt, i) => (
            <Marker key={pt.id} position={[pt.lat, pt.lon]} icon={createIcon(COLORS[i % COLORS.length], i + 1)}>
              <Popup>
                <strong>{pt.patient_nom} {pt.patient_prenom}</strong><br />
                {pt.adresse}, {pt.ville}
              </Popup>
            </Marker>
          ))}
          {geocodedPoints.length > 0 && <FitBounds points={geocodedPoints} />}
        </MapContainer>
      </div>

      {/* Étapes */}
      {selectedTournee && selectedTournee.etapes && (
        <>
          <div className="section-title">Ordre de passage optimisé</div>
          <div className="card">
            {selectedTournee.etapes.map((etape, i) => (
              <div className="patient-row" key={etape.id}>
                <div className="order-circle" style={{ background: COLORS[i % COLORS.length] }}>{etape.ordre}</div>
                <div style={{ flex: 1 }}>
                  <div className="p-name">{etape.patient_nom} {etape.patient_prenom}</div>
                  <div className="p-addr">{etape.adresse}, {etape.ville} — {Number(etape.distance_km || 0).toFixed(1)} km</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {getStatutBadge(etape.statut)}
                  {etape.statut === 'a_venir' && (
                    <button className="btn btn-sm btn-secondary" onClick={() => updateEtapeStatut(etape.id, 'en_cours')} style={{ fontSize: 9 }}>Démarrer</button>
                  )}
                  {etape.statut === 'en_cours' && (
                    <button className="btn btn-sm btn-green" onClick={() => updateEtapeStatut(etape.id, 'fait')} style={{ fontSize: 9 }}>Terminé</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedTournee && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
          <p>Aucune tournée pour cette date</p>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 8 }}>
        + Créer une tournée
      </button>

      {/* Compteur km global */}
      {km && (
        <div className="card mt-3">
          <div className="section-title" style={{ margin: '0 0 6px' }}>Compteur kilométrique</div>
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#0A3D62' }}>
            {Number(km.total_km || 0).toFixed(1)} km total
          </div>
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nouvelle tournée</div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Ville de départ</label>
                <input value={villeDepart} onChange={e => setVilleDepart(e.target.value)} placeholder="Donneville" required />
              </div>
              <div className="form-group">
                <label>Adresse de départ</label>
                <input value={adresseDepart} onChange={e => setAdresseDepart(e.target.value)} placeholder="Adresse du cabinet" />
              </div>
              <div className="section-title">Sélectionner les patients</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {patients.map(p => (
                  <div key={p.id} className="patient-row" onClick={() => togglePatient(p.id)} style={{ cursor: 'pointer' }}>
                    <div className={`check-box ${selectedPatients.includes(p.id) ? 'done' : ''}`} style={{ width: 20, height: 20 }}>
                      {selectedPatients.includes(p.id) && (
                        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
                      )}
                    </div>
                    <div>
                      <div className="p-name">{p.nom} {p.prenom}</div>
                      <div className="p-addr">{p.adresse}, {p.ville}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>
                Créer la tournée ({selectedPatients.length} patient{selectedPatients.length > 1 ? 's' : ''})
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [points, map]);
  return null;
}
