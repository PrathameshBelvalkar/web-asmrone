import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { JavMovie } from "../../api/types";
import { useHistory } from "../../lib/history";
import { JavIdolsPage } from "./JavIdolsPage";
import { JavLibraryPage } from "./JavLibraryPage";
import { JavMoviePage } from "./JavMoviePage";
import { JavNewsPage } from "./JavNewsPage";

vi.mock("../../api/client", () => ({
  api: { jav: { idols: vi.fn(), movie: vi.fn(), news: vi.fn(), stream: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public type: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

// The grid loads more as you scroll; jsdom has no IntersectionObserver.
globalThis.IntersectionObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string, route: string, page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={page} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const movie: JavMovie = {
  slug: "abc-1",
  kind: "censored",
  dvdId: "ABC-1",
  title: "Office Lady Overtime",
  releaseDate: "2026-10-01",
  upcoming: false,
  cover: null,
  studio: { slug: "s1", name: "Studio One" },
  contentId: "abc00001",
  coverFull: null,
  runtimeMin: 120,
  series: null,
  director: null,
  genres: [{ slug: "drama", name: "Drama" }],
  idols: [],
  samples: [
    { thumb: "https://pics.example/1s.jpg", full: "https://pics.example/1.jpg" },
    { thumb: "https://pics.example/2s.jpg", full: "https://pics.example/2.jpg" },
    { thumb: "https://pics.example/3s.jpg", full: "https://pics.example/3.jpg" },
  ],
  trailer: null,
  similar: [],
};

describe("JavIdolsPage", () => {
  beforeEach(() => {
    vi.mocked(api.jav.idols).mockReset().mockResolvedValue({ items: [], page: 1, lastPage: 1, hasMore: false });
  });

  it("reads sort and filters from the address and keeps changes there", async () => {
    renderAt("/jav/idols?sort=most_favorited&cup=d,e&body=loli", "/jav/idols", <JavIdolsPage />);
    // `loli` is never offered, so it is dropped before any request.
    await waitFor(() =>
      expect(api.jav.idols).toHaveBeenCalledWith({ by: "all", sort: "most_favorited", filters: { cup: ["d", "e"] } }, 1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Cup: D" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/jav/idols?sort=most_favorited&cup=e"));
    fireEvent.click(screen.getByRole("tab", { name: "Name" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/jav/idols?sort=name&cup=e"));
  });

  it("offers no loli body type", async () => {
    renderAt("/jav/idols", "/jav/idols", <JavIdolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    const body = (await screen.findByText("Body type")).closest("fieldset") as HTMLElement;
    expect(within(body).queryByRole("button", { name: /loli/i })).toBeNull();
    expect(within(body).getByRole("button", { name: "Slim" })).toBeInTheDocument();
  });
});

describe("JavMoviePage", () => {
  beforeEach(() => {
    vi.mocked(api.jav.movie).mockReset();
    vi.mocked(api.jav.stream).mockReset();
  });

  it("looks for the full movie's stream only when Watch is pressed", async () => {
    vi.mocked(api.jav.movie).mockResolvedValue(movie);
    vi.mocked(api.jav.stream).mockRejectedValue(new ApiError(404, "not_found", "No stream was found for this movie."));
    renderAt("/jav/movie/censored/abc-1", "/jav/movie/:kind/:slug", <JavMoviePage />);
    const watch = await screen.findByRole("button", { name: "Watch" });
    expect(api.jav.stream).not.toHaveBeenCalled();
    fireEvent.click(watch);
    expect(await screen.findByText("No stream was found for this movie.")).toBeInTheDocument();
    expect(api.jav.stream).toHaveBeenCalledWith("censored", "abc-1");
    expect(screen.getByTestId("where").textContent).toBe("/jav/movie/censored/abc-1?play=movie");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Player" })).toBeNull();
    expect(screen.getByTestId("where").textContent).toBe("/jav/movie/censored/abc-1");
  });

  it("offers to resume where you left off, or start over", async () => {
    useHistory.setState({
      entries: [{ kind: "jav", id: "censored/abc-1", movieKind: "censored", slug: "abc-1", dvdId: "ABC-1", title: "t", cover: null, position: 2527, duration: 7200, at: 1 }],
    });
    vi.mocked(api.jav.movie).mockResolvedValue(movie);
    renderAt("/jav/movie/censored/abc-1", "/jav/movie/:kind/:slug", <JavMoviePage />);
    expect(await screen.findByRole("button", { name: "Resume 42:07" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByTestId("where").textContent).toBe("/jav/movie/censored/abc-1?play=movie&from=start");
    useHistory.setState({ entries: [] });
  });

  it("offers a retry when the stream source is busy", async () => {
    vi.mocked(api.jav.movie).mockResolvedValue(movie);
    vi.mocked(api.jav.stream).mockRejectedValue(new ApiError(503, "upstream", "busy"));
    renderAt("/jav/movie/censored/abc-1", "/jav/movie/:kind/:slug", <JavMoviePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Watch" }));
    expect(await screen.findByText("The stream source is busy. Try again later.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api.jav.stream).toHaveBeenCalledTimes(2));
  });

  it("has no Watch button for an upcoming movie", async () => {
    vi.mocked(api.jav.movie).mockResolvedValue({ ...movie, upcoming: true });
    renderAt("/jav/movie/censored/abc-1", "/jav/movie/:kind/:slug", <JavMoviePage />);
    expect(await screen.findByText("ABC-1", { selector: "h1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch" })).toBeNull();
  });

  it("shows a refused movie as not available", async () => {
    vi.mocked(api.jav.movie).mockRejectedValue(new ApiError(451, "forbidden", "This title is not available in Echo."));
    renderAt("/jav/movie/censored/abc-2", "/jav/movie/:kind/:slug", <JavMoviePage />);
    expect(await screen.findByText("Not available")).toBeInTheDocument();
  });

  it("shows a busy source with a way to try again", async () => {
    vi.mocked(api.jav.movie).mockRejectedValue(
      new ApiError(503, "upstream", "javdatabase.com is limiting requests right now. Try again later."),
    );
    renderAt("/jav/movie/censored/abc-2", "/jav/movie/:kind/:slug", <JavMoviePage />);
    expect(await screen.findByText(/limiting requests/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("opens sample images in a viewer that the arrow keys and Esc control", async () => {
    vi.mocked(api.jav.movie).mockResolvedValue(movie);
    renderAt("/jav/movie/censored/abc-1", "/jav/movie/:kind/:slug", <JavMoviePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Open image 3 of 3" }));
    const viewer = screen.getByRole("dialog");
    expect(within(viewer).getByText("3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(viewer).getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(viewer).getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("JavNewsPage", () => {
  const post = (n: number) => ({
    path: `2026/11/${String(n).padStart(2, "0")}/post-${n}`,
    url: `https://www.javdatabase.com/2026/11/${n}/post-${n}/`,
    title: `Post ${n}`,
    date: "2026-11-13",
    categories: [],
    summary: "",
    image: null,
  });

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.jav.news).mockReset().mockResolvedValue({ items: [post(1), post(2), post(3)], page: 1, lastPage: 1, hasMore: false });
  });

  it("leads with a large story in Magazine, and remembers the layout picked", async () => {
    const first = renderAt("/jav", "/jav", <JavNewsPage />);
    const lead = (await screen.findByText("Post 1")).closest("a")!.parentElement!;
    expect(lead.className).toContain("md:col-span-2");
    expect(screen.getByRole("radio", { name: "Magazine" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect((await screen.findByText("Post 1")).closest("a")!.parentElement!.className).not.toContain("col-span");
    first.unmount();

    renderAt("/jav", "/jav", <JavNewsPage />);
    expect(screen.getByRole("radio", { name: "List" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("JavLibraryPage", () => {
  const entry = (slug: string, position: number) => ({
    kind: "jav" as const,
    id: `censored/${slug}`,
    movieKind: "censored",
    slug,
    dvdId: slug.toUpperCase(),
    title: `Movie ${slug}`,
    cover: null,
    position,
    duration: 7200,
    at: Date.now(),
  });

  it("splits what you're watching from what you finished, and opens the player to continue", () => {
    useHistory.setState({ entries: [entry("abc-1", 600), entry("abc-2", 7190)] });
    renderAt("/jav/library", "/jav/library", <JavLibraryPage />);
    const watching = screen.getByRole("region", { name: "Continue watching" });
    expect(within(watching).getByRole("link", { name: "Continue ABC-1" })).toHaveAttribute("href", "/jav/movie/censored/abc-1?play=movie");
    expect(within(watching).getByText("1 h 50 min left")).toBeInTheDocument();
    const watched = screen.getByRole("region", { name: "Watched" });
    expect(within(watched).getByRole("link", { name: "ABC-2" })).toHaveAttribute("href", "/jav/movie/censored/abc-2");
    fireEvent.click(within(watched).getByRole("button", { name: "Remove ABC-2 from your library" }));
    expect(screen.queryByRole("region", { name: "Watched" })).toBeNull();
    useHistory.setState({ entries: [] });
  });

  it("explains itself when nothing has been watched", () => {
    useHistory.setState({ entries: [] });
    renderAt("/jav/library", "/jav/library", <JavLibraryPage />);
    expect(screen.getByText("Nothing watched yet")).toBeInTheDocument();
  });
});
