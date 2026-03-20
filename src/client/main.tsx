import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles/theme.css';

// Initialize theme
const savedTheme = localStorage.getItem('agentModus_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
