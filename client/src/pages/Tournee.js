import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COLORS = ['#0C2D4E', '#1D9E75', '#D85A30', '#7B2D8E', '#1A4A6E', '#A32D2D'];

function createIcon(color, label, isPosition = false) {
  if (isPosition) {
    return L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#48CBA8;border:3px solid #fff;box-shadow:0 0 0 3px rgba(72,203,168,0.4),0 2px 6px rgba(0,0,0,0.3);animation:gpsPulse 2s ease-in-out infinite;"></div>
      <style>@keyframes gpsPulse{0%,100%{box-shadow:0 0 0 3px rgba(72,203,168,0.4),0 2px 6px rgba(0,0,0,0.3)}50%{box-shadow:0 0 0 8px rgba(72,203,168,0),0 2px 6px rgba(0,0,0,0.3)}}</style>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.7)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/* Calcul distance Haversine entre deux points GPS en km */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Calcule la distance totale de la tournée depuis la position actuelle */
function calculerKmTournee(positionGPS, points) {
  if (!points || points.length === 0) return 0;
  let total = 0;
  let dernierLat = positionGPS ? positionGPS.lat : points[0].lat;
  let dernierLon = positionGPS ? positionGPS.lon : points[0].lon;
  for (const pt of points) {
    total += haversineKm(dernierLat, dernierLon, pt.lat, pt.lon);
    dernierLat = pt.lat;
    dernierLon = pt.lon;
  }
  return total;
}

export default function Tournee() {
  const [date, setDate]                     = useState(new Date().toISOString().split('T')[0]);
  const [selectedTournee, setSelectedTournee] = useState(null);
  const [patients, setPatients]             = useState([]);
  const [showModal, setShowModal]           = useState(false);
  const [villeDepart, setVilleDepart]       = useState('');
  const [adresseDepart, setAdresseDepart]   = useState('');
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [km, setKm]                         = useState(null);
  const [geocodedPoints, setGeocodedPoints] = useState([]);

  /* ---- Géolocalisation GPS ---- */
  const [geoStatus, setGeoStatus]     = useState('idle');   // idle | loading | active | error
  const [geoPosition, setGeoPosition] = useState(null);     // { lat, lon, accuracy }
  const [geoError, setGeoError]       = useState(null);
  const [kmDepuisGPS, setKmDepuisGPS] = useState(null);
  const [kmParcourus, setKmParcourus] = useState(0);
  const [trajPositions, setTrajPositions] = useState([]);   // historique du trajet
  const watchIdRef = useRef(null);

  useEffect(() => {
    api.getPatients().then(setPatients).catch(() => {});
    api.getKm({}).then(setKm).catch(() => {});
    return () => stopGeo(); // nettoyage au démontage
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Recalcule km depuis GPS quand position ou points changent */
  useEffect(() => {
    if (geoPosition && geocodedPoints.length > 0) {
      const restant = calculerKmTournee(geoPosition, geocodedPoints.filter(p => {
        const etape = selectedTournee?.etapes?.find(e => e.id === p.id);
        return etape && etape.statut !== 'fait';
      }));
      setKmDepuisGPS(restant);
    }
  }, [geoPosition, geocodedPoints, selectedTournee]);

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

  /* ============================================================
     GÉOLOCALISATION GPS — démarrer / arrêter
     ============================================================ */
  const startGeo = () => {
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas supportée par ce navigateur.");
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    setGeoError(null);
    setTrajPositions([]);
    setKmParcourus(0);

    let lastPos = null;
    let totalKm = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        const newPos = { lat, lon, accuracy };
        setGeoPosition(newPos);
        setGeoStatus('active');

        // Cumul des km parcourus en temps réel
        if (lastPos) {
          const delta = haversineKm(lastPos.lat, lastPos.lon, lat, lon);
          if (delta > 0.005) {  // ignorer mouvements < 5m (bruit GPS)
            totalKm += delta;
            setKmParcourus(totalKm);
            lastPos = newPos;
          }
        } else {
          lastPos = newPos;
        }

        setTrajPositions(prev => [...prev, [lat, lon]]);
      },
      (err) => {
        let msg = "Erreur de géolocalisation.";
        if (err.code === 1) msg = "Accès à la position refusé. Autorisez la géolocalisation dans les paramètres.";
        if (err.code === 2) msg = "Position indisponible. Vérifiez votre signal GPS.";
        if (err.code === 3) msg = "Délai dépassé. Réessayez en extérieur.";
        setGeoError(msg);
        setGeoStatus('error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopGeo = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGeoStatus('idle');
    setGeoPosition(null);
    setTrajPositions([]);
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
      // Calcule la distance réelle GPS si disponible, sinon garde 0
      let distanceKm = 0;
      if (geoPosition) {
        const pt = geocodedPoints.find(p => p.id === etapeId);
        if (pt) distanceKm = haversineKm(geoPosition.lat, geoPosition.lon, pt.lat, pt.lon);
      }
      await api.updateEtape(selectedTournee.id, etapeId, { statut, distance_km: distanceKm });
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
    const map = {
      fait:     { cls: 'badge-green', label: 'Fait' },
      en_cours: { cls: 'badge-amber', label: 'En cours' },
      a_venir:  { cls: 'badge-blue',  label: 'À venir' },
    };
    const x = map[s] || map.a_venir;
    return <span className={`badge ${x.cls}`}>{x.label}</span>;
  };

  // Centre de la carte : GPS en priorité, sinon première étape géocodée, sinon null (carte cachée)
  const mapCenter = geoPosition
    ? [geoPosition.lat, geoPosition.lon]
    : geocodedPoints.length > 0
      ? [geocodedPoints[0].lat, geocodedPoints[0].lon]
      : null;

  const etapesFaites  = selectedTournee?.etapes?.filter(e => e.statut === 'fait').length || 0;
  const etapesTotal   = selectedTournee?.etapes?.length || 0;

  return (
    <div>
      {/* ===== EN-TÊTE ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #0C2D4E 0%, #1A4A6E 100%)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12, color: '#fff',
      }}>
        <div style={{ fontSize: 16, fontWeight: 300, fontStyle: 'italic', marginBottom: 2 }}>Ma tournée</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12 }}>
          {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{etapesFaites}/{etapesTotal}</div>
            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>Étapes</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {kmParcourus > 0 ? `${kmParcourus.toFixed(1)}` : Number(selectedTournee?.km_total || 0).toFixed(1)}
            </div>
            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>km parcourus</div>
          </div>
          {kmDepuisGPS !== null && (
            <div style={{ flex: 1, background: 'rgba(72,203,168,0.2)', border: '1px solid rgba(72,203,168,0.4)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#48CBA8' }}>{kmDepuisGPS.toFixed(1)}</div>
              <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>km restants</div>
            </div>
          )}
        </div>
      </div>

      {/* ===== SÉLECTEUR DATE ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ flex: 1, border: '1px solid #DFE4EB', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', color: '#16202E' }} />
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
          + Tournée
        </button>
      </div>

      {/* ===== BANNIÈRE GPS ===== */}
      <div className={`geo-banner ${geoStatus === 'active' ? 'geo-banner-active' : ''}`}>
        {geoStatus === 'active'
          ? <div className="geo-pulse" />
          : <div className="geo-inactive-dot" />
        }
        <div style={{ flex: 1 }}>
          {geoStatus === 'idle' && (
            <><div style={{ fontSize: 12, fontWeight: 600, color: '#1A4A6E' }}>Géolocalisation GPS</div>
            <div style={{ fontSize: 11, color: '#6B7A8D' }}>Activez pour calculer les km en temps réel</div></>
          )}
          {geoStatus === 'loading' && (
            <><div style={{ fontSize: 12, fontWeight: 600, color: '#1A4A6E' }}>Recherche du signal GPS…</div>
            <div style={{ fontSize: 11, color: '#6B7A8D' }}>Restez en extérieur</div></>
          )}
          {geoStatus === 'active' && (
            <><div style={{ fontSize: 12, fontWeight: 600, color: '#10674E' }}>GPS actif ✓</div>
            <div style={{ fontSize: 11, color: '#6B7A8D' }}>
              Précision ±{Math.round(geoPosition?.accuracy || 0)} m · {kmParcourus.toFixed(2)} km cumulés
            </div></>
          )}
          {geoStatus === 'error' && (
            <><div style={{ fontSize: 12, fontWeight: 600, color: '#B02020' }}>Erreur GPS</div>
            <div style={{ fontSize: 11, color: '#6B7A8D' }}>{geoError}</div></>
          )}
        </div>
        {geoStatus === 'idle' || geoStatus === 'error' ? (
          <button onClick={startGeo} style={{
            background: '#0C2D4E', color: '#fff', border: 'none', borderRadius: 8,
            padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}>
            Activer
          </button>
        ) : (
          <button onClick={stopGeo} style={{
            background: '#FCEAEA', color: '#B02020', border: 'none', borderRadius: 8,
            padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}>
            Arrêter
          </button>
        )}
      </div>

      {/* ===== CARTE ===== */}
      {mapCenter && (
      <div className="map-container" style={{ height: 220 }}>
        <MapContainer
          key={`${mapCenter[0]}-${mapCenter[1]}`}
          center={mapCenter}
          zoom={geoPosition ? 15 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />

          {/* Trajet parcouru en vert */}
          {trajPositions.length > 1 && (
            <Polyline positions={trajPositions} color="#1D9E75" weight={4} opacity={0.75} dashArray="8 4" />
          )}

          {/* Marqueur position GPS actuelle */}
          {geoPosition && (
            <Marker position={[geoPosition.lat, geoPosition.lon]} icon={createIcon(null, null, true)}>
              <Popup>
                <strong>Votre position</strong><br />
                Précision ±{Math.round(geoPosition.accuracy)} m
              </Popup>
            </Marker>
          )}

          {/* Étapes de la tournée */}
          {geocodedPoints.map((pt, i) => (
            <Marker key={pt.id} position={[pt.lat, pt.lon]} icon={createIcon(COLORS[i % COLORS.length], i + 1)}>
              <Popup>
                <strong>{pt.patient_nom} {pt.patient_prenom}</strong><br />
                {pt.adresse}, {pt.ville}
                {geoPosition && (
                  <><br /><span style={{ color: '#1A4A6E', fontWeight: 600 }}>
                    {haversineKm(geoPosition.lat, geoPosition.lon, pt.lat, pt.lon).toFixed(1)} km depuis vous
                  </span></>
                )}
              </Popup>
            </Marker>
          ))}

          {geocodedPoints.length > 0 && <FitBounds points={geocodedPoints} geoPosition={geoPosition} />}
          {geoStatus === 'active' && geoPosition && <CenterOnPosition position={geoPosition} />}
        </MapContainer>
      </div>
      )}
      {/* Placeholder carte quand GPS inactif et pas d'étapes */}
      {!mapCenter && (
        <div style={{
          height: 120, borderRadius: 14, border: '1.5px dashed #DFE4EB',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, color: '#98A4B3', marginBottom: 12,
          background: '#F7F9FB',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <span style={{ fontSize: 12 }}>Activez le GPS ou créez une tournée pour voir la carte</span>
        </div>
      )}

      {/* ===== ÉTAPES ===== */}
      {selectedTournee && selectedTournee.etapes && (
        <>
          <div className="section-title">Ordre de passage</div>
          <div className="card">
            {selectedTournee.etapes.map((etape, i) => {
              const geocodedPt = geocodedPoints.find(p => p.id === etape.id);
              const distGPS = (geoPosition && geocodedPt)
                ? haversineKm(geoPosition.lat, geoPosition.lon, geocodedPt.lat, geocodedPt.lon)
                : null;

              return (
                <div className="patient-row" key={etape.id}>
                  <div className="order-circle" style={{ background: COLORS[i % COLORS.length] }}>{etape.ordre}</div>
                  <div style={{ flex: 1 }}>
                    <div className="p-name">{etape.patient_nom} {etape.patient_prenom}</div>
                    <div className="p-addr">
                      {etape.adresse}, {etape.ville}
                      {distGPS !== null
                        ? <span style={{ color: '#1A8C6A', fontWeight: 600 }}> · 📍 {distGPS.toFixed(1)} km</span>
                        : <span> · {Number(etape.distance_km || 0).toFixed(1)} km</span>
                      }
                    </div>
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
              );
            })}
          </div>
        </>
      )}

      {!selectedTournee && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
          <p>Aucune tournée pour cette date</p>
        </div>
      )}

      {/* ===== COMPTEUR KM GLOBAL ===== */}
      {km && (
        <div className="card mt-3">
          <div className="section-title" style={{ margin: '0 0 8px' }}>Compteur kilométrique global</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0C2D4E' }}>{Number(km.total_km || 0).toFixed(1)}</div>
              <div style={{ fontSize: 10, color: '#98A4B3', textTransform: 'uppercase', letterSpacing: 0.5 }}>km total</div>
            </div>
            {kmParcourus > 0 && (
              <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #EEF1F5', paddingLeft: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1A8C6A' }}>{kmParcourus.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: '#98A4B3', textTransform: 'uppercase', letterSpacing: 0.5 }}>session GPS</div>
              </div>
            )}
          </div>
          {km.km_mois != null && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7A8D', marginBottom: 4 }}>
                <span>Ce mois</span>
                <span>{Number(km.km_mois || 0).toFixed(0)} km</span>
              </div>
              <div style={{ height: 5, background: '#EEF1F5', borderRadius: 3 }}>
                <div style={{ height: 5, background: '#0C2D4E', borderRadius: 3, width: `${Math.min(100, (km.km_mois / 2000) * 100)}%` }} />
              </div>
              <div style={{ fontSize: 10, color: '#C8D0DA', marginTop: 3, textAlign: 'right' }}>/ 2 000 km estimés</div>
            </div>
          )}
        </div>
      )}

      {/* ===== MODAL CRÉATION ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Nouvelle tournée</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Ville de départ</label>
                <input value={villeDepart} onChange={e => setVilleDepart(e.target.value)} placeholder="Nîmes" required />
              </div>
              <div className="form-group">
                <label>Adresse de départ</label>
                <input value={adresseDepart} onChange={e => setAdresseDepart(e.target.value)} placeholder="12 rue du Cabinet" />
              </div>
              <div className="section-title">Patients à visiter</div>
              <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
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
              <button className="btn btn-primary" type="submit">
                Créer ({selectedPatients.length} patient{selectedPatients.length > 1 ? 's' : ''})
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* Ajuste la vue pour inclure tous les points + position GPS */
function FitBounds({ points, geoPosition }) {
  const map = useMap();
  useEffect(() => {
    const allPts = [...points.map(p => [p.lat, p.lon])];
    if (geoPosition) allPts.push([geoPosition.lat, geoPosition.lon]);
    if (allPts.length > 0) {
      const bounds = L.latLngBounds(allPts);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);
  return null;
}

/* Centre la carte sur la position GPS en temps réel */
function CenterOnPosition({ position }) {
  const map = useMap();
  const lastCenter = useRef(null);
  useEffect(() => {
    if (!position) return;
    const { lat, lon } = position;
    if (!lastCenter.current || haversineKm(lastCenter.current[0], lastCenter.current[1], lat, lon) > 0.05) {
      lastCenter.current = [lat, lon];
      // Ne pas recentrer si l'utilisateur a bougé la carte manuellement
    }
  }, [position]);
  return null;
}
