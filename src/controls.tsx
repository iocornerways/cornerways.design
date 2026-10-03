import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentPropsWithRef, CSSProperties, ReactNode } from "react";

function join(...classes: Array<string | undefined | false | null>): string {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  /** A leading lucide icon, already sized (18 reads well). */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = ButtonBaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonAsLink = ButtonBaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Primary (terracotta, the one main action on a page), secondary (bordered)
 * or ghost (quiet). Renders an <a> when given an href.
 */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "secondary", icon, children, className, ...rest } = props;
  const classes = join("cw-button", variant !== "secondary" && `cw-button--${variant}`, className);
  if ("href" in rest && rest.href !== undefined) {
    const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} {...anchor}>
        {icon}
        {children}
      </a>
    );
  }
  const button = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={classes} {...button}>
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ComponentPropsWithRef<"button"> {
  /** What it does — read by screen readers and shown as the tooltip. */
  label: string;
  children: ReactNode;
  /** Lit in the brand accent, for a toggle that is on. */
  active?: boolean;
}

/** A 40×40 bordered square holding one line icon. */
export function IconButton({ label, children, active, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={join("cw-icon-button", active && "cw-icon-button--active", className)}
      aria-label={label}
      title={label}
      {...(active !== undefined ? { "aria-pressed": active } : {})}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Filter pill ---------- */

interface PillProps extends ComponentPropsWithRef<"button"> {
  active?: boolean;
  /** A colour dot, for a person or category. */
  dot?: string;
  children: ReactNode;
}

/** A fully rounded toggle for filters. */
export function Pill({ active = false, dot, children, className, ...rest }: PillProps) {
  return (
    <button type="button" className={join("cw-pill", className)} aria-pressed={active} {...rest}>
      {dot && <span className="cw-pill-dot" style={{ background: dot }} aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------- Segmented control ---------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** Why it's disabled, shown on hover. */
  title?: string;
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses between, for assistive tech. */
  label: string;
  size?: "md" | "sm";
  className?: string;
  style?: CSSProperties;
}

/** A grey track with one white active segment. */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md", className, style }: SegmentedProps<T>) {
  return (
    <div className={join("cw-segmented", size === "sm" && "cw-segmented--sm", className)} role="group" aria-label={label} style={style}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="cw-segment"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Toolbar row ---------- */

interface ToolbarProps {
  /** Controls that read left to right from the gutter. */
  children?: ReactNode;
  /** Controls pinned to the right edge. */
  end?: ReactNode;
  className?: string;
}

/** The 60px row under the header, aligned to the same gutter. */
export function Toolbar({ children, end, className }: ToolbarProps) {
  return (
    <div className={join("cw-toolbar", className)}>
      <div className="cw-toolbar-start">{children}</div>
      {end && <div className="cw-toolbar-end">{end}</div>}
    </div>
  );
}

export function ToolbarDivider() {
  return <span className="cw-toolbar-divider" aria-hidden="true" />;
}

/* ---------- Footer ---------- */

interface FooterProps {
  /** "reading" sits in the reading column; "workspace" spans the gutter. */
  mode?: "reading" | "workspace";
  className?: string;
}

/** "Cornerways — built for family and friends." on the left, "Est. 2026" on the right. */
export function Footer({ mode = "reading", className }: FooterProps) {
  return (
    <footer className={join("cw-footer", mode === "reading" ? "cw-reading" : "cw-workspace", className)}>
      <span>Cornerways &mdash; built for family and friends.</span>
      <span>Est. 2026</span>
    </footer>
  );
}
