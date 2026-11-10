import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";

import { IconButton } from "#/components/ui/icon-button";
import { PopoverContent } from "#/components/ui/popover";
import { ProgressBar } from "#/components/ui/progress-bar";
import { Segmented } from "#/components/ui/segmented";
import { SheetContent } from "#/components/ui/sheet";
import { Toast } from "#/components/ui/toast";

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

type Paper = {
  page: string;
  surface: string;
  ink: string;
  secondary: string;
  faint: string;
  edge: string;
  accent: string;
  wash: string;
  onAccent: string;
  marker: string;
  onMarker: string;
  danger: string;
  onDanger: string;
};

const papers = {
  lagoon: {
    page: "#e8f0eb",
    surface: "#fafcf9",
    ink: "#13292c",
    secondary: "#4a605c",
    faint: "#566b66",
    edge: "#6f867d",
    accent: "#17635d",
    wash: "#d2eae3",
    onAccent: "#f6fbf8",
    marker: "#ffe08a",
    onMarker: "#5c3f00",
    danger: "#a2372d",
    onDanger: "#f6fbf8",
  },
  ivory: {
    page: "#f2e9d8",
    surface: "#fcf8ee",
    ink: "#2a231a",
    secondary: "#62574a",
    faint: "#74685a",
    edge: "#8a7a60",
    accent: "#1a5c56",
    wash: "#e9dcc2",
    onAccent: "#fbf8f0",
    marker: "#ffd978",
    onMarker: "#5c3f00",
    danger: "#9c3429",
    onDanger: "#fbf8f0",
  },
  night: {
    page: "#0e1718",
    surface: "#152022",
    ink: "#e3eeea",
    secondary: "#a3b9b3",
    faint: "#8ea59f",
    edge: "#5a7572",
    accent: "#7fd1c6",
    wash: "#1b3536",
    onAccent: "#0c1f1e",
    marker: "#6d5a1e",
    onMarker: "#f6dc8c",
    danger: "#f09a91",
    onDanger: "#0c1f1e",
  },
} as const satisfies Record<string, Paper>;

function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground: string, background: string): number {
  const lum = (hex: string) =>
    0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const left = lum(foreground);
  const right = lum(background);
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

test("stylesheet self-hosts Literata and drops the dead dark class", () => {
  expect(css).not.toContain("fonts.googleapis");
  expect(css).not.toContain("fonts.gstatic");
  expect(css).not.toContain("Fraunces");
  expect(css).not.toMatch(/\.dark\b/);
  expect(css).toContain('font-family: "Literata Variable"');
  expect(css).toContain('font-family: "Manrope Variable"');
  expect(css).toContain('font-family: "Source Serif 4 Variable"');
  expect(css).toContain("font-weight: 400");
  expect(css).toContain("font-weight: 380");
  expect(css).toContain("outline: 2px solid var(--ring)");
  expect(css).toContain('data-paper="auto"');
  expect(css).toContain("prefers-color-scheme: dark");
  expect(css).toContain("prefers-reduced-motion");
});

test("text is at least 4.5:1 and controls at least 3:1", () => {
  for (const [name, paper] of Object.entries(papers)) {
    for (const hex of Object.values(paper)) expect(css).toContain(hex);
    const text: Array<[string, string, string]> = [
      ["ink", paper.ink, paper.page],
      ["ink", paper.ink, paper.surface],
      ["ink", paper.ink, paper.wash],
      ["secondary", paper.secondary, paper.page],
      ["secondary", paper.secondary, paper.surface],
      ["secondary", paper.secondary, paper.wash],
      ["faint", paper.faint, paper.page],
      ["faint", paper.faint, paper.surface],
      ["accent", paper.accent, paper.page],
      ["accent", paper.accent, paper.surface],
      ["on accent", paper.onAccent, paper.accent],
      ["on marker", paper.onMarker, paper.marker],
      ["on danger", paper.onDanger, paper.danger],
      ["danger", paper.danger, paper.page],
      ["danger", paper.danger, paper.surface],
    ];
    for (const [label, foreground, background] of text) {
      expect(contrast(foreground, background), `${name} ${label}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(paper.edge, paper.page), `${name} edge on page`).toBeGreaterThanOrEqual(3);
    expect(contrast(paper.edge, paper.surface), `${name} edge on surface`).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrast(paper.accent, paper.page), `${name} ring on page`).toBeGreaterThanOrEqual(3);
    expect(contrast(paper.accent, paper.surface), `${name} ring on surface`).toBeGreaterThanOrEqual(
      3,
    );
  }
});

test("kit modules load", () => {
  expect(typeof IconButton).toBe("function");
  expect(typeof PopoverContent).toBe("function");
  expect(typeof ProgressBar).toBe("function");
  expect(typeof Segmented).toBe("function");
  expect(typeof SheetContent).toBe("function");
  expect(typeof Toast).toBe("function");
});
