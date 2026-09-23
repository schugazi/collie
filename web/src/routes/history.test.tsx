import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider, type InitialEntry } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { t } from "@/lib/i18n";
import { ROOT_ROUTE_ID, type HistoryData, type HomeData } from "@/lib/loaders";
import { withHeaderHost } from "@/test/header-host";
import { HistoryRoute } from "./history";

const STORAGE_KEY = "collie:display-prefs:v4";

beforeAll(() => {
  // jsdom doesn't implement scrollTo; ChatMessageList's auto-scroll calls it on mount.
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

const connected = (): HomeData => ({
  bridge: "connected",
  agents: [],
  shellPanes: [],
  workspaces: [],
  tabs: [],
  device: undefined,
  sessions: [],
  servers: [],
  ts: 0,
  scope: {},
  viewAll: false,
  snoozedUntil: null,
  update: undefined,
  error: false,
  authError: false,
});

function emptyHistory(): HistoryData {
  return { paneId: "p1", scope: {}, entries: [], hasMore: false, total: 0, fileTruncated: false };
}

function makeRouter(initialEntries: InitialEntry[] = ["/pane/p1/history"]) {
  return createMemoryRouter(
    [
      {
        id: ROOT_ROUTE_ID,
        path: "/",
        loader: () => connected(),
        element: withHeaderHost(<Outlet />),
        children: [
          { index: true, element: <div /> },
          { path: "pane/:paneId", element: <div /> },
          {
            path: "pane/:paneId/history",
            loader: () => emptyHistory(),
            element: <HistoryRoute />,
          },
        ],
      },
    ],
    { initialEntries },
  );
}

// The route mirrors the terminal — same font source, same idiom (components/agent-chat.tsx) — as
// the live pane view, applied to the div wrapping ChatMessageList. Reached via the scroll
// container's own known class rather than a test id, matching how agent-chat.test.tsx locates the
// mirror by adjacency instead of inventing a selector nothing else needs.
function mirrorWrapper(container: HTMLElement): HTMLElement {
  const scrollDiv = container.querySelector<HTMLElement>(".overflow-y-auto");
  if (!scrollDiv?.parentElement?.parentElement) throw new Error("mirror wrapper not found");
  return scrollDiv.parentElement.parentElement;
}

describe("HistoryRoute — terminal font", () => {
  afterEach(() => localStorage.clear());

  it("renders the system default face untouched", async () => {
    const { container } = render(<RouterProvider router={makeRouter()} />);
    await screen.findByText(/No transcript file was found/);

    const wrapper = mirrorWrapper(container);
    expect(wrapper.className).not.toMatch(/font-family:inherit/);
    expect(wrapper.getAttribute("style")).toBeNull();
  });

  it("applies the chosen terminal font to the transcript, same as the live mirror", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontFamily: "courier" }));
    const { container } = render(<RouterProvider router={makeRouter()} />);
    await screen.findByText(/No transcript file was found/);

    const wrapper = mirrorWrapper(container);
    expect(wrapper.className).toMatch(/\[font-family:inherit\]/);
    expect(wrapper.getAttribute("style")).toMatch(/Courier/);
    // The layout classes stay put — the font is added, not swapped in for them.
    expect(wrapper.className).toMatch(/(?:^|\s)flex-1(?=\s|$)/);
  });
});

describe("HistoryRoute — Close", () => {
  it("goes back to the pane that opened it, so no second copy lands in history", async () => {
    const router = makeRouter(["/pane/p1", { pathname: "/pane/p1/history", state: { fromPane: true } }]);
    render(<RouterProvider router={router} />);
    await userEvent.click(await screen.findByRole("button", { name: t("history.closeAria") }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/pane/p1"));
    expect(router.state.historyAction).toBe("POP");
  });

  it("opened any other way, swaps itself for the pane", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await userEvent.click(await screen.findByRole("button", { name: t("history.closeAria") }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/pane/p1"));
    expect(router.state.historyAction).toBe("REPLACE");
  });
});
