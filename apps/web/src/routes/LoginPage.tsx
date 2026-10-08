import { useState, useEffect } from "react";
import { useAuthStore } from "../auth/auth-store";
import saasLogo from "../assets/jiora-saas-logo-md.png";
import logoFull from "../assets/Logo_full.png";
import {
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Banknote,
  Sparkles,
  CheckCircle2,
  Lock,
  Clock,
  Fingerprint,
} from "lucide-react";

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const [mounted, setMounted] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  // Invitation emails link to /login?email=<invited address>.
  const invitedEmail = new URLSearchParams(window.location.search).get("email")?.trim() || "";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const handleSignIn = async (prompt: "select_account" | "login" | "create" = "select_account") => {
    try {
      setIsSigningIn(true);
      await signIn(prompt, invitedEmail || undefined);
    } catch {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#050811] text-zinc-100 selection:bg-blue-600/30 selection:text-blue-200">
      {/* ── Dynamic Ambient Background ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Royal Blue radial aura */}
        <div
          className="absolute -top-[15%] -left-[10%] h-[750px] w-[750px] rounded-full opacity-[0.18] blur-[130px]"
          style={{
            background: "radial-gradient(circle, #2563eb 0%, #1e40af 50%, transparent 80%)",
          }}
        />
        {/* Warm Golden/Amber radial aura mirroring the Jiora brand gold */}
        <div
          className="absolute -bottom-[20%] -right-[5%] h-[700px] w-[700px] rounded-full opacity-[0.14] blur-[140px]"
          style={{
            background: "radial-gradient(circle, #f59e0b 0%, #d97706 45%, transparent 75%)",
          }}
        />
        {/* Center ambient spotlight */}
        <div
          className="absolute left-1/2 top-1/2 h-[550px] w-[850px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08] blur-[110px]"
          style={{
            background: "radial-gradient(ellipse, #3b82f6 0%, #f59e0b 40%, transparent 75%)",
          }}
        />

        {/* Fine Architectural Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Cinematic Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 35%, rgba(5,8,17,0.88) 100%)",
          }}
        />
      </div>

      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }
        .anim-float {
          animation: floatSlow 6s ease-in-out infinite;
        }
        .anim-float-delayed {
          animation: floatSlow 7s ease-in-out infinite 1.5s;
        }
        .btn-shine-sweep {
          position: relative;
          overflow: hidden;
        }
        .btn-shine-sweep::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            60deg,
            transparent 30%,
            rgba(255, 255, 255, 0.18) 50%,
            transparent 70%
          );
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }
        .btn-shine-sweep:hover::after {
          transform: translateX(100%);
        }
      `}</style>

      {/* ── Main Responsive Container ── */}
      <div
        className={`relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-center p-4 sm:p-6 lg:flex-row lg:items-center lg:gap-14 xl:gap-20 min-h-screen py-8 sm:py-12 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {/* ── Left Column: Enterprise Value Proposition & Official Brand Showcase ── */}
        <div className="hidden flex-1 flex-col justify-center space-y-7 lg:flex max-w-xl">
          {/* Official Full Horizontal Logo in crisp frosted container */}
          <div className="flex flex-wrap items-center gap-3.5 self-start">
            <div className="inline-flex items-center rounded-2xl bg-white px-5 py-2.5 shadow-2xl backdrop-blur-xl border border-white/50 transition-all duration-300 hover:scale-[1.02]">
              <img
                src={logoFull}
                alt="Jiora Technologies"
                className="h-11 sm:h-13 w-auto object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-amber-300">
                SaaS ERP v3.0
              </span>
              <span className="text-amber-500/40">·</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200/90">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Enterprise
              </span>
            </div>
          </div>

          {/* Hero Headline with Blue & Gold accents */}
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl leading-[1.14]">
              The intelligent OS for your{" "}
              <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-amber-300 bg-clip-text text-transparent">
                workforce & operations.
              </span>
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed max-w-lg">
              Empowering organizations with automated tax-compliant payroll, geofenced workforce attendance, intelligent HRMS, and multi-tenant isolation.
            </p>
          </div>

          {/* Feature Showcase Glass Cards */}
          <div className="space-y-3 pt-1">
            {/* Card 1: Geofenced Attendance */}
            <div className="anim-float rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Geofenced Attendance</h3>
                    <p className="text-xs text-zinc-400">Smart QR & GPS check-in verification</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </div>
              </div>
            </div>

            {/* Card 2: Automated Multi-Tier Payroll */}
            <div className="anim-float-delayed rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-amber-500/30 hover:bg-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Automated Payroll Suite</h3>
                    <p className="text-xs text-zinc-400">100% Statutory Compliance (TDS / PF / ESI)</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-200/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  Instant Slips
                </span>
              </div>
            </div>

            {/* Card 3: Zero-Trust Security */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-emerald-500/30 hover:bg-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Enterprise-grade security</h3>
                    <p className="text-xs text-zinc-400">Passkey and multi-factor sign-in supported</p>
                  </div>
                </div>
                <div className="text-[11px] font-medium text-emerald-400/90 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  SOC2 Ready
                </div>
              </div>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="flex items-center gap-6 pt-1 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400/80" />
              <span>Multi-Tenant Isolation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-amber-400/80" />
              <span>99.99% Cloud SLA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400/80" />
              <span>End-to-End Encryption</span>
            </div>
          </div>
        </div>

        {/* ── Right Column: HeroUI Glassmorphic Authentication Card ── */}
        <div className="w-full max-w-[440px] shrink-0">
          {/* Mobile Top Brand Showcase */}
          <div className="mb-6 flex flex-col items-center justify-center space-y-2.5 lg:hidden">
            <div className="inline-flex items-center rounded-2xl bg-white px-5 py-2.5 shadow-xl backdrop-blur-xl border border-white/50">
              <img
                src={logoFull}
                alt="Jiora Technologies"
                className="h-10 sm:h-11 w-auto object-contain"
              />
            </div>
            <span className="text-xs font-semibold text-amber-400/90 tracking-wide uppercase">
              Enterprise Cloud ERP v3.0
            </span>
          </div>

          {/* Ambient Card Backlight (Blue + Gold brand glow) */}
          <div className="relative">
            <div
              className="absolute -inset-2 rounded-[32px] opacity-45 blur-2xl transition-all duration-500"
              style={{
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.35) 0%, rgba(245,158,11,0.25) 50%, rgba(56,189,248,0.25) 100%)",
              }}
            />

            {/* The Glassmorphism Container */}
            <div
              className="relative overflow-hidden rounded-[28px] border border-white/[0.1] bg-zinc-950/80 p-7 sm:p-9 shadow-2xl backdrop-blur-2xl"
              style={{
                boxShadow:
                  "0 30px 70px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)",
              }}
            >
              {/* Top Accent Gradient Border (Royal Blue into Amber Gold) */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-amber-400 to-sky-400" />

              {/* Special Transparent Jiora SaaS Logo with Cloud & Orbital Arrow */}
              <div className="mb-5 flex justify-center">
                <div className="relative group">
                  {/* Subtle brand glow behind transparent SaaS logo */}
                  <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-blue-500/40 via-sky-400/30 to-amber-500/35 opacity-60 blur-xl transition-all duration-300 group-hover:opacity-90 group-hover:scale-105" />

                  {/* Logo Frame: transparent floating container */}
                  <div className="relative flex items-center justify-center px-3 py-1">
                    <img
                      src={saasLogo}
                      alt="Jiora SaaS ERP"
                      className="h-28 sm:h-32 w-auto object-contain filter drop-shadow-[0_12px_24px_rgba(37,99,235,0.35)] transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </div>
              </div>

              {/* Workspace Welcome & Subtitle */}
              <div className="mb-7 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-amber-400/90 mb-1">
                  Jiora Technologies
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  SaaS ERP Workspace
                </h2>
                <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                  Sign in to authenticate with your enterprise organization account.
                </p>
              </div>

              {invitedEmail && (
                <div className="mb-4 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3.5 py-2.5 text-xs text-blue-100">
                  You were invited as <b className="text-white">{invitedEmail}</b>. Sign in with this exact email address to join your workspace.
                </div>
              )}

              {/* Enterprise Auth Options */}
              <div className="space-y-3.5">
                {/* Primary SSO CTA */}
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => handleSignIn("select_account")}
                  className="btn-shine-sweep group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-blue-500/35 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
                >
                  <KeyRound className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:rotate-12" />
                  <span>{isSigningIn ? "Connecting..." : "Sign in securely"}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
                </button>

                {invitedEmail && (
                  <button
                    type="button"
                    disabled={isSigningIn}
                    onClick={() => handleSignIn("create")}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-xs font-semibold text-blue-100 transition-all hover:bg-blue-500/20 cursor-pointer"
                  >
                    <span>First time here? Create your account</span>
                  </button>
                )}

                {/* Secondary Option: Switch / Different Account */}
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => handleSignIn("login")}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-zinc-300 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white active:scale-[0.99] cursor-pointer"
                >
                  <Fingerprint className="h-3.5 w-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
                  <span>Use a different account or credentials</span>
                </button>
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Zero Trust Access
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              {/* Security & Compliance Footer Strip */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.02] border border-white/[0.05] py-2 px-3 text-[11px] text-zinc-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Protected sign-in · Passkey & MFA ready
                  </span>
                </div>

                <p className="text-center text-[11px] text-zinc-500">
                  Credentials and biometrics are never stored on this instance.
                </p>
              </div>
            </div>
          </div>

          {/* Sub-Card Organization Footer */}
          <div className="mt-5 flex flex-col items-center justify-center space-y-1 text-center text-xs text-zinc-500">
            <p>
              © 2026 Jiora Technologies Pvt. Ltd. · Enterprise Suite v3.0
            </p>
            <div className="flex items-center gap-3 text-[11px] text-zinc-600">
              <span>Privacy Policy</span>
              <span>·</span>
              <span>Terms of Service</span>
              <span>·</span>
              <span>Security Center</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
