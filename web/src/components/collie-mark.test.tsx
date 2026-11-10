import { render, screen } from "@testing-library/react";

import logo from "@/assets/remote-logo.png";
import { collieMark, markIsLive, markPaper, markState } from "@/test/collie-mark";

import { CollieMark } from "./collie-mark";

// The fork's bitmap mark. The contract itself (states, beads, pace, rest) is held by
// mark-conformance.test.tsx; this pins only what is the fork's own: the artwork and the ring.
it("draws the dashboard artwork with a ring that lights while loading", () => {
  const { container, rerender } = render(<CollieMark size={40} paper="var(--muted)" />);
  const mark = collieMark(container);
  expect(mark?.querySelector("image")).toHaveAttribute("href", logo);
  expect(mark).toHaveAttribute("width", "40");
  expect(markState(container)).toBe("rest");
  expect(markIsLive(container)).toBe(false);
  expect(markPaper(container)).toBe("var(--muted)");
  expect(mark?.style.getPropertyValue("--cm-a1")).toBe("transparent");
  expect(screen.queryByRole("img")).toBeNull();
  rerender(<CollieMark state="loading" title="mycroftxxx remote" className="opacity-40" />);
  expect(screen.getByRole("img", { name: "mycroftxxx remote" })).toBe(mark);
  expect(markIsLive(container)).toBe(true);
  expect(mark).toHaveClass("cm-live", "opacity-40");
  expect(mark?.style.getPropertyValue("--cm-a1")).not.toBe("transparent");
  expect(mark?.querySelector("circle.cm-ring")?.getAttribute("stroke")).toContain("var(--mark-bead-0");
});
