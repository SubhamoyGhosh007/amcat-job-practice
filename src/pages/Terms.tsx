import { useNavigate } from 'react-router-dom';

export default function Terms() {
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
        <h1 className="display" style={{ fontSize: 34, margin: '14px 0 6px' }}>Terms of Service</h1>
        <p className="hint">Effective 2 October 2026 • Concentrix AMCAT Practice</p>

        <h3>What this service is</h3>
        <p>A free practice tool for the Concentrix AMCAT hiring exam: timed mock tests, typing arena, speaking lab and mock interviews. An account is required to practise; accounts are free.</p>

        <h3>Fair use</h3>
        <p>Use the app for personal exam preparation. Don't automate it, resell access to it, probe other users' data, or abuse the voice, AI or login systems. Accounts used that way may be suspended.</p>

        <h3>Your content, our content</h3>
        <p>Your answers, scores and recordings remain yours. Practice questions, explanations and study material on this site may be used for personal study but not republished commercially.</p>

        <h3>No guarantees</h3>
        <p>Practice scores estimate readiness — they are not a promise of hiring outcomes, and previous-year-style questions are recalled for practice, not leaked papers. The service runs on a best-effort basis and may change or pause without notice.</p>

        <h3>Liability</h3>
        <p>To the extent the law allows, the service is provided as-is, and we are not liable for hiring decisions, lost data, or downtime. Your remedy for dissatisfaction is to stop using the app and delete your data from Settings.</p>

        <h3>Contact</h3>
        <p>Questions about these terms: open an issue at <b>github.com/SubhamoyGhosh007/amcat-job-practice</b>.</p>
      </div>
    </div>
  );
}
