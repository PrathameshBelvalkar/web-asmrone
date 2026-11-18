import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { useScrollToTopOnNavigate } from "./use-scroll";

let navigate: NavigateFunction;
function Probe() {
  useScrollToTopOnNavigate();
  navigate = useNavigate();
  return null;
}

describe("useScrollToTopOnNavigate", () => {
  const scrollTo = vi.fn();
  beforeEach(() => {
    scrollTo.mockClear();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  });

  function setup() {
    render(
      <MemoryRouter initialEntries={["/hentai/titles"]}>
        <Probe />
      </MemoryRouter>,
    );
    scrollTo.mockClear();
  }

  it("scrolls to the top when a link opens another page", () => {
    setup();
    act(() => navigate("/hentai/title/ane-koi-1"));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("leaves Back, a #section link and a query change alone", () => {
    setup();
    act(() => navigate("/hentai/titles?sort=views"));
    act(() => navigate("/hentai/browse#tags"));
    act(() => navigate(-1));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
