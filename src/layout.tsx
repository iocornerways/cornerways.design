import type { HTMLAttributes, ReactNode } from "react";

type Tag = "div" | "main" | "section" | "footer";

interface LayoutProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /** Render as this element instead of a div — main, section, footer. */
  as?: Tag;
}

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Workspace mode: content fills the width and lines up with the header's
 * gutter. Calendar, Todo, Trips and Food.
 */
export function Workspace({ as: Element = "div", flush, className, children, ...rest }: LayoutProps & {
  /** Edge to edge, with no gutter — the Trips map. */
  flush?: boolean;
}) {
  return (
    <Element className={join("cw-workspace", flush && "cw-workspace--flush", className)} {...rest}>
      {children}
    </Element>
  );
}

/**
 * Reading mode: a centred column of the shared reading width under the
 * full-width header. The hub, Weather, Trains and Home.
 */
export function Reading({ as: Element = "div", className, children, ...rest }: LayoutProps) {
  return (
    <Element className={join("cw-reading", className)} {...rest}>
      {children}
    </Element>
  );
}
