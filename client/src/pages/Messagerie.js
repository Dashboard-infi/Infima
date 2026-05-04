import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function Messagerie() {
  const [tab,          setTab]          = useState('inbox');
  const [messages,     setMessages]     = useState({ received: [], sent: [], unread_count: 0 });
  const [infirmiers,   setInfirmiers]   = useState([]);
  const [showCompose,  setShowCompose]  = useState(false);
  const [selectedMsg,  setSelectedMsg]  = useState(null);
  const [form,         setForm]         = useState({ destinataire_id: '', objet: '', contenu: '' });
  const [sending,      setSending]      = useState(false);

  const loadMessages = useCallback(() => {
    api.getMessages().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    loadMessages();
    api.getInfirmiers().then(setInfirmiers).catch(() => {});
  }, [loadMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!form.contenu.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(form);
      setShowCompose(false);
      setForm({ destinataire_id: '', objet: '', contenu: '' });
      loadMessages();
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const openMessage = async (msg) => {
    setSelectedMsg(msg);
    // BUG FIX: ne marquer comme lu que dans la boite de réception
    if (!msg.lu && tab === 'inbox') {
      await api.markRead(msg.id).catch(() => {});
      loadMessages();
    }
  };

  const currentList = tab === 'inbox' ? messages.received : messages.sent;

  if (selectedMsg) {
    return (
      <div>
        <button
          className="header-back"
          onClick={() => setSelectedMsg(null)}
          style={{ color: '#0C2D4E', marginBottom: 12 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Retour
        </button>

        <div className="card">
          <div style={{ fontSize: 16, fontWeight: 700, color: '#16202E', marginBottom: 6 }}>
            {selectedMsg.objet || '(Sans objet)'}
          </div>
          <div style={{ fontSize: 11.5, color: '#6B7A8D', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* BUG FIX: afficher l'expéditeur correct selon l'onglet */}
            {tab === 'inbox' ? (
              <span>De : <strong>{selectedMsg.exp_prenom} {selectedMsg.exp_nom}</strong></span>
            ) : (
              <span>À : <strong>{selectedMsg.dest_prenom} {selectedMsg.dest_nom}</strong></span>
            )}
            <span style={{ color: '#C8D0DA' }}>•</span>
            <span>
              {selectedMsg.created_at
                ? new Date(selectedMsg.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'}
            </span>
          </div>
          <div className="divider" />
          <div style={{ fontSize: 13.5, color: '#3A4555', lineHeight: 1.7, marginTop: 12, whiteSpace: 'pre-wrap' }}>
            {selectedMsg.contenu}
          </div>
        </div>

        {/* Répondre (seulement depuis inbox) */}
        {tab === 'inbox' && (
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => {
              setForm({
                destinataire_id: selectedMsg.expediteur_id,
                objet: selectedMsg.objet ? `RE: ${selectedMsg.objet}` : '',
                contenu: '',
              });
              setSelectedMsg(null);
              setShowCompose(true);
            }}
          >
            ↩ Répondre
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Onglets */}
      <div className="tabs">
        <button
          className={`tab ${tab === 'inbox' ? 'active' : ''}`}
          onClick={() => { setTab('inbox'); setSelectedMsg(null); }}
        >
          Reçus
          {messages.unread_count > 0 && (
            <span style={{ background: '#0C2D4E', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 6, fontWeight: 700 }}>
              {messages.unread_count}
            </span>
          )}
        </button>
        <button
          className={`tab ${tab === 'sent' ? 'active' : ''}`}
          onClick={() => { setTab('sent'); setSelectedMsg(null); }}
        >
          Envoyés
        </button>
      </div>

      {/* Liste des messages */}
      {currentList.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <h4>{tab === 'inbox' ? 'Aucun message reçu' : 'Aucun message envoyé'}</h4>
          <p>Votre messagerie est vide</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {currentList.map(msg => (
            <div
              key={msg.id}
              className={`message-item ${!msg.lu && tab === 'inbox' ? 'unread' : ''}`}
              onClick={() => openMessage(msg)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  {/* BUG FIX: affichage correct expéditeur/destinataire */}
                  <div className="message-from">
                    {tab === 'inbox'
                      ? `${msg.exp_prenom || ''} ${msg.exp_nom || ''}`
                      : `→ ${msg.dest_prenom || ''} ${msg.dest_nom || ''}`}
                  </div>
                  <div className="message-subject">{msg.objet || '(Sans objet)'}</div>
                  <div className="message-preview">{msg.contenu}</div>
                  <div className="message-date">
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </div>
                </div>
                {!msg.lu && tab === 'inbox' && <div className="unread-dot" style={{ marginTop: 4 }} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB composer */}
      <button className="fab" onClick={() => { setForm({ destinataire_id: '', objet: '', contenu: '' }); setShowCompose(true); }} title="Nouveau message">
        ✉
      </button>

      {/* ===== MODAL COMPOSER ===== */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Nouveau message</div>
            <button className="modal-close" onClick={() => setShowCompose(false)}>✕</button>

            <form onSubmit={sendMessage}>
              <div className="form-group">
                <label>Destinataire *</label>
                <select
                  value={form.destinataire_id}
                  onChange={e => setForm({...form, destinataire_id: e.target.value})}
                  required
                >
                  <option value="">Choisir un infirmier…</option>
                  {infirmiers.map(i => (
                    <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Objet</label>
                <input
                  value={form.objet}
                  onChange={e => setForm({...form, objet: e.target.value})}
                  placeholder="Sujet du message…"
                />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  value={form.contenu}
                  onChange={e => setForm({...form, contenu: e.target.value})}
                  placeholder="Écrivez votre message…"
                  required
                  style={{ minHeight: 100 }}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={sending}>
                {sending ? 'Envoi…' : 'Envoyer le message'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
