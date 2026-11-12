import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Cpu, Gauge, Subtitles, Trash2 } from "lucide-react";
import {
  useCancelDownload,
  useDeleteModel,
  useDownloadModel,
  usePauseDownload,
  useRunBenchmark,
  useSelectModel,
  useSetSetting,
  useSetupTools,
} from "../api/mutations";
import { toolsOptions } from "../api/queries";
import type { ToolsModel, ToolsStatus, Variant } from "../api/types";
import { messageFor } from "../lib/errors";
import { formatBytes, formatEta, formatSpeed } from "../lib/format";
import { toast } from "../lib/toast";
import { Spinner } from "./States";
import { Button, Toggle } from "./ui";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
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
import { Progress } from "./ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const ENGINE_LABEL: Record<Variant, string> = {
  metal: "Graphics card (Metal)",
  vulkan: "Graphics card (Vulkan)",
  cpu: "Processor only",
  system: "Installed on this computer",
};

const row = "flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0";

/** The AI subtitles switch, what the setup is doing, and the downloaded models. */
export function AiSubtitlesCard() {
  const query = useQuery(toolsOptions());
  const setSetting = useSetSetting();
  const setup = useSetupTools();
  const pause = usePauseDownload();
  const status = query.data;

  const toggle = async (next: boolean) => {
    try {
      await setSetting.mutateAsync({ key: "aiSubtitles", value: next });
    } catch (e) {
      toast(messageFor(e));
      return;
    }
    // Turning on resumes (or starts) the setup. Turning off pauses a running download.
    if (next) setup.mutate();
    else if (
      status &&
      (status.download.status === "downloading" ||
        status.download.status === "verifying")
    ) {
      pause.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Subtitles size={18} className="text-primary" aria-hidden /> AI
          subtitles
        </CardTitle>
        <CardDescription>Subtitles for tracks that have none.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={row}>
          <div className="min-w-0">
            <div className="text-sm">AI subtitles</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Writes subtitles for audio that has none. Runs on this computer,
              free, nothing is uploaded. The first time, Echo downloads one file
              (190 to 550 MB).
            </div>
          </div>
          <Toggle
            label="AI subtitles"
            checked={status?.enabled ?? false}
            disabled={!status || setSetting.isPending}
            onChange={(next) => void toggle(next)}
          />
        </div>
        {status?.enabled && <SetupDetails status={status} />}
        {status && <StoredModels models={status.models} />}
      </CardContent>
    </Card>
  );
}

/** Everything under the switch, for the state the setup is in. */
function SetupDetails({ status }: { status: ToolsStatus }) {
  const setup = useSetupTools();
  const pause = usePauseDownload();
  const cancel = useCancelDownload();

  if (status.problem) {
    return (
      <Alert variant="destructive" className="mt-2">
        <AlertTitle>AI subtitles can't be set up</AlertTitle>
        <AlertDescription>
          <p>{status.problem}</p>
          <Button
            className="mt-3 h-8 px-3 text-xs"
            onClick={() => setup.mutate()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { download, benchmark } = status;
  if (download.status === "downloading") {
    const percent =
      download.total > 0
        ? Math.floor((download.received / download.total) * 100)
        : 0;
    return (
      <div className="space-y-3 border-t py-4">
        <div className="text-sm">Getting AI subtitles ready…</div>
        <Progress value={percent} aria-label="Download progress" />
        <div className="flex items-center justify-between gap-4 text-xs tnum text-muted-foreground">
          <span>
            {formatBytes(download.received)} of {formatBytes(download.total)} (
            {percent}%)
          </span>
          <span>
            {formatEta(
              download.total - download.received,
              download.bytesPerSecond,
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          You can keep using Echo. This continues in the background.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={() => pause.mutate()}
          >
            Pause
          </Button>
          <Button
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => cancel.mutate()}
          >
            Cancel download
          </Button>
        </div>
      </div>
    );
  }
  if (download.status === "verifying") {
    return (
      <div className="border-t py-4">
        <Spinner label="Checking the file…" />
      </div>
    );
  }
  if (download.status === "failed") {
    return (
      <Alert variant="destructive" className="mt-2">
        <AlertTitle>The download did not finish</AlertTitle>
        <AlertDescription>
          <p>{download.message}</p>
          <Button
            className="mt-3 h-8 px-3 text-xs"
            onClick={() => setup.mutate()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (status.paused) {
    return <PausedDetails status={status} />;
  }
  if (benchmark.status === "running") {
    return (
      <div className="border-t py-4">
        <Spinner label="Testing how fast this computer is… (about 30 seconds)" />
      </div>
    );
  }
  if (!status.ready) {
    return (
      <div className="border-t py-4">
        <Spinner label="Getting AI subtitles ready…" />
      </div>
    );
  }
  return <ReadyDetails status={status} />;
}

/** A download the user paused: its progress, and the ways to go on. */
function PausedDetails({ status }: { status: ToolsStatus }) {
  const setup = useSetupTools();
  const cancel = useCancelDownload();
  const model = status.models.find((m) => m.id === status.pausedModelId);
  const partial = model?.partialBytes ?? 0;
  const percent =
    model && model.size > 0 ? Math.floor((partial / model.size) * 100) : 0;
  return (
    <div className="space-y-3 border-t py-4">
      <div className="text-sm">Download paused</div>
      {model && (
        <>
          <Progress value={percent} aria-label="Paused download progress" />
          <div className="text-xs tnum text-muted-foreground">
            {formatBytes(partial)} of {formatBytes(model.size)} ({percent}%)
            saved
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Resume to carry on from here, or cancel to delete the partial file.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          className="h-8 px-3 text-xs"
          onClick={() => setup.mutate()}
        >
          Resume
        </Button>
        <Button
          variant="ghost"
          className="h-8 px-3 text-xs"
          onClick={() => cancel.mutate()}
        >
          Cancel download
        </Button>
      </div>
    </div>
  );
}

/** Shown once the engine and a model are in place. Nothing here is needed for normal use. */
function ReadyDetails({ status }: { status: ToolsStatus }) {
  const selectModel = useSelectModel();
  const downloadModel = useDownloadModel();
  const [pendingModel, setPendingModel] = useState<string | null>(null);

  // A model chosen before it was downloaded is selected once its file is in place.
  useEffect(() => {
    if (!pendingModel) return;
    const model = status.models.find((m) => m.id === pendingModel);
    if (model?.installed && status.download.status === "idle") {
      setPendingModel(null);
      selectModel.mutate(pendingModel);
    } else if (
      status.download.status === "failed" &&
      status.download.modelId === pendingModel
    ) {
      setPendingModel(null);
    }
  }, [pendingModel, status, selectModel]);

  const chooseModel = (id: string) => {
    const model = status.models.find((m) => m.id === id);
    if (!model || model.selected) return;
    if (model.installed) {
      selectModel.mutate(id);
    } else {
      setPendingModel(id);
      downloadModel.mutate(id);
    }
  };

  const selected = status.models.find((m) => m.selected);
  const engine = status.engine.selected;

  return (
    <div className="space-y-1 border-t pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-emerald-400">
        <CircleCheck size={16} aria-hidden /> Ready
      </div>

      <div className={row}>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Cpu
            size={16}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span>Engine</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Whisper · {engine ? ENGINE_LABEL[engine] : "Not found"}
        </span>
      </div>

      <div className={row}>
        <div className="min-w-0 text-sm">Model</div>
        <Select
          value={pendingModel ?? selected?.id ?? ""}
          onValueChange={chooseModel}
        >
          <SelectTrigger
            aria-label="Model"
            className="w-auto min-w-52 max-w-[55%] rounded-full"
          >
            <SelectValue placeholder="Choose a model" />
          </SelectTrigger>
          <SelectContent>
            {status.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title} ({formatBytes(m.size)})
                {m.installed ? "" : " · download"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={row}>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Gauge
            size={16}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span>Speed</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-right text-xs text-muted-foreground">
            {status.benchmark.speedFactor !== null
              ? formatSpeed(status.benchmark.speedFactor)
              : "Not measured yet"}
          </span>
          <SpeedTestButton />
        </div>
      </div>
    </div>
  );
}

function SpeedTestButton() {
  const run = useRunBenchmark();
  return (
    <Button
      className="h-8 shrink-0 px-3 text-xs"
      onClick={() => run.mutate()}
      disabled={run.isPending}
    >
      Run speed test
    </Button>
  );
}

/** Every downloaded model, each with a delete button behind a confirmation. */
function StoredModels({ models }: { models: ToolsModel[] }) {
  const installed = models.filter((m) => m.installed);
  if (installed.length === 0) return null;
  return (
    <div className="space-y-1 border-t pt-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Downloaded models
      </div>
      {installed.map((m) => (
        <StoredModelRow key={m.id} model={m} />
      ))}
    </div>
  );
}

function StoredModelRow({ model }: { model: ToolsModel }) {
  const remove = useDeleteModel();
  const [open, setOpen] = useState(false);
  return (
    <div className={row}>
      <span className="min-w-0 text-sm">
        {model.title}{" "}
        <span className="text-muted-foreground">
          ({formatBytes(model.size)})
        </span>
        {model.selected && (
          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
            In use
          </span>
        )}
      </span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            icon={Trash2}
            className="h-8 shrink-0 px-3 text-xs"
          >
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete the {model.title.toLowerCase()} model?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {model.selected
                ? "This model is in use. AI subtitles switch to another downloaded model. If it is the last one, AI subtitles are turned off."
                : `Its ${formatBytes(model.size)} are removed from this computer. You can download it again later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(model.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
