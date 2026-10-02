import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardDesc, CardTitle } from '../ui/primitives';
import { describeSource } from '../lib/generator';
import { isDbConfigured } from '../lib/supabase';
import { useSession } from '../stores/session';
import { AvatarFace } from '../components/AuthWidgets';

/** Plain-English status. No keys, no SQL, no jargon — this page is for practicers, not developers. */
export default function Health() {
  const navigate = useNavigate();
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const templateOk = useSession((s) => s.hasCloudToken);
  const cloud = isDbConfigured();

  const src = describeSource();
  const aiOn = src.startsWith('gemini');

  const backup: { tone?: 'success' | 'warning' | 'primary'; label: string; text: string } = !cloud
    ? { label: 'This browser only', text: 'Your sets are saved in this browser only.' }
    : templateOk === false
      ? {
          label: 'Paused',
          text: 'Cloud backup is paused — we could not get a login token. Sign out and back in, then reload this page.',
        }
      : templateOk
        ? { tone: 'success', label: 'Backing up', text: 'On — every finished set is saved to your online account as well as this browser.' }
        : { tone: 'primary', label: 'Checking…', text: 'Verifying the cloud link — wait a moment.' };

  return (
    <div>
      <div className="page-hero">
        <h2>How things are running</h2>
        <p>Everything below is automatic. If something looks off, tell the person who set this up for you.</p>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <AvatarFace id={profile?.avatarId ?? 0} size={48} />
          <div style={{ flex: 1 }}>
            <CardTitle>@{profile?.username || '…'}</CardTitle>
            <CardDesc>{email}</CardDesc>
          </div>
          <Badge tone="success">Signed in</Badge>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button size="sm" variant="outline" onClick={() => navigate('/app/settings')}>
            Edit profile
          </Button>
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <CardTitle>Score backup</CardTitle>
        <CardDesc>{backup.text}</CardDesc>
        <div style={{ marginTop: 10 }}>
          <Badge tone={backup.tone}>{backup.label}</Badge>
        </div>
      </Card>

      <Card>
        <CardTitle>Questions</CardTitle>
        <CardDesc>
          {aiOn
            ? 'Fresh set every time — new questions are made for each attempt, so nothing repeats.'
            : 'Built-in question bank — shuffled every attempt, works even offline.'}
        </CardDesc>
        <div style={{ marginTop: 10 }}>
          <Badge tone={aiOn ? 'primary' : undefined}>{aiOn ? 'Always new' : 'Practice bank'}</Badge>
        </div>
      </Card>
    </div>
  );
}
