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

// The frame is position:fixed inset:0 — the honest window, whatever
// iOS reports. (Painting past a short window proved impossible: the
// surface really is clipped. A latched-short install is cured by
// deleting and re-adding the app, not by CSS.) The keyboard can still
// scroll the whole window without putting it back; snap it home.
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
