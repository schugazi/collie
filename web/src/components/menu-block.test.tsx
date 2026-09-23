import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { parseAnsi } from "@/lib/ansi";
import { splitLines } from "@/lib/blocks";
import { claudeBuildBlocks } from "@/lib/harness/claude";
import { MenuBlock } from "./menu-block";

// The generic menu renderer. Driven off the real `/model` capture through the real pipeline, so what
// it renders is exactly what the adapter lifts.

const PICKER = readFileSync(
  join(import.meta.dirname, "..", "fixtures", "panes", "claude--menu-model-picker.txt"),
  "utf8",
);

function menuBlock() {
  const block = claudeBuildBlocks(splitLines(parseAnsi(PICKER))).find((b) => b.kind === "menu");
  if (!block || block.kind !== "menu") throw new Error("the picker fixture lifted no menu block");
  return block;
}

function renderMenu(onAction = vi.fn()) {
  const block = menuBlock();
  render(<MenuBlock menu={block.menu} lines={block.lines} onAction={onAction} />);
  return onAction;
}

describe("MenuBlock", () => {
  it("renders the footer's actions, the cancel, and the nav the screen advertised", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Set as default" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this session only" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move down" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /right — adjust/i })).toBeInTheDocument();
  });

  // The mirror shows the value visibly; the accessible names still say WHAT ←/→ adjust.
  it("names the ←/→ arrows with the value they adjust", () => {
    renderMenu();
    expect(
      screen.getByRole("button", { name: "Left — adjust (◐ Medium effort)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Right — adjust (◐ Medium effort)" }),
    ).toBeInTheDocument();
  });

  // The region stays visible because the grammar parsed the FOOTER, not the body: the options and
  // their descriptions exist only as terminal text, and the buttons are meaningless without them.
  it("keeps the terminal region readable above the controls", () => {
    renderMenu();
    expect(screen.getByText(/Most capable for your hardest/)).toBeInTheDocument();
  });

  // .adr/0009 at the UI edge: a digit tap here would confirm AND persist the user's default model.
  it("offers no digit buttons", () => {
    renderMenu();
    for (const button of screen.getAllByRole("button")) {
      expect(/^\d+$/.test(button.textContent ?? ""), button.textContent ?? "").toBe(false);
    }
  });

  it("sends a footer key as a committing action, and an arrow or Cancel as nav", async () => {
    const user = userEvent.setup();
    const onAction = renderMenu();

    await user.click(screen.getByRole("button", { name: "Use this session only" }));
    expect(onAction).toHaveBeenCalledWith({ keys: ["s"], nav: false });

    await user.click(screen.getByRole("button", { name: "Move down" }));
    expect(onAction).toHaveBeenCalledWith({ keys: ["Down"], nav: true });

    // Esc commits nothing, so a Cancel right after an arrow must not be refused against the
    // highlight that arrow just moved — it needed two taps on the phone while it compared commits.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAction).toHaveBeenCalledWith({ keys: ["Escape"], nav: true });
  });

  it("queues a Cancel tapped while an arrow is still in flight, rather than dropping it", async () => {
    const user = userEvent.setup();
    let finishArrow!: () => void;
    const onAction = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishArrow = resolve)))
      .mockResolvedValue(undefined);
    renderMenu(onAction);

    await user.click(screen.getByRole("button", { name: "Move up" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    // The arrow still holds the row, so Cancel waits its turn…
    expect(onAction).toHaveBeenCalledTimes(1);

    finishArrow();
    // …and goes out once it lands.
    await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
    expect(onAction).toHaveBeenLastCalledWith({ keys: ["Escape"], nav: true });
  });

  it("drops a queued tap once the picker is gone, rather than firing it at a pane left behind", async () => {
    const user = userEvent.setup();
    let finishArrow!: () => void;
    const onAction = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishArrow = resolve)))
      .mockResolvedValue(undefined);
    const block = menuBlock();
    const { unmount } = render(<MenuBlock menu={block.menu} lines={block.lines} onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: "Move up" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    unmount();
    finishArrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("keeps the committing keys disabled while an arrow is pending — a commit is never queued", async () => {
    // Queued behind an arrow whose send failed, a commit would pass its signature check against the
    // untouched highlight and commit the row the operator was moving away from.
    const user = userEvent.setup();
    let finishArrow!: () => void;
    const onAction = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishArrow = resolve)))
      .mockResolvedValue(undefined);
    renderMenu(onAction);

    await user.click(screen.getByRole("button", { name: "Move down" }));
    const commit = screen.getByRole("button", { name: "Set as default" });
    expect(commit).toBeDisabled();
    await user.click(commit);
    finishArrow();
    await vi.waitFor(() => expect(commit).toBeEnabled());
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("splits the arrow row into four equal buttons, with no value label to resize them", () => {
    // A visible value between ←/→ changed width with the value and shifted every arrow.
    renderMenu();
    const arrows = ["Move up", "Move down", /^Left — adjust/, /^Right — adjust/].map((name) =>
      screen.getByRole("button", { name }),
    );
    const row = arrows[0].parentElement!;
    expect([...row.children]).toEqual(arrows);
    for (const arrow of arrows) expect(arrow.className).toMatch(/(?:^|\s)flex-1(?=\s|$)/);
  });

  it("draws the /effort slider's ladder natively, with the current step marked", () => {
    const block = claudeBuildBlocks(
      splitLines(
        parseAnsi(
          readFileSync(
            join(import.meta.dirname, "..", "fixtures", "panes", "claude--menu-effort-slider.txt"),
            "utf8",
          ),
        ),
      ),
    ).find((b) => b.kind === "menu");
    if (!block || block.kind !== "menu") throw new Error("the effort fixture lifted no menu block");
    const { container } = render(<MenuBlock menu={block.menu} lines={block.lines} onAction={vi.fn()} />);

    // Its terminal rows sit off to the right of a full-width pane, so they are not mirrored at all.
    expect(container.querySelector("pre")).toBeNull();
    const steps = screen.getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual(["low", "medium", "high", "xhigh", "max", "ultracode"]);
    expect(steps.filter((s) => s.getAttribute("aria-current") === "true").map((s) => s.textContent)).toEqual([
      "xhigh",
    ]);
  });

  it("keeps a full-width button's label in place while its key is sending", async () => {
    const user = userEvent.setup();
    renderMenu(vi.fn(() => new Promise<void>(() => {})));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancel);
    // The spinner stands out of the flow, so the word does not slide over to make room for it.
    const spinner = screen.getByLabelText("Sending");
    expect(spinner.parentElement!.className).toMatch(/(?:^|\s)absolute(?=\s|$)/);
    expect(cancel.className).not.toMatch(/(?:^|\s)gap-/);
  });

  it("renders but refuses taps when disabled", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const block = menuBlock();
    render(<MenuBlock menu={block.menu} lines={block.lines} onAction={onAction} disabled />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAction).not.toHaveBeenCalled();
  });
});
