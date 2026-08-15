import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { HardHat, Delete } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Setup() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", mobile: "", pin: "", confirmPin: "", language: "en", theme: "system" });
  const [pinEntry, setPinEntry] = useState("");
  const [confirmEntry, setConfirmEntry] = useState("");
  const [pinStage, setPinStage] = useState<"first" | "confirm">("first");
  const [loading, setLoading] = useState(false);

  const handlePinDigit = (d: string) => {
    if (pinStage === "first" && pinEntry.length < 4) {
      const next = pinEntry + d;
      setPinEntry(next);
      if (next.length === 4) { setForm((f) => ({ ...f, pin: next })); setPinStage("confirm"); }
    } else if (pinStage === "confirm" && confirmEntry.length < 4) {
      const next = confirmEntry + d;
      setConfirmEntry(next);
      if (next.length === 4) setForm((f) => ({ ...f, confirmPin: next }));
    }
  };

  const handlePinDelete = () => {
    if (pinStage === "confirm" && confirmEntry.length > 0) setConfirmEntry((p) => p.slice(0, -1));
    else if (pinStage === "first" && pinEntry.length > 0) setPinEntry((p) => p.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (form.pin !== form.confirmPin) {
      toast({ title: "PINs do not match", variant: "destructive" });
      setPinEntry(""); setConfirmEntry(""); setForm((f) => ({ ...f, pin: "", confirmPin: "" }));
      setPinStage("first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        setLocation("/dashboard");
      } else {
        toast({ title: "Setup failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg border border-border p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Welcome to Hisab Kitab</h1>
          <p className="text-muted-foreground text-sm mt-1">Set up your account to get started</p>
        </div>

        <div className="flex gap-1 mb-6">
          {[1,2,3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Your Name</label>
              <input
                data-testid="input-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Muhammad Arshad"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Mobile Number</label>
              <input
                data-testid="input-mobile"
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                placeholder="03001234567"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              data-testid="btn-next-step1"
              onClick={() => {
                if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
                const clean = form.mobile.replace(/[\s-]/g, "");
                if (!/^03\d{9}$/.test(clean)) { toast({ title: "Invalid mobile", description: "Format: 03XXXXXXXXX", variant: "destructive" }); return; }
                setStep(2);
              }}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 text-center">
              {pinStage === "first" ? "Set your 4-digit PIN" : "Confirm your PIN"}
            </p>
            <p className="text-xs text-muted-foreground text-center mb-4">
              {pinStage === "first" ? "You'll use this to login" : "Enter the same PIN again"}
            </p>
            <div className="flex justify-center gap-3 mb-7">
              {[0,1,2,3].map((i) => {
                const current = pinStage === "first" ? pinEntry : confirmEntry;
                return (
                  <div key={i} className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${current.length > i ? "border-primary bg-primary" : "border-border bg-background"}`}>
                    {current.length > i && <div className="w-3 h-3 rounded-full bg-primary-foreground" />}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                d === "" ? <div key={i} /> :
                d === "⌫" ? (
                  <button key={i} onClick={handlePinDelete} className="h-14 rounded-xl bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 active:scale-95 transition-all">
                    <Delete className="w-5 h-5" />
                  </button>
                ) : (
                  <button key={i} onClick={() => handlePinDigit(d)} className="h-14 rounded-xl bg-muted text-foreground text-xl font-semibold hover:bg-primary/10 active:scale-95 transition-all">
                    {d}
                  </button>
                )
              ))}
            </div>
            {form.confirmPin && (
              <button onClick={() => setStep(3)} className="w-full mt-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors">
                Continue
              </button>
            )}
            <button onClick={() => setStep(1)} className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Language</label>
              <div className="grid grid-cols-2 gap-2">
                {(["en", "ur"] as const).map((l) => (
                  <button
                    key={l}
                    data-testid={`btn-lang-${l}`}
                    onClick={() => setForm((f) => ({ ...f, language: l }))}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${form.language === l ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}
                  >
                    {l === "en" ? "English" : "اردو"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {(["light", "dark", "system"] as const).map((th) => (
                  <button
                    key={th}
                    data-testid={`btn-theme-${th}`}
                    onClick={() => setForm((f) => ({ ...f, theme: th }))}
                    className={`py-2.5 rounded-lg border text-xs font-medium transition-colors capitalize ${form.theme === th ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}
                  >
                    {th}
                  </button>
                ))}
              </div>
            </div>
            <button
              data-testid="btn-finish-setup"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Setting up..." : "Complete Setup"}
            </button>
            <button onClick={() => setStep(2)} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
