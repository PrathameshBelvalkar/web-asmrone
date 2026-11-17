import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";

vi.mock("../api/client", () => ({
  api: {
    me: vi.fn().mockResolvedValue(null),
  },
  ApiError: class ApiError extends Error {},
}));

// jsdom has no matchMedia; the sidebar asks it whether it is on a phone.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

function renderSidebar(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppSidebar", () => {
  it("shows Manga & Doujinshi between Browse and Account", async () => {
    renderSidebar("/manga/g/1");
    const label = await screen.findByText("Manga & Doujinshi");
    const labels = screen
      .getAllByText(/^(Browse|Manga & Doujinshi|Account)$/)
      .filter((el) => el.getAttribute("data-sidebar") === "group-label")
      .map((el) => el.textContent);
    expect(labels).toEqual(["Browse", "Manga & Doujinshi", "Account"]);

    const group = label.closest('[data-sidebar="group"]') as HTMLElement;
    const links = within(group).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/manga", "/manga/search", "/manga/artists", "/manga/tags"]);
    // A gallery page counts as Browse.
    expect(within(group).getByRole("link", { name: "Browse" })).toHaveAttribute("data-active", "true");
  });

  it.each([
    ["/manga/artist/orita", "Artists"],
    ["/manga/artists?q=ori", "Artists"],
    ["/manga/tag/yuri", "Tags"],
    ["/manga/parody/original", "Tags"],
    ["/manga/language/english", "Browse"],
    ["/manga/search?in=tags", "Search"],
  ])("marks %s as %s", async (path, active) => {
    renderSidebar(path);
    const group = (await screen.findByText("Manga & Doujinshi")).closest('[data-sidebar="group"]') as HTMLElement;
    const on = within(group)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("data-active") === "true")
      .map((a) => a.textContent);
    expect(on).toEqual([active]);
  });

  it("shows JAV between Manga & Doujinshi and Hanime", async () => {
    renderSidebar("/jav/movie/censored/savr-1268");
    const label = await screen.findByText("JAV");
    // A label's name is its first element when it has one (JAV is followed by a Beta tag).
    const labels = [...document.querySelectorAll('[data-sidebar="group-label"]')].map(
      (el) => el.firstElementChild?.textContent ?? el.textContent,
    );
    expect(labels).toEqual(["Browse", "Manga & Doujinshi", "JAV", "Hanime", "Account"]);
    expect(within(label.closest('[data-sidebar="group-label"]') as HTMLElement).getByText("Beta")).toBeInTheDocument();
    const group = label.closest('[data-sidebar="group"]') as HTMLElement;
    expect(within(group).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/jav",
      "/jav/latest",
      "/jav/movies",
      "/jav/idols",
      "/jav/genres",
      "/jav/search",
      "/jav/library",
    ]);
  });

  it.each([
    ["/jav", "News"],
    ["/jav/news/2026/11/13/top-jav-movies", "News"],
    ["/jav/latest?show=upcoming", "Latest"],
    ["/jav/movie/censored/savr-1268", "Movies"],
    ["/jav/movies/studio/kawaii", "Movies"],
    ["/jav/movies/genre/creampie", "Genres"],
    ["/jav/idol/hikaru-nagi", "Idols"],
    ["/jav/search?q=aoi", "Search"],
    ["/jav/library", "Library"],
  ])("marks JAV %s as %s", async (path, active) => {
    renderSidebar(path);
    const group = (await screen.findByText("JAV")).closest('[data-sidebar="group"]') as HTMLElement;
    const on = within(group)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("data-active") === "true")
      .map((a) => a.textContent);
    expect(on).toEqual([active]);
  });

  it("shows Hanime between JAV and Account, with its five pages", async () => {
    renderSidebar("/hanime");
    const group = (await screen.findByText("Hanime")).closest('[data-sidebar="group"]') as HTMLElement;
    expect(within(group).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/hanime",
      "/hanime/browse",
      "/hanime/titles",
      "/hanime/seasons",
      "/hanime/search",
    ]);
  });

  it.each([
    ["/hanime", "Home"],
    ["/hanime/browse?q=yuri", "Browse"],
    ["/hanime/titles?tags=yuri", "All titles"],
    ["/hanime/title/ane-koi-1", "All titles"],
    ["/hanime/seasons?year=2014", "Seasons"],
    ["/hanime/search?q=ane", "Search"],
  ])("marks Hanime %s as %s", async (path, active) => {
    renderSidebar(path);
    const group = (await screen.findByText("Hanime")).closest('[data-sidebar="group"]') as HTMLElement;
    const on = within(group)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("data-active") === "true")
      .map((a) => a.textContent);
    expect(on).toEqual([active]);
  });
});
