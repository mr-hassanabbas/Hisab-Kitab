import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { HardHat, Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const MOBILE_KEY = "hk_mobile";

// Shared PIN/mobile number pad layout
const NUMPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // The mobile number is only collected on the recovery step. If a number was
  // persisted on a previous device login, go straight to the PIN-only screen.
  const persistedMobile =
    typeof window !== "undefined" ? window.localStorage.getItem(MOBILE_KEY) : null;

  const [mobile, setMobile] = useState(persistedMobile ?? "");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [step, setStep] = useState<"recover" | "pin">(
    persistedMobile ? "pin" : "recover"
  );

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // ── Recovery: mobile number entry ─────────────────────────────────
  const handleMobileDigit = (d: string) => {
    setMobile((m) => (m.length < 11 ? m + d : m));
  };

  const handleMobileDelete = () => setMobile((m) => m.slice(0, -1));

  const submitMobile = () => {
    const clean = mobile.replace(/[\s-]/g, "");
    if (!/^03\d{9}$/.test(clean)) {
      toast({ title: "Invalid mobile number", description: "Enter format: 03XXXXXXXXX", variant: "destructive" });
      return;
    }
    setStep("pin");
  };

  // Auto-advance once a complete number is entered on the recovery screen
  useEffect(() => {
    if (step === "recover" && mobile.length === 11) submitMobile();
  }, [mobile, step]);

  // ── PIN entry ─────────────────────────────────────────────────────
  const handlePinDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d);
  };

  const handlePinDelete = () => setPin((p) => p.slice(0, -1));

  const handleLogin = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.replace(/[\s-]/g, ""), pin }),
      });
      const data = await res.json();
      if (data.success) {
        // Persist the mobile so subsequent logins on this device are PIN-only
        window.localStorage.setItem(MOBILE_KEY, data.user.mobile);
        login(data.token, data.user);
        setLocation("/dashboard");
      } else if (res.status === 401 && data.error === "User not found") {
        // No account exists for this number -> send user through full setup
        toast({ title: "No account found", description: "Complete setup to create your account", variant: "destructive" });
        setLocation("/setup");
      } else {
        toast({ title: "Login failed", description: data.error || "Invalid credentials", variant: "destructive" });
        setPin("");
      }
    } catch {
      toast({ title: "Connection error", description: "Could not reach server", variant: "destructive" });
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) handleLogin();
  }, [pin]);

  // ── Splash screen ─────────────────────────────────────────────────
  if (!splashDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sidebar">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-xl">
            <HardHat className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-1">Hisab Kitab</h1>
          <p className="text-sidebar-foreground/60 text-base mb-1" style={{ fontFamily: "'Noto Nastaliq Urdu', serif", direction: "rtl" }}>حساب کتاب</p>
          <p className="text-sidebar-foreground/40 text-sm">Construction Site Manager</p>
          <div className="mt-8 w-48 h-1 bg-sidebar-border rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[loadbar_2s_ease-in-out_forwards]" style={{ width: "0%" }} />
          </div>
        </div>
        <style>{`@keyframes loadbar { to { width: 100%; } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg border border-border p-8">
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
            <HardHat className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Hisab Kitab</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Construction Site Manager</p>
        </div>

        {step === "recover" ? (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 text-center">Recover your account</p>
            <p className="text-xs text-muted-foreground text-center mb-4">Enter your mobile number to sign in with your PIN</p>
            <div className="text-center mb-6 min-h-[2.5rem]">
              {mobile.length > 0 ? (
                <span className="text-2xl font-semibold tracking-widest text-foreground">{mobile}</span>
              ) : (
                <span className="text-xl text-muted-foreground tracking-widest">03XXXXXXXXX</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {NUMPAD.map((d, i) =>
                d === "" ? (
                  <div key={i} />
                ) : d === "⌫" ? (
                  <button
                    key={i}
                    data-testid="btn-mobile-delete"
                    onClick={handleMobileDelete}
                    disabled={loading || mobile.length === 0}
                    className="h-14 rounded-xl bg-muted text-foreground text-lg font-medium hover:bg-muted/70 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    key={i}
                    data-testid={`btn-mobile-${d}`}
                    onClick={() => handleMobileDigit(d)}
                    disabled={loading || mobile.length >= 11}
                    className="h-14 rounded-xl bg-muted text-foreground text-xl font-semibold hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-40"
                  >
                    {d}
                  </button>
                )
              )}
            </div>
            <button
              data-testid="btn-recover-continue"
              onClick={submitMobile}
              disabled={loading || mobile.length !== 11}
              className="w-full mt-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              Continue
            </button>
            <p className="text-center text-xs text-muted-foreground mt-4">Enter format: 03XXXXXXXXX</p>
          </div>
        ) : (
          <div>

            <p className="text-sm font-medium text-foreground mb-4 text-center">Enter your 4-digit PIN</p>
            <div className="flex justify-center gap-3 mb-7">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all",
                    pin.length > i ? "border-primary bg-primary" : "border-border bg-background"
                  )}
                >
                  {pin.length > i && <div className="w-3 h-3 rounded-full bg-primary-foreground" />}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {NUMPAD.map((d, i) =>
                d === "" ? (
                  <div key={i} />
                ) : d === "⌫" ? (
                  <button
                    key={i}
                    data-testid="btn-pin-delete"
                    onClick={handlePinDelete}
                    className="h-14 rounded-xl bg-muted text-foreground text-lg font-medium hover:bg-muted/70 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    key={i}
                    data-testid={`btn-pin-${d}`}
                    onClick={() => handlePinDigit(d)}
                    disabled={loading}
                    className="h-14 rounded-xl bg-muted text-foreground text-xl font-semibold hover:bg-primary/10 active:scale-95 transition-all"
                  >
                    {d}
                  </button>
                )
              )}
            </div>
            {loading && <p className="text-center text-xs text-muted-foreground mt-4">Logging in...</p>}
          </div>
        )}
      </div>
    </div>
  );
}
