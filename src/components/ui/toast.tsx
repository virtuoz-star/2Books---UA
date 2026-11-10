import type { ReactNode } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { cn } from "cn";

function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {children}
      <ToastPrimitive.Viewport className="toast-viewport" />
    </ToastPrimitive.Provider>
  );
}

function Toast({
  open,
  onOpenChange,
  title,
  description,
  undoLabel,
  onUndo,
  closeLabel,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  undoLabel?: string;
  onUndo?: () => void;
  closeLabel: string;
  className?: string;
}) {
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      className={cn("toast flex flex-col gap-1 shadow-lg motion-enter", className)}
    >
      <ToastPrimitive.Title className="text-sm font-medium">{title}</ToastPrimitive.Title>
      {description ? (
        <ToastPrimitive.Description className="text-sm text-muted-foreground">
          {description}
        </ToastPrimitive.Description>
      ) : null}
      <div className="mt-1 flex gap-2">
        {undoLabel && onUndo ? (
          <ToastPrimitive.Action
            altText={undoLabel}
            onClick={onUndo}
            className="text-sm font-medium text-primary"
          >
            {undoLabel}
          </ToastPrimitive.Action>
        ) : null}
        <ToastPrimitive.Close className="text-sm text-muted-foreground">
          {closeLabel}
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
}

export { Toast, ToastProvider };
