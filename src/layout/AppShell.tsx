import { useEffect, useRef } from 'react';
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
import type { ConfirmOptions } from '../stores/ui';

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

/** Re-entry flag: one leave prompt at a time across links + logout. */
let leavePromptOpen = false;

type AskFn = (o: ConfirmOptions) => Promise<boolean>;

/**
 * Shared leave flow: leaving submits the running session as-is — everything
 * unanswered counts as wrong, and it uses one session from the limit.
 */
async function askLeave(ask: AskFn): Promise<boolean> {
  if (leavePromptOpen) return false;
  const guard = useUi.getState().leaveGuard;
  if (!guard) return true;
  leavePromptOpen = true;
  try {
    const ok = await ask({
      title: 'Leave and submit?',
      description:
        'Leaving now submits this session as-is: everything unanswered counts as wrong, and it uses one session from your limit.',
      actionLabel: 'Leave & submit',
      cancelLabel: 'Stay & continue',
      danger: true,
    });
    if (ok) guard.confirmLeave();
    return ok;
  } finally {
    leavePromptOpen = false;
  }
}

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
    if (useUi.getState().leaveGuard) e.preventDefault();
    else return;
    if (await askLeave(ask)) navigate(to);
  }
  const cls =
    typeof className === 'function'
      ? (p: { isActive: boolean }) => `${className(p)} t-tt-trigger`
      : `${className} t-tt-trigger`;
  return (
    <NavLink to={to} end={end} className={cls} data-tooltip={title} onClick={onClick}>
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

  // Skill tooltip orchestration: one bubble shared by every nav trigger.
  // Hovering writes the bubble's x/y + width for that trigger; when already
  // showing it tweens (travels), when hidden the geometry snaps and only the
  // appear plays. Collapsed sidebar + hover-capable pointers only.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const group = navRef.current;
    if (!group) return;
    const tip = group.querySelector('.t-tt') as HTMLElement | null;
    const text = tip?.querySelector('.t-tt-text') as HTMLElement | null;
    if (!tip || !text) return;
    const triggers = [...group.querySelectorAll('.t-tt-trigger')] as HTMLElement[];
    const fine = () => window.matchMedia('(hover: hover)').matches;
    const aside = () => group.closest('aside');

    function hide() {
      tip!.setAttribute('data-show', 'false');
      tip!.setAttribute('aria-hidden', 'true');
    }

    function place(trigger: HTMLElement) {
      if (!fine() || !aside()?.classList.contains('collapsed')) {
        hide();
        return;
      }
      const showing = tip!.getAttribute('data-show') === 'true';
      text!.textContent = trigger.getAttribute('data-tooltip') || '';
      const cs = getComputedStyle(tip!);
      const width = Math.ceil(text!.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight));
      const g = group!.getBoundingClientRect();
      const r = trigger.getBoundingClientRect();
      const x = r.right - g.left + 10;
      const y = r.top - g.top + r.height / 2 - 18;
      if (!showing) {
        // Snap the geometry while hidden so only the appear plays.
        tip!.style.transition = 'none';
        tip!.style.width = `${width}px`;
        tip!.style.setProperty('--tt-x', `${x}px`);
        tip!.style.setProperty('--tt-y', `${y}px`);
        void tip!.offsetWidth;
        tip!.style.transition = '';
      } else {
        tip!.style.width = `${width}px`;
        tip!.style.setProperty('--tt-x', `${x}px`);
        tip!.style.setProperty('--tt-y', `${y}px`);
      }
      tip!.setAttribute('data-show', 'true');
      tip!.setAttribute('aria-hidden', 'false');
    }

    const onEnter = (t: HTMLElement) => () => place(t);
    const cleanups: (() => void)[] = [];
    triggers.forEach((t) => {
      const enter = onEnter(t);
      const focus = onEnter(t);
      t.addEventListener('pointerenter', enter);
      t.addEventListener('focus', focus);
      t.addEventListener('blur', hide);
      cleanups.push(() => {
        t.removeEventListener('pointerenter', enter);
        t.removeEventListener('focus', focus);
        t.removeEventListener('blur', hide);
      });
    });
    group.addEventListener('pointerleave', hide);
    return () => {
      cleanups.forEach((fn) => fn());
      group.removeEventListener('pointerleave', hide);
    };
  }, []);

  async function doLogout() {
    if (!(await askLeave(ask))) return;
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
            <span className="t-icon-swap" data-state={collapsed ? 'b' : 'a'}>
              <span className="t-icon" data-icon="a">
                <PanelLeftClose size={17} />
              </span>
              <span className="t-icon" data-icon="b">
                <PanelLeftOpen size={17} />
              </span>
            </span>
          </button>
        </div>
        <nav className="sb-nav t-tt-group" ref={navRef}>
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
          <span className="t-tt" data-show="false" aria-hidden="true" role="tooltip">
            <span className="t-tt-text" />
          </span>
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
