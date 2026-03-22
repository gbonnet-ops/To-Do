"use client";

import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "#0A0A0B",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div className="text-center">
        <div style={{ fontSize: "24px", fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.3px", marginBottom: "8px" }}>
          DealFlow
        </div>
        <div style={{ fontSize: "13px", color: "#52525B", marginBottom: "32px" }}>
          M&A Task Manager
        </div>

        <button
          onClick={handleLogin}
          className="cursor-pointer flex items-center gap-3 rounded-lg transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#E2E8F0",
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Se connecter avec Google
        </button>

        <div style={{ fontSize: "11px", color: "#27272A", marginTop: "24px", maxWidth: "280px", lineHeight: "1.5" }}>
          Connecte-toi pour synchroniser tes tâches entre tous tes appareils et accéder à Calendar + Gmail.
        </div>
      </div>
    </div>
  );
}
