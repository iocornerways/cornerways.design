import { useEffect, useRef, useState, type FormEvent } from "react";
import { hubUrl, type AppKey } from "./apps.ts";
import { Button, Segmented } from "./controls.tsx";
import { recentErrors } from "./feedback.ts";
import { Sheet } from "./Sheet.tsx";

type Kind = "bug" | "idea";

const KINDS: readonly { value: Kind; label: string }[] = [
  { value: "bug", label: "Something's wrong" },
  { value: "idea", label: "An idea" },
];

const MAX_TITLE = 120;
const MAX_BODY = 4000;

export interface FeedbackDialogProps {
  /** Which app it's sent from; null for the hub. */
  app: AppKey | null;
  /** The current hostname, to find the hub (dev, test or production). */
  hostname: string;
  onClose: () => void;
}

type State = { step: "editing"; error: string | null } | { step: "sending" } | { step: "sent" };

/**
 * "Send feedback" from the account menu: a bug or an idea, with the page,
 * the device and the page's recent errors sent along, to the hub's
 * POST /api/feedback (with the shared cookie) for Mission Control's inbox.
 * A Sheet (a native modal <dialog>), so focus, Escape and the backdrop come free.
 */
export function FeedbackDialog({ app, hostname, onClose }: FeedbackDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<State>({ step: "editing", error: null });
  // Read once, when the dialog opens: what was on the page before it.
  const [errors] = useState(recentErrors);
  const viewport = typeof window === "undefined" ? "" : `${window.innerWidth}x${window.innerHeight}`;

  useEffect(() => {
    // The Sheet's showModal focuses the first control (the kind toggle); start at the title instead.
    titleRef.current?.focus();
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setState({ step: "editing", error: "Give it a short title" });
      return;
    }
    setState({ step: "sending" });
    try {
      const response = await fetch(`${hubUrl(hostname)}/api/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          app: app ?? "hub",
          kind,
          title,
          body,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          viewport,
          errors,
        }),
      });
      if (response.ok) {
        setState({ step: "sent" });
        return;
      }
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setState({ step: "editing", error: data?.error ?? "That didn't send. Try again in a moment." });
    } catch {
      setState({ step: "editing", error: "That didn't send. Check your connection and try again." });
    }
  }

  const sending = state.step === "sending";

  return (
    <Sheet ref={ref} labelledBy="cw-feedback-title" onClose={onClose}>
      {state.step === "sent" ? (
        <div className="cw-dialog-body">
          <h2 className="cw-dialog-title" id="cw-feedback-title">
            Thanks, that's sent
          </h2>
          <p className="cw-dialog-text">We read every one. If it needs a fix, it'll show up in a future update.</p>
          <div className="cw-dialog-actions">
            <Button variant="primary" onClick={() => ref.current?.close()} autoFocus>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form className="cw-dialog-body" onSubmit={send}>
          <h2 className="cw-dialog-title" id="cw-feedback-title">
            Send feedback
          </h2>
          <Segmented options={KINDS} value={kind} onChange={setKind} label="What kind of feedback" className="cw-dialog-kind" />
          <label className="cw-field">
            <span className="cw-field-label">{kind === "bug" ? "What went wrong?" : "What's the idea?"}</span>
            <input
              ref={titleRef}
              className="cw-input"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "bug" ? "e.g. The recipe won't save" : "e.g. Let me share a list with a friend"}
              required
            />
          </label>
          <label className="cw-field">
            <span className="cw-field-label">More detail (optional)</span>
            <textarea
              className="cw-input cw-textarea"
              value={body}
              maxLength={MAX_BODY}
              rows={5}
              onChange={(event) => setBody(event.target.value)}
              placeholder={kind === "bug" ? "What were you doing, and what did you expect?" : "What would it help with?"}
            />
          </label>
          <details className="cw-dialog-details">
            <summary>Also sent: this page, your device{errors.length ? `, ${errors.length} recent error${errors.length === 1 ? "" : "s"}` : ""}</summary>
            <dl>
              <dt>Page</dt>
              <dd>{typeof window === "undefined" ? "" : window.location.href}</dd>
              <dt>Device</dt>
              <dd>
                {viewport} · {typeof navigator === "undefined" ? "" : navigator.userAgent}
              </dd>
              {errors.length > 0 && (
                <>
                  <dt>Recent errors</dt>
                  <dd>
                    <ul>
                      {errors.map((entry, index) => (
                        <li key={index}>{entry.message.split("\n")[0]}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
            </dl>
          </details>
          {state.step === "editing" && state.error && (
            <p className="cw-dialog-error" role="alert">
              {state.error}
            </p>
          )}
          <div className="cw-dialog-actions">
            <Button variant="ghost" onClick={() => ref.current?.close()} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
