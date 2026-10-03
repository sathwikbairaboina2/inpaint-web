import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './ui/styles.css'

createRoot(document.getElementById('root')!).render(<App />)

registerSW({ immediate: true })
