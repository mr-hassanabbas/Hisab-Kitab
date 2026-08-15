import { useEffect, useRef } from "react";
import { Phone, PhoneOff, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { fetchApi } from "@/lib/api";

export interface Reminder {
  id: number;
  message: string;
  whatsappUrl: string;
  type: string;
  createdAt: string;
  opened: boolean;
}

interface ReminderCallProps {
  reminder: Reminder;
  onDismiss: () => void;
  onAnswer: () => void;
}

const ANSWER_TARGETS: Record<string, string> = {
  morning_attendance: "/attendance",
  weekly_payment: "/weekly-payment",
  evening_checklist: "/",
  backup: "/settings",
};

export function ReminderCall({ reminder, onDismiss, onAnswer }: ReminderCallProps) {
  const [_, navigate] = useLocation();
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const vibrateRef = useRef<number | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const markOpened = async () => {
    try {
      await fetchApi(`/reminders/${reminder.id}/opened`, { method: "PUT" });
    } catch {
      // ignore — polling will pick it up again or it expires
    }
  };

  // Ringtone: 880Hz beeps via Web Audio
  useEffect(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioRef.current = ctx;
      const beep = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      };
      beep();
      timerRef.current = window.setInterval(beep, 800);
    } catch {
      // Audio unavailable — ring silently
    }

    // Vibration pattern
    try {
      if ("vibrate" in navigator) {
        vibrateRef.current = window.setInterval(() => navigator.vibrate([500, 300, 500, 300, 500]), 2000);
      }
    } catch {
      // Vibration unavailable
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (vibrateRef.current) window.clearInterval(vibrateRef.current);
      if (audioRef.current) void audioRef.current.close();
      if (speechRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  const speakUrdu = (text: string) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ur-PK";
      utterance.rate = 0.9;
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      // TTS unavailable
    }
  };

  useEffect(() => {
    speakUrdu("السلام علیکم، حساب کتاب کا یاد دہانی آ گیا ہے");
  }, []);

  const handleAnswer = () => {
    markOpened();
    onAnswer();
    const target = ANSWER_TARGETS[reminder.type] ?? "/";
    navigate(target);
  };

  const handleDecline = () => {
    markOpened();
    onDismiss();
  };

  const openWhatsApp = () => {
    window.open(reminder.whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-between py-16 px-6" dir="ltr">
      {/* Pulsing avatar rings */}
      <div className="relative mt-10 flex items-center justify-center">
        <div className="absolute w-44 h-44 rounded-full bg-orange-500/20 animate-ping" />
        <div className="absolute w-36 h-36 rounded-full bg-orange-500/30 animate-pulse" />
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/40">
          <span className="text-6xl">📱</span>
        </div>
      </div>

      {/* Caller info */}
      <div className="text-center text-white space-y-3 mt-12">
        <p className="text-4xl font-bold tracking-wide">Hisab Kitab</p>
        <p className="text-xl text-orange-300 font-medium">📌 یاد دہانی</p>
        <p className="text-orange-200/90 text-lg max-w-sm leading-relaxed whitespace-pre-line">{reminder.message}</p>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-4 pb-6">
        <Button
          onClick={openWhatsApp}
          className="w-full h-12 bg-[#25D366] hover:bg-[#1fb958] text-white font-semibold text-base gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          WhatsApp
        </Button>

        <div className="flex gap-4">
          <Button
            onClick={handleDecline}
            className="flex-1 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex flex-col items-center justify-center gap-1"
          >
            <PhoneOff className="h-6 w-6" />
            <span className="text-xs font-medium">رد کریں</span>
          </Button>
          <Button
            onClick={handleAnswer}
            className="flex-1 h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex flex-col items-center justify-center gap-1"
          >
            <Phone className="h-6 w-6" />
            <span className="text-xs font-medium">جواب دیں</span>
          </Button>
        </div>
      </div>
    </div>
  );
}