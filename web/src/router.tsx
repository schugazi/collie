import { createBrowserRouter, replace } from "react-router";

import { basePath, mounted } from "@/lib/base-path";
import { atPane } from "@/lib/nav";

import { BootSplash, RootError, RootLayout } from "@/routes/root";
import { HomeRoute } from "@/routes/home";
import { SpaceRoute } from "@/routes/space";
import { DetailRoute } from "@/routes/detail";
import { HistoryRoute } from "@/routes/history";
import { SettingsRoute } from "@/routes/settings";
import { CrewRoute } from "@/routes/crew";
import { UpdatesRoute } from "@/routes/updates";
import {
  devicesLoader,
  historyLoader,
  crewLoader,
  rootLoader,
  paneLoader,
  PANE_ROUTE_ID,
  ROOT_ROUTE_ID,
} from "@/lib/loaders";

// We don't use view transitions. React Router persists an "applied view transitions" map to
// sessionStorage ("remix-router-transitions") and replays a phantom same-location transition on every
// revalidation for any path it once saw a `viewTransition: true` navigation from. A device that ran an
// older Collie build (which did use them) can carry a stale entry that fires
// document.startViewTransition on every poll. Clear it on boot — our code never repopulates it. The
// `:root { view-transition-name: none }` in index.css is the belt to this: even a stray transition
// then captures nothing, so there's no visible flicker regardless of this key's name.
try {
  sessionStorage.removeItem("remix-router-transitions");
} catch {
  // sessionStorage access can throw in locked-down / private contexts — ignore.
}

// Created once at module scope so the idle-lock in App can unmount/remount RouterProvider without
// losing the current location (the router instance retains it; loaders re-run fresh on remount).
export const router = createBrowserRouter([
  {
    id: ROOT_ROUTE_ID,
    path: "/",
    loader: rootLoader,
    element: <RootLayout />,
    // Catches render-phase errors and loader throws (e.g. a missing :paneId) so a component bug
    // shows a recoverable screen instead of React Router's blank default.
    errorElement: <RootError />,
    HydrateFallback: BootSplash,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: "space/:spaceId", element: <SpaceRoute /> },
      // Settings carries the paired-device registry, so it gets its own loader — a revoke or a pair
      // is then the app's standard mutation shape (api call → revalidate), with no second data path.
      { path: "settings", loader: devicesLoader, element: <SettingsRoute /> },
      // The Updates page, a sibling of settings and crew. No loader of its own: everything on it is
      // either the snapshot (root loader) or the card's own read of /api/update/check. It is
      // deliberately ON the poll loop for `crew`'s stated reason — a run in progress and a member
      // going quiet are exactly what this page exists to show without a reload.
      { path: "settings/updates", element: <UpdatesRoute /> },
      // The crew census, likewise on its own loader — and deliberately ON the poll loop: the payload
      // is one small object per machine, and the whole point of the page is that a member going
      // quiet shows up here without the operator reloading. (History opts out; this one wants in.)
      { path: "crew", loader: crewLoader, element: <CrewRoute /> },
      // The path was `crew` until 1.7.0 (M24 renamed the word a person reads). The service worker
      // caches the app shell, so a client sitting on /crew when the new bundle arrives, a bookmark
      // and an installed PWA's start URL all still ask for the old spelling. `replace` rather than
      // a push, so Back does not bounce the operator between the two names. The query string rides
      // along, because the scope (`?h=`) is what makes "back" return to the right machine.
      {
        path: "pack",
        loader: ({ request }) => replace(`/crew${new URL(request.url).search}`),
      },
      // Named, so RootLayout can ask for THIS route's data by id (react-router hands back undefined
      // whenever it isn't the active route) — see the "last seen" note there.
      { id: PANE_ROUTE_ID, path: "pane/:paneId", loader: paneLoader, element: <DetailRoute /> },
      {
        path: "pane/:paneId/history",
        loader: historyLoader,
        element: <HistoryRoute />,
        // Opt OUT of the poll loop. revalidate() re-runs every active loader, and a transcript can be
        // hundreds of turns — re-pulling it every 1.5s would be pure waste, and it would fight the
        // view's own "load older" paging by resetting the page under it. History is fetched on
        // navigation; the view pages back through it with direct api calls.
        shouldRevalidate: () => false,
      },
    ],
  },
], {
  // The mount the bridge served this document under (ADR 0052): `/` at the root, `/collie/` behind
  // a proxy that gives Collie a path. Every route path above stays root-relative; the router puts
  // the mount in front of them and takes it off what it reads from the address bar.
  basename: basePath(),
});

// BACK OUT OF A PANE LANDS ON THE DASHBOARD OR THE SPACE VIEW IT WAS OPENED FROM, because nothing
// else stacks under one: a pane switch replaces (routes/detail.tsx) and the history page returns by
// going back (routes/history.tsx). A cold pane has nothing of the app behind it, so the dashboard is
// seeded underneath, on the first tap or key rather than at boot: WebKit's Back gesture skips, for
// good, an entry pushed without a user activation, so a seed pushed at boot would send the swipe
// straight out of the app. A swipe before any tap still leaves; no page can stop that.
//
// Cold means React Router's FIRST entry (`idx` 0, numbered when the router above was created): a
// pane is never there once anything of the app is behind it. A reload keeps the number, so a pane
// reloaded before its first tap (the service worker's update reload among them) is still cold.
function seed() {
  window.removeEventListener("click", seed, true);
  window.removeEventListener("keydown", seed, true);
  const state = window.history.state;
  if (state?.idx !== 0 || !atPane()) return;
  const pane = window.location.href;
  window.history.replaceState({ usr: null, key: "seed", idx: 0 }, "", mounted(`/${window.location.search}`));
  window.history.pushState({ ...state, idx: 1 }, "", pane);
}
if (atPane() && window.history.state?.idx === 0) {
  window.addEventListener("click", seed, true);
  window.addEventListener("keydown", seed, true);
}
