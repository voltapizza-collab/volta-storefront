import React from 'react';
import { createRoot } from 'react-dom/client';
import PosApp from './PosApp';
import { nativeCall } from './nativeBridge';
import { nativeStartupError } from './nativeStartupError';
import '../styles/index.css';
import '../styles/theme.css';
import './native.css';

const root = createRoot(document.getElementById('root'));
async function start() {
  root.render(<div style={{padding:32}}>Conectando con Volta…</div>);
  try {
    window.__voltaSession = await nativeCall('restore');
    root.render(<PosApp />);
  } catch (error) {
    const failure = nativeStartupError(error);
    root.render(<main style={{ padding: 28, lineHeight: 1.5, maxWidth: 520 }}>
      <h1 style={{ fontSize: 23 }}>{failure.title}</h1><p>{failure.message}</p>
      <p style={{ fontSize: 13 }}>Código: {failure.code}</p>
      <button style={{ padding: '12px 18px', font: 'inherit' }} onClick={start}>Reintentar</button>
    </main>);
  }
}
start();
