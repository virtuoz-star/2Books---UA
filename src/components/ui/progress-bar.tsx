import { Progress } from "radix-ui";

function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const percent = Math.round(ratio * 100);
  return (
    <div className="flex w-full max-w-sm flex-col gap-1">
      {label ? (
        <p className="text-sm text-muted-foreground">
          {label}
        </p>
      ) : null}
      <Progress.Root
        value={percent}
        max={100}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <Progress.Indicator
          className="h-full bg-primary motion-color"
          style={{ width: `${percent}%` }}
        />
      </Progress.Root>
    </div>
  );
}

export { ProgressBar };
