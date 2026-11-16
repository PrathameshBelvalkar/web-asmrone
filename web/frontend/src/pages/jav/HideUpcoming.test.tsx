import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../../api/client";
import type { JavMovieCard } from "../../api/types";
import { useJavPrefs } from "../../lib/jav-prefs";
import { JavMoviesPage } from "./JavMoviesPage";

vi.mock("../../api/client", () => ({
  api: { jav: { movies: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {},
}));

globalThis.IntersectionObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

const card = (slug: string, upcoming: boolean): JavMovieCard => ({
  slug,
  kind: "censored",
  dvdId: slug.toUpperCase(),
  title: `Movie ${slug}`,
  releaseDate: upcoming ? "2027-01-01" : "2026-10-01",
  upcoming,
  cover: null,
  studio: null,
});

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <JavMoviesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Hide upcoming movies", () => {
  beforeEach(() => {
    localStorage.clear();
    useJavPrefs.setState({ hideUpcoming: true });
    vi.mocked(api.jav.movies)
      .mockReset()
      .mockResolvedValue({ items: [card("abc-1", true), card("abc-2", false)], page: 1, lastPage: 1, hasMore: false });
  });

  it("is on by default and is saved on the device", () => {
    expect(useJavPrefs.getState().hideUpcoming).toBe(true);
    act(() => useJavPrefs.getState().setHideUpcoming(false));
    expect(JSON.parse(localStorage.getItem("echo:jav:prefs")!)).toEqual({ hideUpcoming: false });
  });

  it("starts Movies where released titles begin and leaves announced ones out", async () => {
    renderAt("/jav/movies");
    await waitFor(() => expect(api.jav.movies).toHaveBeenCalledWith({ by: "latest", kind: "censored" }, 1));
    expect(await screen.findByText("ABC-2")).toBeInTheDocument();
    expect(screen.queryByText("ABC-1")).toBeNull();
  });

  it("shows announced movies again when turned off", async () => {
    useJavPrefs.setState({ hideUpcoming: false });
    renderAt("/jav/movies");
    await waitFor(() =>
      expect(api.jav.movies).toHaveBeenCalledWith({ by: "movies", kind: "censored", sort: "release" }, 1),
    );
    expect(await screen.findByText("ABC-1")).toBeInTheDocument();
  });

  it("filters other sorts by hiding the announced cards", async () => {
    renderAt("/jav/movies?sort=top_rated");
    await waitFor(() =>
      expect(api.jav.movies).toHaveBeenCalledWith({ by: "movies", kind: "censored", sort: "top_rated" }, 1),
    );
    expect(await screen.findByText("ABC-2")).toBeInTheDocument();
    expect(screen.queryByText("ABC-1")).toBeNull();
  });
});
