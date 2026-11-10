import type { ComponentProps } from "react";
import { cn } from "cn";

const cardClass = "rounded-lg border border-border bg-card text-card-foreground shadow-none";

function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardClass, "flex flex-col gap-3 p-4", className)} {...props} />;
}

export { Card, cardClass };
