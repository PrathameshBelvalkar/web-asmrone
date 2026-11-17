import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import { JavHeaderSearch, javSearchArea } from "./HeaderSearch";

vi.mock("../../api/client", () => ({
  api: { jav: { movies: vi.fn(), idols: vi.fn(), news: vi.fn(), genres: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {},
}));

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <JavHeaderSearch />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.getByRole("combobox");
}

describe("JAV header search", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.jav.genres).mockReset().mockResolvedValue({
      groups: [{ name: "Theme", genres: [{ slug: "cosplay", name: "Cosplay" }, { slug: "drama", name: "Drama" }] }],
    });
    vi.mocked(api.jav.news).mockReset().mockResolvedValue({ items: [], page: 1, lastPage: 1, hasMore: false });
  });

  it.each([
    ["/jav", "news"],
    ["/jav/news/2026/11/13/x", "news"],
    ["/jav/latest", "movies"],
    ["/jav/movies", "movies"],
    ["/jav/movie/censored/abc-1", "movies"],
    ["/jav/movies/studio/kawaii", "movies"],
    ["/jav/movies/genre/drama", "genres"],
    ["/jav/genres", "genres"],
    ["/jav/idols", "idols"],
    ["/jav/idol/aoi-aosaka", "idols"],
    ["/jav/search?type=idols", "search"],
  ])("offers the right search on %s", (path, area) => {
    expect(javSearchArea(path.split("?")[0]!)).toBe(area);
  });

  it("filters Genres as you type and suggests matching genres", async () => {
    const input = renderAt("/jav/genres");
    expect(input).toHaveAccessibleName("Search genres");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cos" } });
    expect(screen.getByTestId("where")).toHaveTextContent("/jav/genres?q=cos");
    expect(await screen.findByRole("option", { name: /Cosplay/ })).toBeInTheDocument();
  });

  it("opens the Search page from a movie page, kept to the kind shown", () => {
    const input = renderAt("/jav/movies?kind=uncensored");
    expect(input).toHaveAccessibleName("Search uncensored movies");
    fireEvent.change(input, { target: { value: "carib" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByTestId("where")).toHaveTextContent("/jav/search?q=carib&kind=uncensored");
  });

  it("searches idols from an idol page", () => {
    const input = renderAt("/jav/idol/aoi-aosaka");
    fireEvent.change(input, { target: { value: "yua" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByTestId("where")).toHaveTextContent("/jav/search?q=yua&type=idols");
  });
});
