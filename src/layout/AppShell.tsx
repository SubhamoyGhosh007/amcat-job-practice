import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  Calculator,
  ClipboardList,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Mic,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuthActions } from '../auth/actions';
import { AvatarFace, UsernameModal } from '../components/AuthWidgets';
import { ConfirmDialog, useConfirm } from '../ui/alert-dialog';
import { MobileTrigger, Sidebar, askLeave } from '../components/Sidebar';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';

const TITLES: Record<string, string> = {
  '/app': 'Practice',
  '/app/instructions': 'New set',
  '/app/exam': 'Exam',
  '/app/result': 'Answer script',
  '/app/sheets': 'My sheets',
  '/app/settings': 'Settings',
  '/app/typing': 'Typing arena',
  '/app/speaking': 'Speaking lab',
  '/app/interview': 'Mock interview',
  '/app/maths': 'Maths practice',
  '/app/health': 'Health check',
};

const GROUPS = [
  {
    label: 'Menu',
    items: [
      { to: '/app', end: true, label: 'Practice', Icon: LayoutDashboard },
      { to: '/app/typing', end: false, label: 'Typing arena', Icon: Keyboard },
      { to: '/app/speaking', end: false, label: 'Speaking lab', Icon: Mic },
      { to: '/app/interview', end: false, label: 'Mock interview', Icon: Briefcase },
      { to: '/app/maths', end: false, label: 'Maths practice', Icon: Calculator },
    ],
  },
  {
    label: 'More',
    items: [
      { to: '/app/instructions', end: false, label: 'New set', Icon: Plus },
      { to: '/app/sheets', end: false, label: 'My sheets', Icon: ClipboardList },
      { to: '/app/settings', end: false, label: 'Settings', Icon: SettingsIcon },
      { to: '/app/health', end: false, label: 'Health check', Icon: Activity },
    ],
  },
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthActions();
  const ask = useConfirm();
  const profile = useSession((s) => s.profile);
  const collapsed = useUi((s) => s.collapsed);

  // Closing / reloading the tab mid-session also submits it as completed
  // (local persist is sync, so it always lands; cloud sync best-effort).
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      const guard = useUi.getState().leaveGuard;
      if (!guard) return;
      // Native dialog requires returnValue set (preventDefault alone is ignored).
      e.preventDefault();
      e.returnValue = '';
      try {
        guard.confirmLeave();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, []);

  async function doLogout() {
    if (!(await askLeave(ask))) return;
    await logout().catch(() => {});
    navigate('/', { replace: true });
  }

  return (
    <div>
      <Sidebar groups={GROUPS} />

      <div className={`wv-main${collapsed ? ' wide' : ''}`}>
        <header className="sb-top">
          <MobileTrigger className="sb-iconbtn sb-hamburger" />
          <span className="sb-title">{TITLES[location.pathname] || 'Practice'}</span>
          <span className="spacer" />
          <AvatarFace id={profile?.avatarId ?? 0} size={30} />
          <b className="sb-topuser" style={{ fontSize: 13 }}>@{profile?.username || '…'}</b>
          <button className="sb-iconbtn" onClick={doLogout} title="Log out" style={{ color: '#1b4fa0' }}>
            <LogOut size={17} />
          </button>
        </header>
        <div className="wrap">
          <Outlet />
        </div>
      </div>
      <UsernameModal />
      <ConfirmDialog />
    </div>
  );
}
