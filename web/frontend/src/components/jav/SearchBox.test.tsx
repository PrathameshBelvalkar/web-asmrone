import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import { SearchBox, type SuggestSource } from "./SearchBox";

vi.mock("../../api/client", () => ({
  api: { jav: { movies: vi.fn(), idols: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {},
}));

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

function renderBox(source: SuggestSource, onSubmit = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/jav"]}>
        <SearchBox scope="test" source={source} placeholder="Search" onSubmit={onSubmit} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { input: screen.getByRole("combobox", { name: "Search" }), onSubmit };
}

const genres: SuggestSource = {
  type: "local",
  items: [
    { key: "creampie", label: "Creampie", to: "/jav/movies/genre/creampie" },
    { key: "cosplay", label: "Cosplay", to: "/jav/movies/genre/cosplay" },
    { key: "drama", label: "Drama", to: "/jav/movies/genre/drama" },
  ],
};

describe("SearchBox", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.jav.movies).mockReset();
    vi.mocked(api.jav.idols).mockReset();
  });

  it("suggests from a local list as you type, and the arrow keys and Enter pick one", () => {
    const { input } = renderBox(genres);
    fireEvent.change(input, { target: { value: "co" } });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Cosplay", "Search for “co”"]);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/jav/movies/genre/cosplay");
  });

  it("searches on Enter, then offers the search again as a recent one", () => {
    const { input, onSubmit } = renderBox(genres);
    fireEvent.change(input, { target: { value: "drama" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("drama");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.focus(input);
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "drama" })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("suggests movies from the site's search after a pause, and a DVD ID gets a direct link", async () => {
    vi.mocked(api.jav.movies).mockResolvedValue({
      items: [
        { slug: "savr-1268", kind: "censored", dvdId: "SAVR-1268", title: "A title", releaseDate: null, upcoming: false, cover: null, studio: null },
      ],
      page: 1,
      lastPage: 1,
      hasMore: false,
    });
    const { input } = renderBox({ type: "movies", kind: "censored" });
    fireEvent.change(input, { target: { value: "savr-1268" } });
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Go to SAVR-1268");
    await waitFor(() => expect(api.jav.movies).toHaveBeenCalledWith({ by: "search", q: "savr-1268", kind: "censored" }, 1));
    expect(await screen.findByText("A title")).toBeInTheDocument();
  });

  it("suggests idols with their photos", async () => {
    vi.mocked(api.jav.idols).mockResolvedValue({
      items: [{ slug: "aoi-aosaka", name: "Aoi Aosaka", photo: null, age: 24 }],
      page: 1,
      lastPage: 1,
      hasMore: false,
    });
    const { input } = renderBox({ type: "idols" });
    fireEvent.change(input, { target: { value: "aoi" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Aoi Aosaka/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/jav/idol/aoi-aosaka");
  });
});
