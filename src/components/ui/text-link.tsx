import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cn } from "cn";

const textLinkClass =
  "text-link inline-flex min-h-6 items-center text-sm font-medium text-primary underline";

function TextLink({
  asChild = false,
  className,
  ...props
}: ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return <Comp className={cn(textLinkClass, className)} {...props} />;
}

export { TextLink, textLinkClass };
