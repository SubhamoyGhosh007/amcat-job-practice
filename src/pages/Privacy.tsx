import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="landing" id="top">
      <div className="section" style={{ maxWidth: 760 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#1b4fa0', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 600 }}
        >
          ← Back to home
        </button>
        <h1 className="display" style={{ fontSize: 34, margin: '14px 0 6px' }}>Privacy Policy</h1>
        <p className="hint">Effective 2 October 2026 • Concentrix AMCAT Practice</p>

        <h3>What this app is</h3>
        <p>A free practice tool for the Concentrix AMCAT hiring exam: timed mock tests, typing arena, speaking lab and mock interviews.</p>

        <h3>What we collect</h3>
        <p><b>Account data:</b> your email address, chosen username and avatar. <b>Practice data:</b> exam answers and scores, typing test results, speaking-practice counters and interview session records. <b>Microphone audio</b> is recorded only when you press record, stays in your browser for playback, and is never uploaded anywhere.</p>

        <h3>Why we collect it</h3>
        <p>To log you in, keep your score sheets and history across devices, and generate fresh practice sets. Nothing is sold, shared with advertisers, or used for marketing.</p>

        <h3>Where it lives</h3>
        <p>In your browser (local storage) and in our Supabase Postgres database, protected by row-level security so every user can only read and write their own rows. Login is handled by Supabase Auth; social logins (Google, GitHub) follow those providers' own policies. Speech for listening exercises is synthesized on our own voice server — your practice text is sent there solely to generate audio.</p>

        <h3>Your control</h3>
        <p>Settings → Erase local data removes browser copies. Deleting your account removes your identity; contact us to purge cloud rows.</p>

        <h3>Contact</h3>
        <p>Questions about this policy: open an issue at <b>github.com/SubhamoyGhosh007/amcat-job-practice</b>.</p>
      </div>
    </div>
  );
}
