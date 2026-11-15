import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../../api/client";
import { MangaBrowsePage } from "./MangaBrowsePage";

vi.mock("../../api/client", () => ({
  api: { manga: { list: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {},
}));

// The grid loads more as you scroll; jsdom has no IntersectionObserver.
globalThis.IntersectionObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MangaBrowsePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MangaBrowsePage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.manga.list).mockReset().mockResolvedValue({ tag: null, items: [], page: 1, lastPage: 1, hasMore: false });
  });

  it("shows all galleries with no language picked", async () => {
    renderAt("/manga");
    await waitFor(() => expect(api.manga.list).toHaveBeenCalledWith({ by: "browse", sort: "new" }, 1));
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("All languages");
  });

  it("uses the language in the address, then the remembered one", async () => {
    renderAt("/manga?lang=japanese&sort=popular");
    await waitFor(() =>
      expect(api.manga.list).toHaveBeenCalledWith({ by: "language", slug: "japanese", sort: "popular" }, 1),
    );
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Japanese");
  });

  it("starts from the last language picked", async () => {
    localStorage.setItem("echo:manga:language", "english");
    renderAt("/manga");
    await waitFor(() => expect(api.manga.list).toHaveBeenCalledWith({ by: "language", slug: "english", sort: "new" }, 1));
  });

  it("shows one category instead of a language when one is picked", async () => {
    localStorage.setItem("echo:manga:language", "english");
    renderAt("/manga?category=doujinshi");
    await waitFor(() =>
      expect(api.manga.list).toHaveBeenCalledWith({ by: "category", slug: "doujinshi", sort: "new" }, 1),
    );
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("All languages");
  });
});
