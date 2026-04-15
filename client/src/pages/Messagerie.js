import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Messagerie() {
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState({ received: [], sent: [], unread_count: 0 });
  const [infirmiers, setInfirmiers] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [form, setForm] = useState({ destinataire_id: '', objet: '', contenu: '' });

  useEffect(() => {
    loadMessages();
    api.getInfirmiers().then(setInfirmiers).catch(() => {});
  }, []);

  const loadMessages = () => {
    api.getMessages().then(setMessages).catch(() => {});
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    try {
      await api.sendMessage(form);
      setShowCompose(false);
      setForm({ destinataire_id: '', objet: '', contenu: '' });
      loadMessages();
    } catch (err) { alert(err.message); }
  };

  const openMessage = async (msg) => {
    setSelectedMsg(msg);
    if (!msg.lu && tab === 'inbox') {
      await api.markRead(msg.id).catch(() => {});
      loadMessages();
    }
  };

  const currentList = tab === 'inbox' ? messages.received : messages.sent;

  return (
    <div>
      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'inbox' ? 'active' : ''}`} onClick={() => { setTab('inbox'); setSelectedMsg(null); }}>
          Reçus {messages.unread_count > 0 && <span style={{ background: '#0A3D62', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{messages.unread_count}</span>}
        </button>
        <button className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => { setTab('sent'); setSelectedMsg(null); }}>Envoyés</button>
      </div>

      {/* Message sélectionné */}
      {selectedMsg ? (
        <div>
          <button className="header-back" onClick={() => setSelectedMsg(null)} style={{ color: '#0A3D62', marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Retour
          </button>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{selectedMsg.objet || '(Sans objet)'}</div>
            <div style={{ fontSize: 11, color: '#7a8499', marginBottom: 8 }}>
              {tab === 'inbox'
                ? `De : ${selectedMsg.exp_prenom || ''} ${selectedMsg.exp_nom || ''}`
                : `À : ${selectedMsg.dest_prenom || ''} ${selectedMsg.dest_nom || ''}`}
              {' • '}{new Date(selectedMsg.date_envoi).toLocaleString('fr-FR')}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedMsg.contenu}</div>
          </div>
        </div>
      ) : (
        <>
          {/* Liste des messages */}
          <div className="card" style={{ padding: 0 }}>
            {currentList.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" width="40" height="40"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5"/><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <p>Aucun message</p>
              </div>
            ) : (
              currentList.map(msg => (
                <div key={msg.id} className={`message-item ${tab === 'inbox' && !msg.lu ? 'unread' : ''}`} onClick={() => openMessage(msg)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tab === 'inbox' && !msg.lu && <div className="unread-dot"></div>}
                      <div className="message-from">
                        {tab === 'inbox'
                          ? `${msg.exp_prenom || ''} ${msg.exp_nom || ''}`
                          : `${msg.dest_prenom || ''} ${msg.dest_nom || ''}`}
                      </div>
                    </div>
                    <div className="message-date">{new Date(msg.date_envoi).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className="message-subject">{msg.objet || '(Sans objet)'}</div>
                  <div className="message-preview">{msg.contenu}</div>
                </div>
              ))
            )}
          </div>

          <button className="btn btn-primary" onClick={() => setShowCompose(true)} style={{ marginTop: 10 }}>
            + Nouveau message
          </button>
        </>
      )}

      {/* Modal composer */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nouveau message</div>
            <form onSubmit={sendMessage}>
              <div className="form-group">
                <label>Destinataire</label>
                <select value={form.destinataire_id} onChange={e => setForm({...form, destinataire_id: e.target.value})} required>
                  <option value="">Choisir un collègue</option>
                  {infirmiers.map(inf => <option key={inf.id} value={inf.id}>{inf.prenom} {inf.nom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Objet</label>
                <input value={form.objet} onChange={e => setForm({...form, objet: e.target.value})} placeholder="Objet du message" />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea value={form.contenu} onChange={e => setForm({...form, contenu: e.target.value})} rows={6} placeholder="Votre message..." required />
              </div>
              <button className="btn btn-primary" type="submit">Envoyer</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCompose(false)} style={{ marginTop: 8 }}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
