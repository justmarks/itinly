"use client";

/**
 * Recovery helpers for the "Supabase session is broken / desynced"
 * failure mode.
 *
 * Failure mode in the wild: a user's `sb-*` localStorage entries hold
 * a JWT that's missing the `sub` claim (or have been wiped while the
 * legacy `itinly-auth` state survived). The app still renders as
 * "signed in" because `useAuth()` reads `itinly-auth`, but every
 * Supabase SDK call fails — `getUser()` / `getUserIdentities()` /
 * `linkIdentity()` all return errors like `"Invalid claim: missing
 * sub claim"` or `"Auth session missing!"` from GoTrue, and the user
 * gets stuck on the account screen with toasts they can't act on.
 *
 * Reported by a user in May 2026 — three error surfaces (banner from
 * `getUserIdentities`, toast from `startConnect`'s `getUser`, and the
 * "no session" branch in `/auth/callback`) were all downstream of the
 * same broken JWT. None of them cleared the broken state, so the user
 * kept re-triggering the same errors.
 *
 * The recovery is: wipe the local Supabase + legacy auth state and
 * bounce the user back to login so they can sign in fresh. Use
 * `isBrokenSupabaseSessionError(err)` at any call site that talks to
 * Supabase, and `recoverFromBrokenSupabaseSession({ router })` to do
 * the wipe + redirect.
 */

import { toast } from "sonner";
import { getSupabaseClient } from "./supabase";
import { CACHE_STORAGE_KEY } from "./query-client";

/**
 * Storage key the legacy AuthState lives under. Kept in sync with
 * `STORAGE_KEY` in `lib/auth.tsx` — we can't import it (the value
 * isn't exported and exporting it would widen the surface of
 * `lib/auth.tsx`), so this is a string copy. Drift here would mean
 * the legacy state survives a recovery and the user re-enters the
 * broken state on next mount.
 */
const LEGACY_AUTH_STORAGE_KEY = "itinly-auth";

const BROKEN_SESSION_PATTERNS = [
  /auth session missing/i,
  /missing.*sub.*claim/i,
  /invalid claim/i,
  /jwt expired/i,
  /jwt.*invalid/i,
];

export function isBrokenSupabaseSessionError(err: unknown): boolean {
  let message = "";
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "string") {
    message = err;
  } else if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    message = (err as { message: string }).message;
  }
  if (!message) return false;
  return BROKEN_SESSION_PATTERNS.some((re) => re.test(message));
}

/**
 * Module-scope re-entry guard so two panels racing the same broken-
 * session detection don't fire two redirects + two toasts. Reset
 * implicitly when the page is torn down by the redirect.
 */
let recoveryInFlight = false;

/**
 * Tears down a corrupted Supabase session and bounces the user back
 * to the login page.
 *
 * - `signOut({ scope: "local" })` clears the `sb-*` localStorage
 *   entries without trying to hit GoTrue (which would fail with the
 *   same broken token). Firing it also dispatches the SIGNED_OUT
 *   event that the `AuthProvider` subscription listens for, which
 *   wipes the in-memory legacy AuthState and the React-Query cache.
 * - The legacy `itinly-auth` key + the React-Query cache key are
 *   also cleared manually as belt-and-braces for the case where
 *   Supabase isn't configured (no signOut runs) or the listener
 *   missed the event for any reason.
 * - `router.replace` keeps the React tree warm so the Sonner toast
 *   that fires just before the navigation actually reaches the
 *   user; falls back to `window.location.assign` when no router was
 *   passed (toast is lost in that branch but the user still lands
 *   on the login page).
 */
export async function recoverFromBrokenSupabaseSession(opts?: {
  router?: { replace: (url: string) => void };
}): Promise<void> {
  if (recoveryInFlight) return;
  recoveryInFlight = true;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // signOut with scope:"local" doesn't hit the network, but the
      // SDK can still throw on malformed local state. We want the
      // redirect to happen either way.
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      window.localStorage.removeItem(CACHE_STORAGE_KEY);
    } catch {
      // Safari private mode etc. — non-fatal.
    }
  }

  toast.error("Sign-in expired", {
    description: "Your sign-in state was stale. Please sign in again.",
  });

  if (typeof window === "undefined") return;
  const target = window.location.pathname.startsWith("/m")
    ? "/m/login"
    : "/login";
  if (opts?.router) {
    opts.router.replace(target);
  } else {
    window.location.assign(target);
  }
}
