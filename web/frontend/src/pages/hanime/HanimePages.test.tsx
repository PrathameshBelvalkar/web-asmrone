import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { HanimeCard, HanimeTitle } from "../../api/types";
import { HanimeHeaderSearch } from "../../components/hanime/HeaderSearch";
import { HanimeBrowsePage } from "./HanimeBrowsePage";
import { HanimeGalleryPage, HanimeSeasonsPage } from "./HanimeGalleryPage";
import { HanimeTitlePage } from "./HanimeTitlePage";

vi.mock("../../api/client", () => ({
  api: {
    hanime: {
      titles: vi.fn(),
      title: vi.fn(),
      details: vi.fn(),
      seasons: vi.fn(),
      tags: vi.fn(),
      studios: vi.fn(),
      suggest: vi.fn(),
      stream: vi.fn(),
    },
  },
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

// Vidstack needs a real browser; the theater's player is a plain <video> here.
vi.mock("../../components/jav/JavTheater", () => ({
  THEATER_BOX: "",
  Player: ({ src, title }: { src: { src: string }; title: string }) => <video aria-label={title} src={src.src} />,
  Notice: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div role="status">
      {title}
      {action}
    </div>
  ),
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

function renderAt(path: string, routes: [string, React.ReactNode][]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes.map(([route, page]) => (
            <Route key={route} path={route} element={page} />
          ))}
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const card: HanimeCard = {
  id: 1,
  slug: "ane-koi-1",
  name: "Ane Koi 1",
  poster: "https://hanime-cdn.com/images/posters/a.jpg",
  cover: "https://hanime-cdn.com/images/covers/a.jpg",
  studio: { slug: "pink-pineapple", name: "Pink Pineapple" },
  releasedAt: "2023-05-01T00:00:00.000Z",
  uploadedAt: "2026-11-16T00:00:00.000Z",
  views: 21000,
  likes: 300,
  censorship: "censored",
  episode: 1,
  isNew: true,
};
const title: HanimeTitle = {
  ...card,
  altTitles: ["姉恋"],
  description: ["Based on a manga."],
  tags: [{ slug: "vanilla", name: "vanilla" }],
  dislikes: 10,
  downloads: 500,
  rating: 0.97,
  series: { key: "ane koi", name: "Ane Koi" },
  episodes: [card, { ...card, id: 2, slug: "ane-koi-2", name: "Ane Koi 2", episode: 2 }],
  similar: [],
  siteUrl: "https://hanime.tv/videos/hentai/ane-koi-1",
};

beforeEach(() => {
  vi.mocked(api.hanime.tags).mockResolvedValue([
    {
      group: "Story",
      tags: [
        { slug: "yuri", name: "yuri", count: 5, description: "Girls in love.", image: "https://hanime-cdn.com/images/tags/yuri-vertical.min.jpg" },
        { slug: "ntr", name: "ntr", count: 3, description: null, image: null },
      ],
    },
  ]);
  vi.mocked(api.hanime.studios).mockResolvedValue([{ slug: "pink-pineapple", name: "Pink Pineapple", count: 9 }]);
  vi.mocked(api.hanime.titles).mockResolvedValue({ items: [card], page: 1, lastPage: 1, total: 1, hasMore: false });
});

describe("HanimeBrowsePage", () => {
  it("asks for the filters in the address, names a one-tag list after the tag, and shows the total", async () => {
    renderAt("/hanime/titles?tags=yuri&sort=views", [["/hanime/titles", <HanimeBrowsePage />]]);
    expect(await screen.findByText("Ane Koi 1")).toBeInTheDocument();
    expect(vi.mocked(api.hanime.titles).mock.calls[0]?.[0]).toMatchObject({ tags: ["yuri"], sort: "views", order: "desc" });
    expect(await screen.findByRole("heading", { name: "Yuri" })).toBeInTheDocument();
    expect(screen.getByText("1 title")).toBeInTheDocument();
  });

  it("keeps a chosen sort and censorship in the address", async () => {
    renderAt("/hanime/titles", [["/hanime/titles", <HanimeBrowsePage />]]);
    fireEvent.click(await screen.findByRole("tab", { name: "Top rated" }));
    fireEvent.click(screen.getByRole("tab", { name: "Uncensored" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/hanime/titles?censored=uncensored&sort=rating"));
  });

  it("removes a filter from its chip", async () => {
    renderAt("/hanime/titles?tags=yuri&exclude=ntr", [["/hanime/titles", <HanimeBrowsePage />]]);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Not Ntr" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/hanime/titles?tags=yuri"));
  });
});

describe("HanimeTitlePage", () => {
  it("shows the cover, badges, synopsis, other names, preview frames, tags and the series", async () => {
    vi.mocked(api.hanime.title).mockResolvedValue(title);
    vi.mocked(api.hanime.details).mockResolvedValue({
      durationSec: 1400,
      badges: ["FHD 1080p", "23 min", "Sub EN"],
      altNames: ["Ane Koi: Suki Kirai Daisuki.", "姉恋"],
      synopsis: ["From the site."],
      storyboard: { url: "https://hanime-cdn.com/images/storyboards/a.jpg", columns: 5, rows: 36, tiles: 180 },
    });
    renderAt("/hanime/title/ane-koi-1", [["/hanime/title/:slug", <HanimeTitlePage />]]);
    expect(await screen.findByRole("heading", { name: "Ane Koi 1" })).toBeInTheDocument();
    expect(screen.getByText("Censored · Episode 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vanilla" })).toHaveAttribute("href", "/hanime/titles?tags=vanilla");
    expect(await screen.findByText("From the site.")).toBeInTheDocument();
    expect(screen.getByText("FHD 1080p")).toBeInTheDocument();
    expect(screen.getByText("Ane Koi: Suki Kirai Daisuki.")).toBeInTheDocument();
    const frames = screen.getAllByRole("button", { name: /^Preview frame/ });
    expect(frames).toHaveLength(14);
    expect(frames[0]).toHaveAccessibleName("Preview frame 1 at 0:04");
    expect(frames[13]).toHaveAccessibleName("Preview frame 14 at 23:16");
    fireEvent.click(frames[2] as HTMLElement);
    expect(screen.getByRole("dialog")).toHaveTextContent("3 / 14");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toHaveTextContent("4 / 14");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("More from Ane Koi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open on hanime\.tv/ })).toHaveAttribute("href", title.siteUrl);
  });

  it("uses the catalog's description and says so when the site's page can't be read", async () => {
    vi.mocked(api.hanime.title).mockResolvedValue(title);
    vi.mocked(api.hanime.details).mockRejectedValue(new ApiError(503, "upstream", "busy"));
    renderAt("/hanime/title/ane-koi-1", [["/hanime/title/:slug", <HanimeTitlePage />]]);
    expect(await screen.findByText("Based on a manga.")).toBeInTheDocument();
    expect(await screen.findByText("The preview couldn’t be loaded from hanime.tv.")).toBeInTheDocument();
    expect(screen.getByText("姉恋")).toBeInTheDocument();
  });

  it("plays the video from Watch, links its source, and closes", async () => {
    vi.mocked(api.hanime.title).mockResolvedValue(title);
    vi.mocked(api.hanime.details).mockRejectedValue(new ApiError(503, "upstream", "busy"));
    const file = "https://cdn.vintageporno.stream/Ane%20Koi%2001%20Sub.mp4";
    vi.mocked(api.hanime.stream).mockResolvedValue({ file, page: "https://hentaibros.net/ane-koi-episode-1/", title: "Ane Koi episode 1" });
    renderAt("/hanime/title/ane-koi-1", [["/hanime/title/:slug", <HanimeTitlePage />]]);
    fireEvent.click(await screen.findByRole("button", { name: "Watch" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/hanime/title/ane-koi-1?play=1");
    expect(await screen.findByLabelText("Ane Koi 1")).toHaveAttribute("src", file);
    expect(screen.getByRole("link", { name: /Source/ })).toHaveAttribute("href", "https://hentaibros.net/ane-koi-episode-1/");
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/hanime\/title\/ane-koi-1$/);
  });

  it("says so when hentaibros.net has no video for the title", async () => {
    vi.mocked(api.hanime.title).mockResolvedValue(title);
    vi.mocked(api.hanime.details).mockRejectedValue(new ApiError(503, "upstream", "busy"));
    vi.mocked(api.hanime.stream).mockRejectedValue(new ApiError(404, "not_found", "none"));
    renderAt("/hanime/title/ane-koi-1?play=1", [["/hanime/title/:slug", <HanimeTitlePage />]]);
    expect(await screen.findByText("hentaibros.net has no video for this title.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
  });

  it("says a refused title isn't available, and an unknown one isn't found", async () => {
    vi.mocked(api.hanime.title).mockRejectedValueOnce(new ApiError(451, "forbidden", "No"));
    const first = renderAt("/hanime/title/x", [["/hanime/title/:slug", <HanimeTitlePage />]]);
    expect(await screen.findByText("Not available")).toBeInTheDocument();
    first.unmount();
    vi.mocked(api.hanime.title).mockRejectedValueOnce(new ApiError(404, "not_found", "No"));
    renderAt("/hanime/title/y", [["/hanime/title/:slug", <HanimeTitlePage />]]);
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});

describe("HanimeHeaderSearch", () => {
  it("suggests titles, series, tags and studios, and opens the pick", async () => {
    vi.mocked(api.hanime.suggest).mockResolvedValue([
      { type: "title", card },
      { type: "series", key: "ane koi", name: "Ane Koi", count: 2, poster: card.poster },
      { type: "tag", ref: { slug: "vanilla", name: "vanilla", count: 400 } },
      { type: "studio", ref: { slug: "pink-pineapple", name: "Pink Pineapple", count: 507 } },
    ]);
    renderAt("/hanime", [["/hanime", <HanimeHeaderSearch />], ["*", null]]);
    const box = screen.getByRole("combobox", { name: "Search Hanime" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "ane" } });
    expect(await screen.findByText("Series · 2 episodes")).toBeInTheDocument();
    expect(screen.getByText("Tag · 400 titles")).toBeInTheDocument();
    expect(screen.getByText("Studio · 507 titles")).toBeInTheDocument();
    expect(api.hanime.suggest).toHaveBeenCalledWith("ane");
    fireEvent.mouseDown(screen.getByText("Ane Koi 1"));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/hanime/title/ane-koi-1"));
  });

  it("opens the Search page on Enter", async () => {
    vi.mocked(api.hanime.suggest).mockResolvedValue([]);
    renderAt("/hanime/titles", [["/hanime/titles", <HanimeHeaderSearch />], ["*", null]]);
    const box = screen.getByRole("combobox", { name: "Search Hanime" });
    fireEvent.change(box, { target: { value: "tentacle" } });
    fireEvent.submit(box.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/hanime/search?q=tentacle"));
  });
});

describe("HanimeGalleryPage", () => {
  it("shows the big cards, a picture card per tag and the studios, all linking to the title list", async () => {
    renderAt("/hanime/browse", [["/hanime/browse", <HanimeGalleryPage />]]);
    expect(screen.getByRole("link", { name: /Trending/ })).toHaveAttribute("href", "/hanime/titles?sort=trending");
    expect(screen.getByRole("link", { name: /Seasons/ })).toHaveAttribute("href", "/hanime/seasons");
    const yuri = await screen.findByRole("link", { name: /Yuri.*Girls in love\./ });
    expect(yuri).toHaveAttribute("href", "/hanime/titles?tags=yuri");
    expect(yuri.querySelector("img")).toHaveAttribute("src", "https://hanime-cdn.com/images/tags/yuri-vertical.min.jpg");
    expect(await screen.findByRole("link", { name: /Pink Pineapple/ })).toHaveAttribute("href", "/hanime/titles?studios=pink-pineapple");
  });

  it("narrows the tags and studios to the top bar's text", async () => {
    renderAt("/hanime/browse?q=ntr", [["/hanime/browse", <HanimeGalleryPage />]]);
    expect(await screen.findByRole("link", { name: /Ntr/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Yuri/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Trending/ })).toBeNull();
  });
});

describe("HanimeSeasonsPage", () => {
  it("lists a year by season and switches year", async () => {
    vi.mocked(api.hanime.seasons).mockResolvedValue({ years: [2026, 2025], year: 2026, seasons: [{ season: "Fall", items: [card] }] });
    renderAt("/hanime/seasons", [["/hanime/seasons", <HanimeSeasonsPage />]]);
    expect(await screen.findByRole("heading", { name: /Fall 2026/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "2025" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/hanime/seasons?year=2025"));
    await waitFor(() => expect(api.hanime.seasons).toHaveBeenCalledWith(2025));
  });
});
