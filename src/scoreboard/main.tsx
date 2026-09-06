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

// Parallax for the badge lattice: body::before reads --par and translates by
// it, so the wallpaper drifts at a third of scroll speed. The offset wraps at
// the tile height (140px) so the layer never runs out, however long the page.
// One rAF per scroll, nothing under reduced motion.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let queued = false
  const tick = () => { queued = false; document.body.style.setProperty('--par', `${-((window.scrollY * 0.33) % 140)}px`) }
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(tick) } }, { passive: true })
  tick()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Scoreboard />
  </StrictMode>,
)
