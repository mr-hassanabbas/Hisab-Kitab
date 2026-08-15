import { useEffect, useState, useCallback } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { drainQueue, getPendingCount, setupOnlineSyncListener } from "@/lib/offlineSync";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

export function OfflineBanner() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => { setIsOnline(true); refreshCount(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Auto-drain when back online
    const cleanup = setupOnlineSyncListener(({ synced, failed }) => {
      refreshCount();
      if (synced > 0) {
        toast({
          title: t("sync_complete"),
          description: t("synced_items").replace("{n}", String(synced)),
        });
      }
      if (failed > 0) {
        toast({
          title: t("sync_partial"),
          description: t("sync_failed_items").replace("{n}", String(failed)),
          variant: "destructive",
        });
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      cleanup();
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const { synced, failed } = await drainQueue();
      await refreshCount();
      if (synced > 0 || failed === 0) {
        toast({ title: t("sync_complete"), description: t("synced_items").replace("{n}", String(synced)) });
      }
      if (failed > 0) {
        toast({ title: t("sync_partial"), description: t("sync_failed_items").replace("{n}", String(failed)), variant: "destructive" });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Show nothing if online and no pending items
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium shadow-md transition-all ${
        isOnline
          ? "bg-amber-500 text-white"
          : "bg-slate-800 text-white"
      }`}
      style={{ direction: "ltr" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          {!isOnline
            ? t("offline_mode")
            : t("pending_sync").replace("{n}", String(pendingCount))
          }
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {pendingCount > 0 && (
          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
            {pendingCount}
          </span>
        )}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {isSyncing
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />
            }
            {isSyncing ? t("syncing") : t("sync_now")}
          </button>
        )}
      </div>
    </div>
  );
}
