import { Check, ChevronDown, House, LayoutGrid, LogOut, Settings, UserRound, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { APPS, appUrl, getApp, hubUrl, type AppKey } from "./apps.ts";
import { Button, Segmented } from "./controls.tsx";
import { APP_ICONS, ICON_STROKE } from "./icons.tsx";
import { Mark } from "./Mark.tsx";
import { THEMES, type Theme } from "./theme.ts";
import { useMenu } from "./useMenu.ts";

export interface AccountIdentity {
  name: string;
  /** The member's household colour, behind the initial. */
  color: string;
}

export type LogoutAction =
  /** A plain form POST, for the apps whose worker has a /logout route. */
  | { formAction: string }
  /** A handler, for apps that sign out through fetch. */
  | { onSelect: () => void };

export interface HeaderProps {
  /** Which app this is. null renders the hub's header: mark, wordmark and a Household button. */
  app: AppKey | null;
  /** Page actions: icon buttons for what this page alone offers. */
  actions?: ReactNode;
  /**
   * Who is signed in. Omit the prop to show no account menu at all; pass null
   * for an app that has a theme and settings but no household identity yet.
   */
  account?: AccountIdentity | null;
  /** The theme, controlled by the app's own useTheme. */
  theme?: { value: Theme; onChange: (theme: Theme) => void };
  /** Where Settings goes. Omit to leave Settings out of the menu. */
  settingsHref?: string;
  onSettings?: () => void;
  /** Overrides the hub's /household page; null leaves Household out (a guest with no household). */
  householdHref?: string | null;
  /** How to sign out. Omit to leave Log out of the menu. */
  logout?: LogoutAction;
  /** The current hostname; defaults to the browser's. Lets the hub pick dev ports and test hosts. */
  hostname?: string;
}

function currentHostname(hostname?: string): string {
  if (hostname) return hostname;
  return typeof window === "undefined" ? "cornerways.io" : window.location.hostname;
}

/**
 * The one header every Cornerways page shares. Left: the mark and wordmark
 * (back to the hub), a slash, then the app's name, which opens the app
 * switcher. Right: this page's actions, a divider, then the account menu.
 */
export function Header({ app, actions, account, theme, settingsHref, onSettings, householdHref, logout, hostname }: HeaderProps) {
  const host = currentHostname(hostname);
  const hub = hubUrl(host);
  const household = householdHref === undefined ? `${hub}/household` : householdHref;

  return (
    <header className="cw-header">
      <div className="cw-header-left">
        <a className="cw-brand" href={hub} aria-label="Cornerways home">
          <span className="cw-brand-mark">
            <Mark />
          </span>
          <span className="cw-wordmark">Cornerways</span>
        </a>
        {app && (
          <>
            <span className="cw-crumb-sep" aria-hidden="true">
              /
            </span>
            <AppSwitcher current={app} hostname={host} hub={hub} />
          </>
        )}
      </div>
      <div className="cw-header-right">
        {app === null ? (
          household && (
            <Button variant="ghost" href={household} icon={<Users size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />}>
              Household
            </Button>
          )
        ) : (
          <>
            {actions && (
              <>
                <div className="cw-header-actions">{actions}</div>
                <span className="cw-header-divider" aria-hidden="true" />
              </>
            )}
            {account !== undefined && (
              <AccountMenu
                account={account}
                theme={theme}
                settingsHref={settingsHref}
                onSettings={onSettings}
                householdHref={household}
                logout={logout}
              />
            )}
          </>
        )}
      </div>
    </header>
  );
}

function AppSwitcher({ current, hostname, hub }: { current: AppKey; hostname: string; hub: string }) {
  const menu = useMenu();
  const app = getApp(current);

  return (
    <div className="cw-menu-anchor" ref={menu.anchorRef}>
      <button
        ref={menu.triggerRef}
        type="button"
        className="cw-app-switcher"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`${app.name}. Switch app`}
        onClick={menu.onTriggerClick}
        onKeyDown={menu.onTriggerKeyDown}
      >
        {app.name}
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {menu.open && (
        <div className="cw-menu cw-menu--start" role="menu" aria-label="Apps" onKeyDown={menu.onMenuKeyDown}>
          {APPS.filter((candidate) => !candidate.hidden || candidate.key === current).map((candidate) => {
            const Icon = APP_ICONS[candidate.key];
            const isCurrent = candidate.key === current;
            return (
              <a
                key={candidate.key}
                className="cw-menu-item"
                role="menuitem"
                href={appUrl(candidate, hostname)}
                aria-current={isCurrent ? "page" : undefined}
                {...(candidate.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span className="cw-app-chip" style={{ "--cw-app-accent": candidate.accent } as CSSProperties}>
                  <Icon size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </span>
                <span className="cw-menu-item-label">
                  {candidate.name}
                  {candidate.external && <span className="cw-visually-hidden"> (opens in a new tab)</span>}
                </span>
                {isCurrent && <Check className="cw-menu-item-check" size={16} strokeWidth={2} aria-hidden="true" />}
              </a>
            );
          })}
          <div className="cw-menu-divider" role="separator" />
          <a className="cw-menu-item cw-menu-item--muted" role="menuitem" href={hub}>
            <LayoutGrid size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="cw-menu-item-label">All apps overview</span>
          </a>
        </div>
      )}
    </div>
  );
}

interface AccountMenuProps {
  account: AccountIdentity | null;
  theme?: { value: Theme; onChange: (theme: Theme) => void };
  settingsHref?: string;
  onSettings?: () => void;
  householdHref: string | null;
  logout?: LogoutAction;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function AccountMenu({ account, theme, settingsHref, onSettings, householdHref, logout }: AccountMenuProps) {
  const menu = useMenu();
  const label = account ? `${account.name}. Account menu` : "Account menu";

  const settingsItem =
    settingsHref || onSettings ? (
      settingsHref ? (
        <a className="cw-menu-item" role="menuitem" href={settingsHref} onClick={onSettings ? (event) => { event.preventDefault(); menu.close(); onSettings(); } : undefined}>
          <Settings size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="cw-menu-item-label">Settings</span>
        </a>
      ) : (
        <button type="button" className="cw-menu-item" role="menuitem" onClick={() => { menu.close(); onSettings?.(); }}>
          <Settings size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="cw-menu-item-label">Settings</span>
        </button>
      )
    ) : null;

  return (
    <div className="cw-menu-anchor" ref={menu.anchorRef}>
      <button
        ref={menu.triggerRef}
        type="button"
        className={account ? "cw-account" : "cw-account cw-account--anonymous"}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={label}
        onClick={menu.onTriggerClick}
        onKeyDown={menu.onTriggerKeyDown}
      >
        {account ? (
          <>
            <span className="cw-avatar" style={{ background: account.color }} aria-hidden="true">
              {initialOf(account.name)}
            </span>
            <span className="cw-account-name">{account.name}</span>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </>
        ) : (
          <UserRound size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
        )}
      </button>
      {menu.open && (
        <div className="cw-menu cw-menu--end" role="menu" aria-label={label} onKeyDown={menu.onMenuKeyDown}>
          {account && (
            <>
              <div className="cw-menu-identity">
                <span className="cw-avatar cw-avatar--lg" style={{ background: account.color }} aria-hidden="true">
                  {initialOf(account.name)}
                </span>
                <div>
                  <div className="cw-menu-identity-name">{account.name}</div>
                  <div className="cw-menu-identity-sub">Signed in</div>
                </div>
              </div>
              <div className="cw-menu-divider" role="separator" />
            </>
          )}
          {theme && (
            <>
              <div className="cw-menu-section" id="cw-theme-label">
                Theme
              </div>
              <Segmented options={THEMES} value={theme.value} onChange={theme.onChange} label="Theme" size="sm" />
              <div className="cw-menu-divider" role="separator" />
            </>
          )}
          {householdHref && (
            <a className="cw-menu-item" role="menuitem" href={householdHref}>
              <House size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <span className="cw-menu-item-label">Household</span>
            </a>
          )}
          {settingsItem}
          {logout && (
            <>
              <div className="cw-menu-divider" role="separator" />
              {"formAction" in logout ? (
                <form method="post" action={logout.formAction}>
                  <button type="submit" className="cw-menu-item" role="menuitem">
                    <LogOut size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    <span className="cw-menu-item-label">Log out</span>
                  </button>
                </form>
              ) : (
                <button type="button" className="cw-menu-item" role="menuitem" onClick={() => { menu.close(); logout.onSelect(); }}>
                  <LogOut size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  <span className="cw-menu-item-label">Log out</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
