import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { JavMovie } from "../../api/types";
import { JavIdolsPage } from "./JavIdolsPage";
import { JavMoviePage } from "./JavMoviePage";

vi.mock("../../api/client", () => ({
  api: { jav: { idols: vi.fn(), movie: vi.fn() } },
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
