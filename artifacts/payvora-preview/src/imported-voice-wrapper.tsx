import ImportedVoicePage from '../imported-voice-source/src/App'

/**
 * Adapter for the uploaded voice page.
 *
 * The source under imported-voice-source is kept as an immutable import
 * snapshot. Payvora owns only this wrapper and the route that renders it.
 */
export default function ImportedVoiceWrapper() {
  return (
    <div className="imported-voice-page">
      <ImportedVoicePage />
    </div>
  )
}