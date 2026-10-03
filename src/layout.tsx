import type { HTMLAttributes, ReactNode } from "react";

interface LayoutProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /** Render as this element instead of a div — main, section, footer. */
  as?: "div" | "main" | "section" | "footer";
}

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Workspace mode: content fills the width and lines up with the header's
 * gutter. Calendar, Todo, Trips and Food.
 */
export function Workspace({ as: Tag = "div", className, children, ...rest }: LayoutProps & { flush?: boolean }) {
  const { flush, ...attrs } = rest as LayoutProps & { flush?: boolean };
  return (
    <Tag className={join("cw-workspace", flush && "cw-workspace--flush", className)} {...attrs}>
      {children}
    </Tag>
  );
}

/**
 * Reading mode: a centred column of the shared reading width under the
 * full-width header. The hub, Weather, Trains and Home.
 */
export function Reading({ as: Tag = "div", className, children, ...rest }: LayoutProps) {
  return (
    <Tag className={join("cw-reading", className)} {...rest}>
      {children}
    </Tag>
  );
}
