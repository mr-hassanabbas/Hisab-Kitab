import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Delete, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LockScreen() {
  const [pin, setPin] = useState("");
  const { unlockSession, logout, user } = useAuth();
  const { toast } = useToast();

  const unlockMutation = useMutation({
    mutationFn: (pinCode: string) => fetchApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ mobile: user?.mobile, pin: pinCode }),
    }),
    onSuccess: (data) => {
      if (data.token) {
        unlockSession();
      } else {
        toast({ title: "Invalid PIN", variant: "destructive" });
        setPin("");
      }
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPin("");
    },
  });

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        unlockMutation.mutate(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter your PIN to unlock</p>
          <div className="text-sm font-medium mt-2">{user?.name}</div>
        </div>

        <div className="flex justify-center gap-4 mb-8 h-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full transition-all",
                i < pin.length ? "bg-primary" : "bg-muted border border-border"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handlePress(num.toString())}
              className="h-16 rounded-2xl bg-card border border-border text-2xl font-medium text-foreground hover:bg-muted/50 transition-colors active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => {
              logout();
            }}
            className="h-16 rounded-2xl flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <span className="text-xs font-medium">LOGOUT</span>
          </button>
          <button
            onClick={() => handlePress("0")}
            className="h-16 rounded-2xl bg-card border border-border text-2xl font-medium text-foreground hover:bg-muted/50 transition-colors active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-16 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
