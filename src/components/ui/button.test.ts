import { expect, test } from "vite-plus/test";

import { buttonVariants } from "#/components/ui/button";

test("default button includes the default size classes", () => {
  expect(buttonVariants()).toContain("h-9");
});
