import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProplyticLogo } from "./ProplyticLogo";
import {
  PROPLYTIC_FAVICON_ASSET,
  PROPLYTIC_ICON_ASSET,
  PROPLYTIC_LOGO_ASSET
} from "./proplyticLogoShared";

describe("ProplyticLogo", () => {
  it("renders full wordmark with accessible label", () => {
    render(<ProplyticLogo mode="full" title="Proplytic" />);
    expect(screen.getByRole("img", { name: "Proplytic" })).toBeInTheDocument();
  });

  it("renders icon-only mode", () => {
    render(<ProplyticLogo mode="icon" title="Proplytic icon" />);
    expect(screen.getByRole("img", { name: "Proplytic icon" })).toBeInTheDocument();
  });

  it("renders app icon mode", () => {
    render(<ProplyticLogo mode="app" title="Proplytic app" />);
    expect(screen.getByRole("img", { name: "Proplytic app" })).toBeInTheDocument();
  });

  it("uses nobg assets for UI logos and white-bg asset for favicon constant", () => {
    expect(PROPLYTIC_LOGO_ASSET).toContain("_nobg");
    expect(PROPLYTIC_ICON_ASSET).toContain("_nobg");
    expect(PROPLYTIC_FAVICON_ASSET).not.toContain("_nobg");
  });

  it("icon mode img src is the nobg mark", () => {
    render(<ProplyticLogo mode="icon" title="Proplytic" />);
    expect(screen.getByRole("img", { name: "Proplytic" })).toHaveAttribute("src", PROPLYTIC_ICON_ASSET);
  });
});
