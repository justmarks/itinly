"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  useConnectionsIncludingRevoked,
  useEmailScanSchedules,
} from "@itinly/api-client";
import { useDemoMode } from "@/lib/demo";
import { isGmailLinkConfigured, startGmailLink } from "@/lib/oauth";
import { toast } from "sonner";
import { describeError } from "@/lib/api-error";

/**
 * Surfaces a prominent in-app alert when an email provider connection
 * was silently revoked upstream (Google's 7-day unverified-app
 * refresh-token expiry, user revoked at google.com/security, etc).
 * The cron-tick executor catches the `invalid_grant` and flips the
 * `connections` row to `status='revoked'`; without this banner the
 * user discovers the breakage only by checking the run history.
 *
 * Visibility gate: only renders when there's at least one scheduled
 * scan for the matching provider — a user with no schedule has no
 * silent failure to alert about. They'll see "Connect Gmail" in
 * settings when they go to scan manually, which is the right surface.
 *
 * After reconnect:
 *   - Gmail: `startGmailLink` redirects to a separate Google OAuth
 *     client (the gmail.readonly one), and the post-callback handler
 *     writes a fresh `connections` row (or flips the revoked row back
 *     to `active` via the upsert composite key). The schedule resumes
 *     on the next cron tick — it looks connections up by
 *     `(userId, provider, capability)`, not by row id, so no schedule
 *     reconfiguration is needed.
 *   - Microsoft: we send the user to the settings page where the
 *     existing `startConnect("azure", "email", …)` flow lives. That
 *     path needs Supabase identity-link state that's intricate to
 *     replicate inside the banner; one extra click is the tradeoff.
 */
export function ConnectionRevokedBanner({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}): React.JSX.Element | null {
  const isDemo = useDemoMode();
  const { data: connectionsData } = useConnectionsIncludingRevoked(!isDemo);
  const { data: schedules } = useEmailScanSchedules({ enabled: !isDemo });

  if (isDemo) return null;
  if (!connectionsData || !schedules) return null;

  // A schedule's provider is "google" | "microsoft"; the connection
  // store uses the same provider keys. Filter to "revoked AND backs
  // an active email-capability schedule" so we don't nag users about
  // a revoked calendar connection they may not care about.
  const scheduledProviders = new Set(
    schedules.filter((s) => s.enabled).map((s) => s.provider),
  );
  const revoked = connectionsData.connections.filter((c) => {
    if (c.status !== "revoked") return false;
    if (c.capability !== "email") return false;
    if (!scheduledProviders.has(c.provider)) return false;
    // Don't nag when the user has already reconnected — possibly with
    // a different email, which leaves the original revoked row in
    // place but creates a NEW active row that the schedule will pick
    // up on its next tick. The presence of an active sibling row for
    // the same (provider, capability) means the reconnect happened.
    const hasActiveSibling = connectionsData.connections.some(
      (other) =>
        other.id !== c.id &&
        other.status === "active" &&
        other.provider === c.provider &&
        other.capability === c.capability,
    );
    return !hasActiveSibling;
  });
  if (revoked.length === 0) return null;

  return (
    <div
      className={
        variant === "mobile"
          ? "mx-3 mt-2 space-y-2"
          : "mx-auto mt-4 max-w-3xl space-y-2"
      }
    >
      {revoked.map((c) => (
        <ConnectionRevokedRow
          key={c.id}
          provider={c.provider}
          accountEmail={c.accountEmail}
          variant={variant}
        />
      ))}
    </div>
  );
}

function ConnectionRevokedRow({
  provider,
  accountEmail,
  variant,
}: {
  provider: "google" | "microsoft";
  accountEmail: string;
  variant: "desktop" | "mobile";
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const label = provider === "google" ? "Gmail" : "Outlook";

  const onReconnect = () => {
    setBusy(true);
    try {
      if (provider === "google") {
        if (!isGmailLinkConfigured()) {
          toast.error("Gmail reconnect is not configured", {
            description:
              "The Gmail OAuth client isn't set on this build. Contact the site owner.",
          });
          setBusy(false);
          return;
        }
        // window.location redirects — no need to clear `busy`, the
        // page is about to unload.
        const returnTo =
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/m")
            ? "/m/settings/account"
            : "/settings/account";
        startGmailLink(returnTo);
        return;
      }
      // Microsoft path lives in settings/account where the
      // Supabase linkIdentity / signInWithOAuth branching already
      // exists; navigate the user there to finish.
      const settingsPath =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/m")
          ? "/m/settings/account"
          : "/settings/account";
      window.location.href = settingsPath;
    } catch (err) {
      setBusy(false);
      toast.error("Couldn't start reconnect", {
        description: describeError(err),
      });
    }
  };

  return (
    <div
      role="alert"
      className={
        variant === "mobile"
          ? "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          : "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
      }
      style={{
        backgroundColor: "var(--status-warn-bg)",
        color: "var(--status-warn-fg)",
        borderColor: "var(--status-warn-rail)",
      }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {label} reconnect required
        </p>
        <p className="opacity-90">
          Your scheduled scan stopped working because{" "}
          {accountEmail ? (
            <>
              <span className="font-mono">{accountEmail}</span>{" "}
            </>
          ) : (
            <>{label} </>
          )}
          revoked its access. Reconnect to resume — your schedule will
          pick up automatically.
        </p>
      </div>
      <button
        type="button"
        onClick={onReconnect}
        disabled={busy}
        className="shrink-0 rounded-full border border-current px-3 py-1 text-xs font-medium hover:bg-current/10 disabled:opacity-60"
      >
        {busy && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
        Reconnect {label}
      </button>
    </div>
  );
}
