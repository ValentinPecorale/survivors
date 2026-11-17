"use client"

import { useSyncExternalStore } from "react"
import { getAudioPlaying, getServerAudioPlaying, subscribeAudio, toggleAudio } from "./hero/sound"

export function SoundToggle() {
  const playing = useSyncExternalStore(subscribeAudio, getAudioPlaying, getServerAudioPlaying)
  return <button type="button" className="sound-toggle" aria-label={playing ? "Pause sound" : "Play sound"} title={playing ? "Pause sound" : "Play sound"} aria-pressed={playing} onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onClick={toggleAudio}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      {playing ? <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 5 6m0-6-5 6" />}
    </svg>
  </button>
}
