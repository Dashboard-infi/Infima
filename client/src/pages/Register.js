import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', mot_de_passe: '', telephone: '', adresse: '', ville: '', code_postal: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.register(form);
      alert('Compte créé avec succès !');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Inscription</div>
        <div className="auth-subtitle">Créez votre profil infirmier</div>
        {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group"><label>Nom</label><input name="nom" value={form.nom} onChange={handleChange} required /></div>
            <div className="form-group"><label>Prénom</label><input name="prenom" value={form.prenom} onChange={handleChange} required /></div>
          </div>
          <div className="form-group"><label>Email</label><input type="email" name="email" value={form.email} onChange={handleChange} required /></div>
          <div className="form-group"><label>Mot de passe</label><input type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={handleChange} required /></div>
          <div className="form-group"><label>Téléphone</label><input name="telephone" value={form.telephone} onChange={handleChange} /></div>
          <div className="form-group"><label>Adresse</label><input name="adresse" value={form.adresse} onChange={handleChange} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div className="form-group"><label>Ville</label><input name="ville" value={form.ville} onChange={handleChange} required /></div>
            <div className="form-group"><label>Code postal</label><input name="code_postal" value={form.code_postal} onChange={handleChange} required /></div>
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>S'inscrire</button>
        </form>
        <div className="auth-link">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </div>
      </div>
    </div>
  );
}
