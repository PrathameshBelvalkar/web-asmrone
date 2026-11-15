import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Track } from "../api/types";
import { MODEL_PREFIX } from "../api/types";
import { usePlayer } from "../player/store";
import { MiniPlayer } from "./MiniPlayer";
import { stopPlayback } from "../player/engine";

vi.mock("../player/engine", () => ({ togglePlay: vi.fn(), nextTrack: vi.fn(), stopPlayback: vi.fn() }));

const track = {
  mediaItemType: `${MODEL_PREFIX}Track`,
  id: "t1",
  title: "Rainy night",
  artists: [{ id: "a1", name: "Some circle" }],
  cover: null,
  extras: {},
} as unknown as Track;

describe("MiniPlayer", () => {
  afterEach(() => usePlayer.setState({ queue: [], index: -1, nowPlayingOpen: false }));

  it("shows nothing when nothing is playing", () => {
    usePlayer.setState({ queue: [], index: -1 });
    const { container } = render(<MiniPlayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the playing track and opens Now Playing", async () => {
    usePlayer.setState({ queue: [track], index: 0, playing: true });
    render(<MiniPlayer />);
    expect(screen.getByText("Rainy night")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Open now playing/ }));
    expect(usePlayer.getState().nowPlayingOpen).toBe(true);
  });

  it("has a close button that stops playback", async () => {
    usePlayer.setState({ queue: [track], index: 0, playing: true });
    render(<MiniPlayer />);
    await userEvent.click(screen.getByRole("button", { name: "Close player" }));
    expect(stopPlayback).toHaveBeenCalled();
  });
});
