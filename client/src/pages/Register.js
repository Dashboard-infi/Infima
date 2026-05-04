import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({
    nom: '', prenom: '', email: '', mot_de_passe: '',
    telephone: '', adresse: '', ville: '', code_postal: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // BUG FIX: Validation côté client avant envoi
    if (form.mot_de_passe.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      await api.register(form);
      navigate('/login', { state: { message: 'Compte créé ! Connectez-vous.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">CD</div>
        <div className="auth-title">Inscription</div>
        <div className="auth-subtitle">Créez votre profil infirmier</div>

        {error && (
          <div className="error-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label>Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Prénom *</label>
              <input name="prenom" value={form.prenom} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label>Adresse e-mail *</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required autoComplete="email" />
          </div>

          <div className="form-group">
            <label>Mot de passe * <span style={{ color: '#98A4B3', fontWeight: 400 }}>(8 caractères min.)</span></label>
            <input type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={handleChange} required autoComplete="new-password" />
          </div>

          <div className="form-group">
            <label>Téléphone</label>
            <input type="tel" name="telephone" value={form.telephone} onChange={handleChange} />
          </div>

          {/* BUG FIX: adresse non required (infirmiers libéraux peuvent ne pas vouloir la renseigner) */}
          <div className="form-group">
            <label>Adresse</label>
            <input name="adresse" value={form.adresse} onChange={handleChange} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label>Ville</label>
              <input name="ville" value={form.ville} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Code postal</label>
              <input name="code_postal" value={form.code_postal} onChange={handleChange} />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" style={{ marginTop: 4 }} disabled={loading}>
            {loading ? 'Création du compte…' : 'Créer mon compte'}
          </button>
        </form>

        <div className="auth-link">
          Déjà un compte ?&nbsp;<Link to="/login">Se connecter</Link>
        </div>
      </div>
    </div>
  );
}
