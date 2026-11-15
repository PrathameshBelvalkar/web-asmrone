import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import type { MangaGallery } from "../../api/types";
import { MangaReaderPage } from "./MangaReaderPage";

vi.mock("../../api/client", () => ({
  api: { manga: { gallery: vi.fn() } },
  proxyUrl: (url: string) => `/api/proxy?url=${url}`,
  ApiError: class ApiError extends Error {},
}));

globalThis.IntersectionObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

function gallery(category: string, pages = 5): MangaGallery {
  return {
    id: "1",
    title: "Test gallery",
    titleJapanese: null,
    prettyTitle: null,
    cover: "https://3-hentai.xyz/1/cover.jpg",
    coverFallbacks: [],
    pages: Array.from({ length: pages }, (_, i) => ({
      n: i + 1,
      url: `https://3-hentai.xyz/1/${i + 1}.jpg`,
      thumb: `https://3-hentai.xyz/1/${i + 1}t.jpg`,
      width: 900,
      height: 1300,
    })),
    tags: [
      { kind: "category", slug: category, name: category, count: null },
      { kind: "artist", slug: "orita", name: "orita", count: null },
    ],
    uploadedAt: null,
    scanlator: null,
  };
}

let path = "";
function Where() {
  path = useLocation().pathname;
  return null;
}

function renderReader(page = 1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/manga/g/1/read/${page}`]}>
        <Routes>
          <Route path="/manga/g/:id/read/:page?" element={<MangaReaderPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const key = (k: string) => fireEvent.keyDown(window, { key: k, code: k });

describe("MangaReaderPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.manga.gallery).mockReset();
  });

  it.each(["doujinshi", "western"])("goes forward with the right arrow and back with the left (%s)", async (category) => {
    vi.mocked(api.manga.gallery).mockResolvedValue(gallery(category));
    renderReader();
    await screen.findByText(/Page 1 \/ 5/);
    key("ArrowRight");
    await waitFor(() => expect(path).toBe("/manga/g/1/read/2"));
    key("ArrowLeft");
    await waitFor(() => expect(path).toBe("/manga/g/1/read/1"));
  });

  it("lays two pages of Japanese manga out right to left, and of Western comics left to right", async () => {
    localStorage.setItem("echo:manga:reader", JSON.stringify({ mode: "double" }));
    vi.mocked(api.manga.gallery).mockResolvedValue(gallery("manga"));
    const { unmount } = renderReader(2);
    await screen.findByText(/Page 2–3 \/ 5/);
    expect(screen.getAllByRole("img").map((img) => img.getAttribute("alt"))).toEqual(["Page 3", "Page 2"]);
    unmount();

    vi.mocked(api.manga.gallery).mockResolvedValue(gallery("western"));
    renderReader(2);
    await screen.findByText(/Page 2–3 \/ 5/);
    expect(screen.getAllByRole("img").map((img) => img.getAttribute("alt"))).toEqual(["Page 2", "Page 3"]);
  });

  it("shows two pages as printed, with the cover alone", async () => {
    localStorage.setItem("echo:manga:reader", JSON.stringify({ mode: "double" }));
    vi.mocked(api.manga.gallery).mockResolvedValue(gallery("manga"));
    renderReader();
    await screen.findByText(/Page 1 \/ 5/);
    key("ArrowRight");
    await screen.findByText(/Page 2–3 \/ 5/);
    key("ArrowRight");
    await screen.findByText(/Page 4–5 \/ 5/);
  });

  it("offers the next steps after the last page", async () => {
    vi.mocked(api.manga.gallery).mockResolvedValue(gallery("western", 2));
    renderReader(2);
    await screen.findByText(/Page 2 \/ 2/);
    key("ArrowRight");
    expect(await screen.findByText("You've reached the end")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More by orita" })).toHaveAttribute("href", "/manga/artist/orita");
    key("ArrowLeft");
    await waitFor(() => expect(screen.queryByText("You've reached the end")).not.toBeInTheDocument());
  });
});
