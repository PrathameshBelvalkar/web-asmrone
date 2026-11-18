import { describe, expect, it } from "vitest";
import { activeFilters, browseFromParams, browseRoute, browseToParams, timeAgo } from "./hanime";

describe("hanime browse address", () => {
  it("reads the defaults from an empty address", () => {
    expect(browseFromParams(new URLSearchParams())).toEqual({
      q: undefined,
      tags: [],
      tagMode: "and",
      exclude: [],
      studios: [],
      censored: "all",
      year: undefined,
      series: undefined,
      sort: "uploaded",
      order: "desc",
    });
  });

  it("round-trips every filter and keeps only what differs from the defaults", () => {
    const qs = "tags=yuri,maid&tagMode=or&exclude=ntr&studios=pink-pineapple&censored=uncensored&year=2015,2026&sort=views&order=asc";
    const b = browseFromParams(new URLSearchParams(qs));
    expect(b).toMatchObject({ tags: ["yuri", "maid"], tagMode: "or", exclude: ["ntr"], sort: "views", order: "asc" });
    expect(activeFilters(b)).toBe(6);
    expect(decodeURIComponent(browseToParams(b).toString())).toBe(qs);
    expect(browseToParams(browseFromParams(new URLSearchParams())).toString()).toBe("");
  });

  it("sorts a search by best match, and A–Z ascending", () => {
    expect(browseFromParams(new URLSearchParams("q=ane")).sort).toBe("relevance");
    expect(browseToParams(browseFromParams(new URLSearchParams("q=ane"))).toString()).toBe("q=ane");
    expect(browseFromParams(new URLSearchParams("sort=name")).order).toBe("asc");
  });

  it("drops values that aren't slugs or years", () => {
    const b = browseFromParams(new URLSearchParams("tags=yuri,<x>&year=20&sort=random&censored=maybe"));
    expect(b).toMatchObject({ tags: ["yuri"], year: undefined, sort: "uploaded", censored: "all" });
  });

  it("builds links and relative times", () => {
    expect(browseRoute({ tags: "yuri", sort: "trending" })).toBe("/hentai/titles?tags=yuri&sort=trending");
    const now = Date.parse("2026-11-17T12:00:00Z");
    expect(timeAgo("2026-11-17T11:48:00Z", now)).toBe("12 min ago");
    expect(timeAgo("2026-11-17T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo(null, now)).toBe("never");
  });
});
