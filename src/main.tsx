import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DesignSystem from './designsystem/DesignSystem'
import { registerSW } from 'virtual:pwa-register'
import { initWriteQueue } from './lib/writeQueue'
import { applyTheme, getTheme } from './lib/theme'

// theme before first paint; dark unless this device chose light
applyTheme(getTheme())

// iOS standalone scrolls the whole window when the keyboard opens and
// doesn't always put it back — the app frame is position:fixed so that
// scroll can't move it, and this guard snaps any leftover offset home.
const pin = () => {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
}
window.addEventListener('focusout', pin)
window.addEventListener('orientationchange', pin)
window.visualViewport?.addEventListener('resize', pin)

const isDesignSystem = location.pathname.replace(/\/+$/, '') === '/designsystem'

if (!isDesignSystem) {
  registerSW({ immediate: true })
  initWriteQueue()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesignSystem ? <DesignSystem /> : <App />}
  </StrictMode>,
)
