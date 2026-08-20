import React from 'react'
import { useVoiceEngineInternal, UseVoiceEngineResult } from './voiceEngine'

const VoiceEngineContext = React.createContext<UseVoiceEngineResult | null>(null)

export function VoiceEngineProvider({ children }: { children: React.ReactNode }) {
  // instantiate the single authoritative engine for this provider
  const engine = useVoiceEngineInternal()

  // cleanup when provider unmounts
  React.useEffect(() => () => {
    void engine.endVoiceSession()
  }, [])

  return <VoiceEngineContext.Provider value={engine}>{children}</VoiceEngineContext.Provider>
}

export function useVoiceEngine(): UseVoiceEngineResult {
  const ctx = React.useContext(VoiceEngineContext)
  if (!ctx) {
    throw new Error('useVoiceEngine must be used within a VoiceEngineProvider')
  }
  return ctx
}

