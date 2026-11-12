import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import type { ToolsModel, ToolsStatus } from "../api/types";
import { AiSubtitlesCard } from "./AiSubtitlesCard";

vi.mock("../api/client", () => ({
  api: {
    tools: vi.fn(),
    putSetting: vi.fn(),
    setupTools: vi.fn(),
    pauseDownload: vi.fn(),
    cancelDownload: vi.fn(),
    downloadModel: vi.fn(),
    selectModel: vi.fn(),
    deleteModel: vi.fn(),
    runBenchmark: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const MB = 1024 * 1024;

const models: ToolsModel[] = [
  {
    id: "large-v3-turbo-q5_0",
    title: "Best quality",
    note: "",
    size: 574 * MB,
    installed: false,
    selected: false,
    recommended: true,
    partialBytes: 0,
  },
  {
    id: "medium-q5_0",
    title: "Good quality",
    note: "",
    size: 539 * MB,
    installed: false,
    selected: false,
    recommended: false,
    partialBytes: 0,
  },
  {
    id: "small-q5_1",
    title: "Fastest",
    note: "",
    size: 190 * MB,
    installed: false,
    selected: false,
    recommended: false,
    partialBytes: 0,
  },
];

/** A status with the given parts changed. */
function status(patch: Partial<ToolsStatus> = {}): ToolsStatus {
  return {
    desktop: true,
    appVersion: "0.1.0",
    ffmpeg: { found: true },
    engine: { variants: ["cpu"], selected: "cpu" },
    models,
    download: { status: "idle" },
    benchmark: { status: "idle", speedFactor: null, message: null },
    freeDiskBytes: 50_000 * MB,
    enabled: false,
    paused: false,
    pausedModelId: null,
    problem: null,
    ready: false,
    ...patch,
  };
}

const FIXTURES = {
  off: status(),
  problem: status({
    enabled: true,
    problem: "Part of the app is missing. Please reinstall Echo.",
  }),
  downloading: status({
    enabled: true,
    download: {
      status: "downloading",
      modelId: "large-v3-turbo-q5_0",
      received: 0.4 * 574 * MB,
      total: 574 * MB,
      bytesPerSecond: 5 * MB,
    },
  }),
  failed: status({
    enabled: true,
    download: {
      status: "failed",
      modelId: "large-v3-turbo-q5_0",
      message: "The download was damaged. Please try again.",
    },
  }),
  benchmarkRunning: status({
    enabled: true,
    benchmark: { status: "running", speedFactor: null, message: null },
  }),
  ready: status({
    enabled: true,
    ready: true,
    models: models.map((m) =>
      m.id === "small-q5_1" ? { ...m, installed: true, selected: true } : m,
    ),
    benchmark: { status: "done", speedFactor: 0.05, message: null },
  }),
};

function renderCard(fixture: ToolsStatus) {
  vi.mocked(api.tools).mockResolvedValue(fixture);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AiSubtitlesCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.putSetting).mockResolvedValue(undefined);
  vi.mocked(api.setupTools).mockResolvedValue(undefined);
  vi.mocked(api.pauseDownload).mockResolvedValue(undefined);
  vi.mocked(api.cancelDownload).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AiSubtitlesCard", () => {
  it("shows only the switch, switched off, when AI subtitles are off", async () => {
    renderCard(FIXTURES.off);
    const toggle = await screen.findByRole("switch", { name: "AI subtitles" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText(/Getting AI subtitles ready/)).toBeNull();
    expect(screen.queryByText("Ready")).toBeNull();
  });

  it("shows the problem with a way to try again", async () => {
    renderCard(FIXTURES.problem);
    expect(
      await screen.findByText(
        "Part of the app is missing. Please reinstall Echo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows the download progress as a percentage with the time left", async () => {
    renderCard(FIXTURES.downloading);
    expect(
      await screen.findByText("Getting AI subtitles ready…"),
    ).toBeInTheDocument();
    expect(screen.getByText(/\(40%\)/)).toBeInTheDocument();
    expect(screen.getByText(/You can keep using Echo/)).toBeInTheDocument();
  });

  it("shows a failed download with its message and a way to try again", async () => {
    renderCard(FIXTURES.failed);
    expect(
      await screen.findByText("The download was damaged. Please try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows that the speed test is running", async () => {
    renderCard(FIXTURES.benchmarkRunning);
    expect(
      await screen.findByText(/Testing how fast this computer is/),
    ).toBeInTheDocument();
  });

  it("shows Ready with the engine, the speed and the model choice once set up", async () => {
    renderCard(FIXTURES.ready);
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Whisper · Processor only")).toBeInTheDocument();
    expect(
      screen.getByText("1 hour of audio takes about 3 minutes"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run speed test" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Model" })).toBeInTheDocument();
  });

  it("turning the switch on saves the setting and starts the setup", async () => {
    renderCard(FIXTURES.off);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("switch", { name: "AI subtitles" }),
    );

    await waitFor(() =>
      expect(api.putSetting).toHaveBeenCalledWith("aiSubtitles", true),
    );
    await waitFor(() => expect(api.setupTools).toHaveBeenCalled());
  });

  it("turning the switch off during a download pauses it and keeps the partial file", async () => {
    renderCard(FIXTURES.downloading);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("switch", { name: "AI subtitles" }),
    );

    await waitFor(() =>
      expect(api.putSetting).toHaveBeenCalledWith("aiSubtitles", false),
    );
    await waitFor(() => expect(api.pauseDownload).toHaveBeenCalled());
    expect(api.cancelDownload).not.toHaveBeenCalled();
  });

  it("a running download offers Pause and Cancel download", async () => {
    renderCard(FIXTURES.downloading);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(() => expect(api.pauseDownload).toHaveBeenCalled());
  });

  it("a paused download shows its progress with Resume and Cancel download", async () => {
    const paused = status({
      enabled: true,
      paused: true,
      pausedModelId: "large-v3-turbo-q5_0",
      models: models.map((m) =>
        m.id === "large-v3-turbo-q5_0"
          ? { ...m, partialBytes: 0.5 * 574 * MB }
          : m,
      ),
    });
    renderCard(paused);
    expect(await screen.findByText("Download paused")).toBeInTheDocument();
    expect(screen.getByText(/\(50%\) saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cancel download" }));
    await waitFor(() => expect(api.cancelDownload).toHaveBeenCalled());
  });

  it("lists downloaded models with a delete option even when AI subtitles are off", async () => {
    renderCard(
      status({
        enabled: false,
        models: models.map((m) =>
          m.id === "small-q5_1" ? { ...m, installed: true } : m,
        ),
      }),
    );
    expect(await screen.findByText("Downloaded models")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
