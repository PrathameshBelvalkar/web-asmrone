import { describe, expect, it } from "vitest";
import { clockTime, daysUntil, dvdIdSlug, filtersFromParams, timeLeft } from "./jav";

describe("JAV helpers", () => {
  it("reads idol filters from the address and drops values NekoHub doesn't offer", () => {
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

  it("writes video positions and time left", () => {
    expect(clockTime(7)).toBe("0:07");
    expect(clockTime(2527)).toBe("42:07");
    expect(clockTime(3727)).toBe("1:02:07");
    expect(timeLeft(600, 7200)).toBe("1 h 50 min left");
    expect(timeLeft(7000, 7200)).toBe("3 min left");
    expect(timeLeft(7199, 7200)).toBe("1 min left");
  });
});
