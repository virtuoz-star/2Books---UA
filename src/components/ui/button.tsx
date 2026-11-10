import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "cn";

const buttonVariants = cva(
  "btn motion-color inline-flex w-fit shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-3 text-sm font-medium whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        primary: "btn-primary bg-primary text-primary-foreground",
        secondary: "btn-secondary border-edge bg-card text-foreground",
        ghost: "btn-ghost bg-transparent text-foreground",
        quiet: "btn-quiet bg-transparent text-muted-foreground",
        link: "btn-link text-link min-h-6 rounded-none border-0 bg-transparent px-0 text-primary underline",
        danger: "btn-danger bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "btn-sm px-3 text-sm",
        md: "btn-md px-3 text-sm",
        lg: "btn-lg px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  busy = false,
  disabled,
  children,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    busy?: boolean;
  }) {
  const pending = loading || busy;
  const Comp = asChild ? Slot.Root : "button";
  const shared = {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    "aria-busy": pending || undefined,
    className: cn(buttonVariants({ variant, size }), className),
  };

  if (asChild) {
    return (
      <Comp {...shared} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp {...shared} type={type} disabled={disabled || pending} {...props}>
      {pending ? <LoaderCircle className="spin size-4" aria-hidden /> : null}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
