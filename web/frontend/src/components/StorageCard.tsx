import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, RotateCcw, Trash2 } from "lucide-react";
import { useClearCache, useClearData } from "../api/mutations";
import { storageOptions } from "../api/queries";
import { formatBytes } from "../lib/format";
import { toast } from "../lib/toast";
import { Button } from "./ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

const row = "flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0";

/** Clear cache and clear all data. Downloaded AI subtitle models are managed in their own card. */
export function StorageCard() {
  const usage = useQuery(storageOptions());
  const queryClient = useQueryClient();
  const clearCache = useClearCache();
  const clearData = useClearData();
  const [cacheOpen, setCacheOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  const cached = usage.data
    ? usage.data.subtitlesBytes + usage.data.partialBytes
    : null;

  const onClearCache = async () => {
    try {
      await clearCache.mutateAsync();
      toast("Cache cleared");
    } catch {
      // The mutation already shows the error.
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["storage"] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive size={18} className="text-primary" aria-hidden /> Storage
        </CardTitle>
        <CardDescription>What Echo keeps on this computer.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <div className={row}>
          <div className="min-w-0">
            <div className="text-sm">Clear cache</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Deletes saved AI subtitles and unfinished model downloads, and
              reloads pages fresh.{" "}
              {cached !== null && (
                <span className="tnum">Using {formatBytes(cached)}.</span>
              )}
            </div>
          </div>
          <AlertDialog open={cacheOpen} onOpenChange={setCacheOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="secondary"
                icon={Trash2}
                className="h-8 shrink-0 px-3 text-xs"
                disabled={clearCache.isPending}
              >
                Clear cache
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear the cache?</AlertDialogTitle>
                <AlertDialogDescription>
                  Saved AI subtitles are deleted and made again the next time
                  you play those tracks. Your settings, login and downloaded
                  models stay.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onClearCache()}>
                  Clear cache
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className={row}>
          <div className="min-w-0">
            <div className="text-sm">Clear all data</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Resets Echo as if it were new: clears the cache, every
              preference, the play queue and reading progress, and logs you
              out.
            </div>
          </div>
          <AlertDialog open={dataOpen} onOpenChange={setDataOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                icon={RotateCcw}
                className="h-8 shrink-0 px-3 text-xs text-destructive"
                disabled={clearData.isPending}
              >
                Clear all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your preferences, play queue, reading progress and saved AI
                  subtitles are deleted, and you are logged out of asmr.one.
                  Downloaded AI subtitle models stay; delete them above if you
                  want the space back. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearData.mutate()}>
                  Clear all data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
