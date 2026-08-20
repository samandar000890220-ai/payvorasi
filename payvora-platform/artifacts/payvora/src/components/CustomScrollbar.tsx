import { useEffect } from 'react'
import { initPayvoraScrollbar } from '@/lib/useCustomScrollbar'

/** Mount once beside the application root. The rendered UI is injected into body. */
export function CustomScrollbar() {
  useEffect(() => initPayvoraScrollbar(), [])

  return null
}
