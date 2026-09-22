import { render, screen } from "@testing-library/react";
import logo from "@/assets/remote-logo.png";
import { CollieMark } from "./collie-mark";

it("uses the dashboard artwork, preserves loading feedback and supports reduced motion", () => {
  const { container, rerender } = render(<CollieMark size={40} />);
  const mark = container.querySelector("svg");
  expect(mark?.querySelector("image")).toHaveAttribute("href", logo);
  expect(mark).toHaveAttribute("width", "40");
  expect(mark).not.toHaveClass("cm-live");
  expect(screen.queryByRole("img")).toBeNull();
  rerender(<CollieMark loading title="mycroftxxx remote" className="opacity-40" />);
  expect(screen.getByRole("img", { name: "mycroftxxx remote" })).toBe(mark);
  expect(mark).toHaveClass("cm-live", "opacity-40");
  expect(mark?.style.getPropertyValue("--cm-a1")).not.toBe("transparent");
  expect(mark?.querySelector("style")?.textContent).toContain("prefers-reduced-motion: reduce");
  expect(mark?.querySelector("style")?.textContent).toContain("animation: none !important");
});
