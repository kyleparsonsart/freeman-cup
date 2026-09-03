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

// iOS standalone can leave 100dvh stuck at a Safari-chrome-reduced
// height (the tab bar floats). Measure the real viewport instead and
// keep it current.
const setAppHeight = () => {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)
window.visualViewport?.addEventListener('resize', setAppHeight)

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
