import { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { useAuthActions } from '../auth/actions';
import { AvatarFace } from '../components/AuthWidgets';
import { useConfirm } from '../ui/alert-dialog';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';
import type { ConfirmOptions } from '../stores/ui';

export interface SideItem {
  to: string;
  end?: boolean;
  label: string;
  Icon: (p: { size?: number }) => ReactNode;
}

type AskFn = (o: ConfirmOptions) => Promise<boolean>;

/** Re-entry flag: one leave prompt at a time across links + logout. */
let leavePromptOpen = false;

/**
 * Shared leave flow: leaving submits the running session as-is — everything
 * unanswered counts as wrong, and it uses one session from the limit.
 */
export async function askLeave(ask: AskFn): Promise<boolean> {
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
  title,
  onNav,
  children,
}: {
  to: string;
  end?: boolean;
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
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `wv-link${isActive ? ' active' : ''} t-tt-trigger`}
      data-tooltip={title}
      onClick={onClick}
    >
      {children}
    </NavLink>
  );
}

/** shadcn-style collapsible trigger with icon-swap motion. */
export function SidebarTrigger({ className = '' }: { className?: string }) {
  const collapsed = useUi((s) => s.collapsed);
  const toggleCollapsed = useUi((s) => s.toggleCollapsed);
  return (
    <button
      className={`wv-side-trigger ${className}`}
      onClick={toggleCollapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <span className="t-icon-swap" data-state={collapsed ? 'b' : 'a'}>
        <span className="t-icon" data-icon="a">
          <PanelLeftClose size={17} />
        </span>
        <span className="t-icon" data-icon="b">
          <PanelLeftOpen size={17} />
        </span>
      </span>
    </button>
  );
}

function MobileTrigger({ className = 'wv-iconbtn' }: { className?: string }) {
  const setMobileOpen = useUi((s) => s.setMobileOpen);
  return (
    <button className={className} onClick={() => setMobileOpen(true)} title="Menu" style={{ color: '#1b4fa0' }}>
      <Menu size={20} />
    </button>
  );
}

/** shadcn-style sidebar: provider state lives in useUi, tooltips shared per nav. */
export function Sidebar({ items }: { items: SideItem[] }) {
  const profile = useSession((s) => s.profile);
  const collapsed = useUi((s) => s.collapsed);
  const mobileOpen = useUi((s) => s.mobileOpen);
  const setMobileOpen = useUi((s) => s.setMobileOpen);
  const { logout } = useAuthActions();
  const navigate = useNavigate();
  const ask = useConfirm();

  async function doLogout() {
    if (!(await askLeave(ask))) return;
    await logout().catch(() => {});
    navigate('/', { replace: true });
  }

  // Skill tooltip orchestration: one bubble shared by every nav trigger.
  // Collapsed sidebar + hover-capable pointers only.
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

    const cleanups: (() => void)[] = [];
    triggers.forEach((t) => {
      const enter = () => place(t);
      t.addEventListener('pointerenter', enter);
      t.addEventListener('focus', enter);
      t.addEventListener('blur', hide);
      cleanups.push(() => {
        t.removeEventListener('pointerenter', enter);
        t.removeEventListener('focus', enter);
        t.removeEventListener('blur', hide);
      });
    });
    group.addEventListener('pointerleave', hide);
    return () => {
      cleanups.forEach((fn) => fn());
      group.removeEventListener('pointerleave', hide);
    };
  }, []);

  return (
    <>
      {mobileOpen && <div className="wv-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`wv-side${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`}>
        <div className="wv-side-head">
          <span className="wv-side-brand">
            <img src="/logo.jpg" alt="Concentrix AMCAT Practice logo" />
            <div>
              <b>AMCAT Practice</b>
              <small>practice ground</small>
            </div>
          </span>
          <SidebarTrigger />
        </div>
        <nav className="wv-side-group t-tt-group" ref={navRef}>
          <div className="wv-side-label">Menu</div>
          {items.map(({ to, end, label, Icon }) => (
            <GuardedLink key={to} to={to} end={end} title={label} onNav={() => setMobileOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
            </GuardedLink>
          ))}
          <div className="wv-side-label">Quick action</div>
          <GuardedLink to="/app/instructions" title="New set" onNav={() => setMobileOpen(false)}>
            <Plus size={19} />
            <span>New set</span>
          </GuardedLink>
          <span className="t-tt" data-show="false" aria-hidden="true" role="tooltip">
            <span className="t-tt-text" />
          </span>
        </nav>
        <div className="wv-side-foot">
          <AvatarFace id={profile?.avatarId ?? 0} size={34} />
          <span className="wv-side-user">
            <b>@{profile?.username || '…'}</b>
            <span>score sheets sync</span>
          </span>
          <button className="wv-iconbtn logout" onClick={doLogout} title="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}

export { MobileTrigger };
