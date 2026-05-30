import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { registerServiceWorkerForSecureContextsOnly } from './pwa/registerServiceWorker'
import './styles.css'

registerServiceWorkerForSecureContextsOnly()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
