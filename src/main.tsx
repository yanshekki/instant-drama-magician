import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyColorScheme } from './domain/colorScheme'
import './lib/i18n'
import './styles/index.css'

// Immediate OS theme before settings load (avoids wrong flash)
applyColorScheme('system')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
