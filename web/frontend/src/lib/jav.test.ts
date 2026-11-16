import { describe, expect, it } from "vitest";
import { daysUntil, dvdIdSlug, filtersFromParams } from "./jav";

describe("JAV helpers", () => {
  it("reads idol filters from the address and drops values Echo doesn't offer", () => {
    const params = new URLSearchParams("age=twenties&cup=d,e,zz&body=slim,loli&debutYear=2024-2026&hairColor=");
    expect(filtersFromParams(params)).toEqual({ age: ["twenties"], cup: ["d", "e"], body: ["slim"], debutYear: "2024-2026" });
    expect(filtersFromParams(new URLSearchParams("body=loli&debutYear=soon"))).toEqual({});
  });

  it("recognises DVD IDs", () => {
    expect(dvdIdSlug("SAVR-1268")).toBe("savr-1268");
    expect(dvdIdSlug(" savr1268 ")).toBe("savr-1268");
    expect(dvdIdSlug("aoi aosaka")).toBeNull();
  });

  it("counts days until a release", () => {
    const now = new Date(2026, 10, 16, 15, 0);
    expect(daysUntil("2026-11-16", now)).toBe(0);
    expect(daysUntil("2026-11-19", now)).toBe(3);
    expect(daysUntil(null, now)).toBeNull();
  });
});
