import React from 'react';
import '../styles/FoodPackages.css';

export default function FoodPackageSelector({ packages = [], value = [], onChange, disabled = false, invalid = false }) {
  return <fieldset className="food-selector" disabled={disabled} aria-invalid={invalid}>
    <legend>¿Qué comidas ofrece tu negocio?</legend>
    <p>Selecciona una o varias. Prepararemos sus categorías y funciones.</p>
    <div className="food-selector__options">{packages.map(pack => <label key={pack.id}>
      <input type="checkbox" checked={value.includes(pack.id)} onChange={event => onChange(event.target.checked ? [...value, pack.id] : value.filter(id => id !== pack.id))} />
      <span><strong>{pack.name}</strong>{pack.description && <small>{pack.description}</small>}</span>
    </label>)}</div>
    {invalid && <p role="alert">Selecciona al menos un tipo de comida disponible.</p>}
  </fieldset>;
}
