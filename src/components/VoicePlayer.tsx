import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { speak } from '../lib/tts';
import { friendlyError } from '../lib/friendly';

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// Single source of truth for the glyph size — edit ONLY this number.
// (Inline style beats stylesheets, attributes and flex-shrink, so it always wins.)
const ICON = 26;
const iconStyle = { width: ICON, height: ICON, flex: 'none' } as const;

/**
 * Classic seek-bar player: thin gray track, orange fill, ringed knob.
 * Play/pause, click-to-seek, time readout.
 */
export function VoicePlayer({ src, autoPlay = false }: { src: string; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioRef.current = audio;
    const onMeta = () => setDur(audio.duration || 0);
    const onTime = () => setT(audio.currentTime);
    const onEnd = () => setPlaying(false);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    if (autoPlay) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audioRef.current = null;
    };
  }, [src, autoPlay]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
    } else {
      if (audio.ended) audio.currentTime = 0;
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        /* blocked — user can retry */
      }
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
  }

  const pct = dur ? (t / dur) * 100 : 0;

  return (
    <div className="vp">
      <button type="button" className="vp-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause style={iconStyle} /> : <Play style={iconStyle} />}
      </button>
      <span className="vp-time">{fmt(t)}</span>
      <div className="vp-seek" onClick={seek}>
        <div className="vp-track" />
        <div className="vp-fill" style={{ width: `${pct}%` }} />
        <div className="vp-knob" style={{ left: `${pct}%` }} />
      </div>
      <span className="vp-time">{fmt(dur)}</span>
    </div>
  );
}

/** Fetches TTS audio, then hands it to the player (autoplays). */
export function TTSVoicePlayer({ text, label, voice, onPlayed }: { text: string; label?: string; voice?: string; onPlayed?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    setLoading(true);
    try {
      const u = await speak(text, voice ? { voice } : undefined);
      setSrc(u);
      onPlayed?.();
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  if (!src) {
    return (
      <span className="svar-audio" style={{ margin: 0 }}>
        <button className="btn-primary" disabled={loading} onClick={load}>
          {loading ? 'Loading voice…' : `▶ ${label || 'Play'}`}
        </button>
        {error && <span className="err">{error}</span>}
      </span>
    );
  }
  return <VoicePlayer src={src} autoPlay />;
}
