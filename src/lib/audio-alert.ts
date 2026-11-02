'use client'

interface AudioConfig {
  unlocked: boolean
  muted: boolean
  volume: number // 0.0 - 1.0
}

const STORAGE_KEY = 'cravio_kds_audio_config'

/**
 * Web Audio API synthesizer for cafe chime alerts.
 * Generates a pleasant two-tone acoustic chime (880 Hz -> 1320 Hz) natively without external mp3 dependencies.
 * Handles Autoplay Policy unlocks, volume control, mute toggling, and localStorage persistence.
 */
class AudioAlertService {
  private audioCtx: AudioContext | null = null
  private unlocked: boolean = false
  private muted: boolean = false
  private volume: number = 0.8

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as AudioConfig
          this.unlocked = !!parsed.unlocked
          this.muted = !!parsed.muted
          if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1) {
            this.volume = parsed.volume
          }
        }
      } catch {
        // Fallback silently if storage unavailable
      }
    }
  }

  private saveConfig() {
    if (typeof window === 'undefined') return
    try {
      const config: AudioConfig = {
        unlocked: this.unlocked,
        muted: this.muted,
        volume: this.volume,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // Ignore storage errors
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass()
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended' && this.unlocked) {
      this.audioCtx.resume().catch(() => {})
    }

    return this.audioCtx
  }

  /**
   * Explicitly unlocks the Web Audio API on user gesture (e.g. click "Aktifkan Audio Dapur").
   * Satisfies browser Autoplay Policy without external MP3 files.
   */
  public async unlockAudio(): Promise<boolean> {
    try {
      const ctx = this.getAudioContext()
      if (!ctx) return false

      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      // Play an imperceptible silent buffer to seal autoplay permission
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)

      this.unlocked = true
      this.saveConfig()
      return true
    } catch (err) {
      console.warn('Failed to unlock Web Audio API:', err)
      return false
    }
  }

  public isAudioUnlocked(): boolean {
    return this.unlocked
  }

  public isAudioMuted(): boolean {
    return this.muted
  }

  public setMuted(muted: boolean) {
    this.muted = muted
    this.saveConfig()
  }

  public getVolume(): number {
    return this.volume
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    this.saveConfig()
  }

  /**
   * Plays a warm two-tone acoustic bell chime for new incoming paid orders.
   * Tone 1: 880 Hz (A5) -> Tone 2: 1320 Hz (E6 - harmonic fifth)
   * Returns true if chime was synthesised, false if muted, locked, or unavailable.
   */
  public playChime(): boolean {
    if (this.muted || this.volume <= 0) {
      return false
    }

    try {
      const ctx = this.getAudioContext()
      if (!ctx) return false

      const now = ctx.currentTime
      const baseGain = this.volume

      // Tone 1: 880 Hz (A5)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)

      gain1.gain.setValueAtTime(baseGain * 0.35, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)

      osc1.start(now)
      osc1.stop(now + 0.8)

      // Tone 2: 1320 Hz (E6 - harmonic fifth)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1320, now + 0.12)

      gain2.gain.setValueAtTime(baseGain * 0.3, now + 0.12)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2)

      osc2.connect(gain2)
      gain2.connect(ctx.destination)

      osc2.start(now + 0.12)
      osc2.stop(now + 1.2)

      return true
    } catch (err) {
      console.warn('Audio chime playback failed (autoplay restrictions):', err)
      return false
    }
  }
}

export const audioAlert = new AudioAlertService()
