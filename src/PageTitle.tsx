import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./controls.tsx";
import { ICON_STROKE } from "./icons.tsx";

export interface PageTitleProps {
  title: string;
  /** A back arrow before the title, for a page reached from another. */
  onBack?: () => void;
  backLabel?: string;
  /** Anything that sits beside the title — a link back to a trip, say. */
  children?: ReactNode;
}

/**
 * A sub-page's heading. The shared header carries the app's name, so a page
 * says its own name here, in the content.
 */
export function PageTitle({ title, onBack, backLabel = "Back", children }: PageTitleProps) {
  return (
    <div className="cw-page-title">
      {onBack && (
        <IconButton label={backLabel} onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={ICON_STROKE} />
        </IconButton>
      )}
      <h1 className="cw-page-title-text">{title}</h1>
      {children}
    </div>
  );
}
