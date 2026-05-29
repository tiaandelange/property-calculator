import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProplyticLogo } from "./ProplyticLogo";

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
});
