import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import {
  Activity,
  Briefcase,
  Calculator,
  ClipboardList,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuthActions } from '../auth/actions';
import { AvatarFace, UsernameModal } from '../components/AuthWidgets';
import { ConfirmDialog, useConfirm } from '../ui/alert-dialog';
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

const NAV = [
  { to: '/app', end: true, label: 'Practice', Icon: LayoutDashboard },
  { to: '/app/sheets', end: false, label: 'My sheets', Icon: ClipboardList },
  { to: '/app/typing', end: false, label: 'Typing arena', Icon: Keyboard },
  { to: '/app/speaking', end: false, label: 'Speaking lab', Icon: Mic },
  { to: '/app/interview', end: false, label: 'Mock interview', Icon: Briefcase },
  { to: '/app/maths', end: false, label: 'Maths practice', Icon: Calculator },
  { to: '/app/settings', end: false, label: 'Settings', Icon: SettingsIcon },
  { to: '/app/health', end: false, label: 'Health check', Icon: Activity },
];

function GuardedLink({
  to,
  end,
  className,
  title,
  onNav,
  children,
}: {
  to: string;
  end?: boolean;
  className: string | ((p: { isActive: boolean }) => string);
  title?: string;
  onNav?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const ask = useConfirm();
  async function onClick(e: MouseEvent) {
    onNav?.();
    const guard = useUi.getState().leaveGuard;
    if (!guard) return;
    e.preventDefault();
    const ok = await ask({
      title: 'Leave the interview?',
      description:
        'The screen is monitored during the mock. Cancel this mock test, or resume where you left off? Leaving is recorded on your session.',
      actionLabel: 'Cancel mock test',
      cancelLabel: 'Resume interview',
      danger: true,
    });
    if (!ok) return;
    guard.confirmLeave();
    navigate(to);
  }
  return (
    <NavLink to={to} end={end} className={className} title={title} onClick={onClick}>
      {children}
    </NavLink>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthActions();
  const ask = useConfirm();
  const profile = useSession((s) => s.profile);
  const collapsed = useUi((s) => s.collapsed);
  const toggleCollapsed = useUi((s) => s.toggleCollapsed);
  const mobileOpen = useUi((s) => s.mobileOpen);
  const setMobileOpen = useUi((s) => s.setMobileOpen);

  // A running mock interview registers a guard: leaving (sidebar, back, logout)
  // must ask first — Cancel mock test discards it, Resume stays put.
  async function checkLeaveGuard(): Promise<boolean> {
    const guard = useUi.getState().leaveGuard;
    if (!guard) return true;
    const ok = await ask({
      title: 'Leave the interview?',
      description:
        'The screen is monitored during the mock. Cancel this mock test, or resume where you left off? Leaving is recorded on your session.',
      actionLabel: 'Cancel mock test',
      cancelLabel: 'Resume interview',
      danger: true,
    });
    if (ok) guard.confirmLeave();
    return ok;
  }

  async function doLogout() {
    if (!(await checkLeaveGuard())) return;
    await logout().catch(() => {});
    navigate('/', { replace: true });
  }

  return (
    <div>
      {mobileOpen && <div className="sb-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sb${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`}>
        <div className="sb-head">
          <span className="sb-logo" />
          <span className="sb-name">Concentrix AMCAT<small>practice ground</small></span>
          <button className="sb-collapse" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="sb-nav">
          <div className="sb-label">Menu</div>
          {NAV.map(({ to, end, label, Icon }) => (
            <GuardedLink key={to} to={to} end={end} className={({ isActive }) => `sb-link${isActive ? ' active' : ''}`} title={label} onNav={() => setMobileOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
            </GuardedLink>
          ))}
          <div className="sb-label">Quick action</div>
          <GuardedLink to="/app/instructions" className="sb-link" title="New set" onNav={() => setMobileOpen(false)}>
            <Plus size={19} />
            <span>New set</span>
          </GuardedLink>
        </nav>
        <div className="sb-foot">
          <AvatarFace id={profile?.avatarId ?? 0} size={34} />
          <span className="sb-user">
            <b>@{profile?.username || '…'}</b>
            <span>score sheets sync</span>
          </span>
          <button className="sb-iconbtn" onClick={doLogout} title="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className={`sb-main${collapsed ? ' wide' : ''}`}>
        <header className="sb-top">
          <button className="sb-iconbtn sb-hamburger" onClick={() => setMobileOpen(true)} title="Menu" style={{ color: '#1b4fa0' }}>
            <Menu size={20} />
          </button>
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
