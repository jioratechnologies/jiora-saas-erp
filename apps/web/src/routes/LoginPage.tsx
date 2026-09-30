import { useState, useEffect } from "react";
import { useAuthStore } from "../auth/auth-store";
import { ArrowRight, Shield } from "lucide-react";

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080c14]">
      {/* ── Background: subtle radial glow only ── */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        {/* Single centred glow */}
        <div
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.18]"
          style={{
            background:
              "radial-gradient(circle, #2563eb 0%, #1e3a8a 40%, transparent 70%)",
          }}
        />
        {/* Fine grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, #080c14 100%)",
          }}
        />
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow-pulse {
          0%,100% { box-shadow: 0 0 32px 0 rgba(37,99,235,.35), 0 0 0 1px rgba(37,99,235,.25); }
          50%      { box-shadow: 0 0 48px 8px rgba(37,99,235,.5),  0 0 0 1px rgba(37,99,235,.4);  }
        }
        .fade-1 { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both .08s; }
        .fade-2 { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both .18s; }
        .fade-3 { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both .28s; }
        .fade-4 { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both .38s; }
        .logo-glow { animation: glow-pulse 3s ease-in-out infinite; }
        .btn-shine::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.12) 50%, transparent 65%);
          transform: translateX(-100%);
          transition: transform .5s ease;
        }
        .btn-shine:hover::after { transform: translateX(100%); }
      `}</style>

      {/* ── Card ── */}
      <div
        className={`relative z-10 w-full max-w-[400px] px-5 ${
          mounted ? "" : "opacity-0"
        }`}
      >
        {/* Glass card */}
        <div
          className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl"
          style={{
            boxShadow:
              "0 32px 64px -12px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)",
          }}
        >
          {/* Top shimmer line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Logo */}
          <div className={`mb-8 flex justify-center fade-1`}>
            <div className="relative">
              <div className="logo-glow flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700">
                <span className="select-none text-[26px] font-black tracking-tight text-white">
                  J
                </span>
              </div>
            </div>
          </div>

          {/* Brand name + tagline */}
          <div className={`mb-8 text-center fade-2`}>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/30 mb-2">
              Jiora Technologies
            </p>
            <h1 className="text-[22px] font-black tracking-tight text-white leading-tight">
              SaaS ERP
            </h1>
            <p className="mt-2 text-sm text-white/40 font-medium">
              Sign in to your workspace
            </p>
          </div>

          {/* Divider */}
          <div className={`mb-6 flex items-center gap-3 fade-3`}>
            <div className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
              Secure access
            </span>
            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>

          {/* Primary CTA */}
          <div className={`space-y-3 fade-3`}>
            <button
              onClick={() => signIn("select_account")}
              className="btn-shine group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:from-blue-400 hover:to-blue-600 hover:shadow-blue-500/30 hover:shadow-2xl hover:scale-[1.015] active:scale-[0.985] cursor-pointer"
            >
              <span className="relative flex items-center justify-center gap-2.5">
                <svg
                  className="h-[18px] w-[18px] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                Sign in with Zitadel
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              onClick={() => signIn("login")}
              className="w-full rounded-2xl border border-white/[0.08] bg-transparent px-5 py-3 text-sm font-medium text-white/40 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05] hover:text-white/70 active:scale-[0.985] cursor-pointer"
            >
              Use a different account
            </button>
          </div>

          {/* Security badge */}
          <div className={`mt-7 fade-4`}>
            <div className="flex items-center justify-center gap-2 text-[11px] text-white/20">
              <Shield className="h-3.5 w-3.5 text-emerald-500/60" />
              <span>
                Protected by Zitadel OIDC · Credentials never stored here
              </span>
            </div>
          </div>
        </div>

        {/* Below card */}
        <p className={`mt-5 text-center text-[11px] text-white/15 fade-4`}>
          © 2026 Jiora Technologies · v3.0
        </p>
      </div>
    </div>
  );
}
