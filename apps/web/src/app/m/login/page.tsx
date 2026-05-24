"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { useDemoMode } from "@/lib/demo";
import { MobileFrame } from "@/components/mobile/mobile-shell";
import { AppWordmark } from "@/components/app-wordmark";
import {
  GoogleGLogo,
  MicrosoftSquaresLogo,
} from "@/components/provider-logos";
import { AlertCircle, Info, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

// See `app/login/page.tsx` for the rationale — when the bundle was
// built without `NEXT_PUBLIC_API_URL` and the browser is on a non-
// localhost origin, the health probe is doomed to ERR_CONNECTION_REFUSED
// and the generic "no API server" copy hides the real cause.
function isBuildTimeApiMisconfig(): boolean {
  if (typeof window === "undefined") return false;
  if (!/^https?:\/\/localhost(?::\d+)?(?:\/|$)/.test(API_BASE_URL)) return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

export default function MobileLoginPage(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const isDemo = useDemoMode();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [buildMisconfig, setBuildMisconfig] = useState(false);

  useEffect(() => {
    if (isBuildTimeApiMisconfig()) {
      setBuildMisconfig(true);
      setApiAvailable(false);
      return;
    }
    const controller = new AbortController();
    fetch(`${API_BASE_URL.replace(/\/api\/v1$/, "")}/health`, {
      signal: controller.signal,
    })
      .then((res) => setApiAvailable(res.ok))
      .catch(() => setApiAvailable(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/m");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <MobileFrame>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <div className="flex flex-1 flex-col px-6 pb-10 pt-6">
        {/* mt-auto on the wordmark + mt-auto on the bottom desktop link
            split the leftover space evenly, vertically centering the
            wordmark/buttons block while keeping the desktop-site link
            anchored at the bottom. */}
        <div className="mt-auto flex flex-col items-center text-center">
          {/* tabIndex=-1 so the first Tab lands on the primary CTA
              (Sign in with Google) instead of the brand wordmark. Mouse
              users can still tap it to reach /welcome. */}
          <Link href="/welcome" aria-label="itinly home" tabIndex={-1}>
            <AppWordmark className="h-16" />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Your trips, in your pocket.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-3">
          {loginError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-left text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}
          {apiAvailable === false && !loginError && !isDemo && (
            <div className="flex items-start gap-3 rounded-xl border bg-muted/50 p-3 text-left text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {buildMisconfig
                  ? "This deployment is misconfigured: the build didn't receive NEXT_PUBLIC_API_URL, so the bundle points at http://localhost. Try demo mode below, or ask the site owner to fix it."
                  : "No API server detected. Sign-in needs a backend — try demo mode below."}
              </span>
            </div>
          )}

          {/*
            Both buttons follow the official Google / Microsoft sign-in
            branding spec (white surface + correct accent border + the
            unmodified 4-color brand mark + the prescribed label
            string). Pill shape is retained from the previous mobile
            look — Google's spec allows fully-rounded containers as
            long as the rest of the mark stays compliant.
          */}
          <button
            type="button"
            disabled={apiAvailable === false}
            onClick={async () => {
              setLoginError(null);
              try {
                const supabase = getSupabaseClient();
                if (!supabase) {
                  setLoginError("Sign-in is not configured.");
                  return;
                }
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    // Identity-only at sign-in. Capability scopes
                    // (Calendar / Gmail) granted on-demand via
                    // /settings/account Connect buttons.
                  },
                });
                if (error) throw error;
              } catch (err) {
                setLoginError(
                  err instanceof Error ? err.message : "Sign-in is not configured.",
                );
              }
            }}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white text-base font-medium text-[#1f1f1f] transition-opacity",
              "active:opacity-90 disabled:opacity-40",
              "dark:border-[#8e918f] dark:bg-[#131314] dark:text-white",
            )}
          >
            <GoogleGLogo className="h-5 w-5" />
            Sign in with Google
          </button>

          <button
            type="button"
            disabled={apiAvailable === false}
            onClick={async () => {
              setLoginError(null);
              try {
                const supabase = getSupabaseClient();
                if (!supabase) {
                  setLoginError("Sign-in is not configured.");
                  return;
                }
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "azure",
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    // Identity-only at sign-in. Capability scopes
                    // (Mail.Read / Calendars.ReadWrite) granted on-
                    // demand via /settings/account Connect buttons.
                    scopes: "openid email profile offline_access User.Read",
                  },
                });
                if (error) throw error;
              } catch (err) {
                setLoginError(
                  err instanceof Error
                    ? err.message
                    : "Sign-in is not configured.",
                );
              }
            }}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#8c8c8c] bg-white text-base font-medium text-[#5e5e5e] transition-opacity",
              "active:opacity-90 disabled:opacity-40",
              "dark:border-[#8e918f] dark:bg-[#2f2f2f] dark:text-white",
            )}
          >
            <MicrosoftSquaresLogo className="h-5 w-5" />
            Sign in with Microsoft
          </button>

          {/*
            Hard <a> with relative href so the destination mounts fresh with
            ?demo=true in the URL — same pattern as the desktop login.
          */}
          <a
            href="../m/?demo=true"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border bg-background text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
            Try the demo
          </a>
          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to our{" "}
            <Link
              href="/terms"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="mt-auto pt-12 text-center">
          <a
            href="../?desktop=1"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Use desktop site instead
          </a>
        </div>
      </div>
    </MobileFrame>
  );
}
