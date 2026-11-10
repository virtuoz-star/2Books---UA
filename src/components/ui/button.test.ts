import { expect, test } from "vite-plus/test";

import { buttonVariants } from "#/components/ui/button";
import { controlClass } from "#/components/ui/field";
import { noticeRole } from "#/components/ui/notice";
import { textLinkClass } from "#/components/ui/text-link";

test("primary button uses the shared control, not a faded opacity style", () => {
  const classes = buttonVariants({ variant: "primary", size: "md" });
  expect(classes).toContain("btn-primary");
  expect(classes).toContain("bg-primary");
  expect(classes).toContain("motion-color");
  expect(classes).not.toContain("opacity-50");
  expect(classes).not.toContain("outline-none");
});

test("button variants cover secondary, quiet, danger, and link", () => {
  expect(buttonVariants({ variant: "secondary" })).toContain("border-edge");
  expect(buttonVariants({ variant: "quiet" })).toContain("btn-quiet");
  expect(buttonVariants({ variant: "danger" })).toContain("btn-danger");
  expect(buttonVariants({ variant: "link" })).toContain("underline");
  expect(buttonVariants({ variant: "ghost" })).toContain("btn-ghost");
});

test("fields use the control border token and 16px text", () => {
  expect(controlClass).toContain("border-edge");
  expect(controlClass).toContain("field-control");
  expect(controlClass).toContain("text-base");
});

test("text links keep an underline and a 24px minimum", () => {
  expect(textLinkClass).toContain("underline");
  expect(textLinkClass).toContain("min-h-6");
  expect(textLinkClass).toContain("text-primary");
});

test("errors alert and other notices are polite status", () => {
  expect(noticeRole("danger")).toBe("alert");
  expect(noticeRole("error")).toBe("alert");
  expect(noticeRole("info")).toBe("status");
  expect(noticeRole("success")).toBe("status");
  expect(noticeRole("warning")).toBe("status");
});
