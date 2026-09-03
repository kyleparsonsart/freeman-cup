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

// iOS standalone sometimes reports a window exactly one status bar
// shorter than the screen (seen on device: win 812 on an 874 screen),
// top-anchored, leaving a dead strip under the tab bar. When that
// happens, size the frame to the physical screen instead and flag it
// so the tab bar keeps clear of the home indicator on its own.
const sizeApp = () => {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const portrait = window.innerWidth <= window.screen.width
  const short = standalone && portrait && window.innerHeight < window.screen.height
  const h = short ? window.screen.height : window.innerHeight
  document.documentElement.style.setProperty('--app-h', `${h}px`)
  document.documentElement.classList.toggle('ios-stretch', short)
}
sizeApp()
window.addEventListener('resize', sizeApp)
window.addEventListener('orientationchange', sizeApp)

// ...and the keyboard can scroll the whole window without putting it
// back; snap any leftover offset home.
const pin = () => {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
  sizeApp()
}
window.addEventListener('focusout', pin)
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
