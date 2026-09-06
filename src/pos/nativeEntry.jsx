import React from 'react';
import { createRoot } from 'react-dom/client';
import PosApp from './PosApp';
import { nativeCall } from './nativeBridge';
import '../styles/index.css';
import '../styles/theme.css';
import './native.css';

const root = createRoot(document.getElementById('root'));
async function start() {
  root.render(<div style={{padding:32}}>Conectando con Volta…</div>);
  try {
    window.__voltaSession = await nativeCall('restore');
    root.render(<PosApp />);
  } catch (_) {
    root.render(<div style={{padding:32}}>No se pudo validar el terminal. Comprueba la conexión a internet.<p><button onClick={start}>Reintentar</button></p></div>);
  }
}
start();
