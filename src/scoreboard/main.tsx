import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './scoreboard.css'
import Scoreboard from './Scoreboard'

// No service worker, no write queue, no auth: this is the read-only public
// page served at thefreemancup.com. The app at freeman-cup.vercel.app is
// untouched by anything in src/scoreboard/.
//
// If a worker is registered on this origin it is the app's, left over from
// before the scoreboard shipped; drop it so it cannot serve the app shell.
navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Scoreboard />
  </StrictMode>,
)
