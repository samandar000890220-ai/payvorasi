import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CustomScrollbar } from './components/CustomScrollbar'
import { ThemeProvider } from './lib/theme'
import { VoiceEngineProvider } from './voiceEngineContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <VoiceEngineProvider>
        <App />
      </VoiceEngineProvider>
      <CustomScrollbar />
    </ThemeProvider>
  </React.StrictMode>,
)
