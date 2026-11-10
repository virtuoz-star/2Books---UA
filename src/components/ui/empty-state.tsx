import type { ReactNode } from "react";
import { cn } from "cn";

function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

export { EmptyState };
