/**
 * Synthesized Web Audio Sound Effects for authentic Mahjong tactile feedback
 * + Web Speech API voice announcements for discards, Chi, Peng, Gang, and Hu
 */

import { Tile } from '../types/mahjong';

export function getTileSpokenName(tile: Tile | { type: string; displayName?: string }): string {
  if (!tile) return '';
  const type = tile.type;
  const numMap: Record<string, string> = {
    '1': '一', '2': '二', '3': '三', '4': '四', '5': '五',
    '6': '六', '7': '七', '8': '八', '9': '九',
  };

  if (type.endsWith('wan')) {
    const val = type[0];
    return `${numMap[val] || val}万`;
  }
  if (type.endsWith('tiao')) {
    const val = type[0];
    return `${val === '1' ? '一条' : (numMap[val] || val) + '条'}`;
  }
  if (type.endsWith('tong')) {
    const val = type[0];
    return `${numMap[val] || val}筒`;
  }
  if (type === 'wind_E') return '东风';
  if (type === 'wind_S') return '南风';
  if (type === 'wind_W') return '西风';
  if (type === 'wind_N') return '北风';
  if (type === 'dragon_C') return '红中';
  if (type === 'dragon_F') return '发财';
  if (type === 'dragon_B') return '白板';

  return tile.displayName || '';
}

class SoundController {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        try {
          this.cachedVoices = window.speechSynthesis.getVoices();
        } catch {
          // Ignore
        }
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  // Speak mahjong tile or action announcement (default crisp mature female / 御姐 voice, brisk rate 1.28)
  public speak(text: string) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.volume = 1.0;
      utterance.pitch = 1.0;
      utterance.rate = 1.28; // 稍微快一点，干练利落

      if (this.cachedVoices.length === 0) {
        this.cachedVoices = window.speechSynthesis.getVoices();
      }

      const zhVoices = this.cachedVoices.filter(
        (v) => v.lang.startsWith('zh') || v.lang.includes('cmn')
      );

      if (zhVoices.length > 0) {
        utterance.voice = zhVoices[0]; // 默认标准御姐音
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Graceful fallback if speech synthesis is disabled or blocked
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Click on tile to select or hover
  public playTileClick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Realistic heavy acrylic tile clack on table
  public playTileDiscard() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Tile impact noise burst + resonator
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(3.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    // Resonant clack body
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    whiteNoise.start(now);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Crisp double-clack for Meld (Chi / Peng)
  public playMeld() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.playTileDiscard();
    setTimeout(() => {
      this.playTileDiscard();
    }, 70);
  }

  // Resonant Kong chime / gong impact
  public playKong() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [440, 660, 880].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.18, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + idx * 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.6);
    });
  }

  // Triumphant Victory / Hu fanfare chord
  public playHu() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + index * 0.09;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.7);
    });
  }

  // Subtle warning / discard danger sound
  public playAlert() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(260, now + 0.1);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export const soundManager = new SoundController();
