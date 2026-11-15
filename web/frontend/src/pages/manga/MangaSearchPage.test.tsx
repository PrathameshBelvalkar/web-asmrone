import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { api } from "../../api/client";
import { MangaSearchPage } from "./MangaSearchPage";

vi.mock("../../api/client", () => ({
  api: { manga: { list: vi.fn(), searchIndex: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {},
}));

globalThis.IntersectionObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MangaSearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MangaSearchPage", () => {
  beforeEach(() => {
    vi.mocked(api.manga.searchIndex).mockReset().mockResolvedValue({
      items: [{ kind: "tag", slug: "yuri", name: "yuri", count: 36000 }],
    });
    vi.mocked(api.manga.list).mockReset().mockResolvedValue({ tag: null, items: [], page: 1, lastPage: 1, hasMore: false });
  });

  it("looks up tag names as you type, and links each to its galleries", async () => {
    renderAt("/manga/search?in=tags");
    await userEvent.type(screen.getByRole("textbox", { name: "Search tags" }), "yur");
    const link = await screen.findByRole("link", { name: /yuri/ });
    expect(link).toHaveAttribute("href", "/manga/tag/yuri");
    expect(link).toHaveTextContent("36K");
    // The first letter is looked up at once (it loads that letter's pages); the word follows when typing pauses.
    await waitFor(() => expect(api.manga.searchIndex).toHaveBeenLastCalledWith("tag", "yur"));
    expect(api.manga.list).not.toHaveBeenCalled();
  });

  it("searches artists when Artists is picked", async () => {
    renderAt("/manga/search?in=artists&q=ori");
    await waitFor(() => expect(api.manga.searchIndex).toHaveBeenCalledWith("artist", "ori"));
  });

  it("searches galleries on Enter", async () => {
    renderAt("/manga/search");
    await userEvent.type(screen.getByRole("textbox", { name: "Search galleries" }), "tag:yuri{Enter}");
    await waitFor(() => expect(api.manga.list).toHaveBeenCalledWith({ by: "search", q: "tag:yuri" }, 1));
    expect(api.manga.searchIndex).not.toHaveBeenCalled();
  });
});
