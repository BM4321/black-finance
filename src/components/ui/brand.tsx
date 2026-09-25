/**
 * The Black Finance mark: a rounded "B" tile plus the wordmark. The wordmark
 * takes an optional class so the collapsed sidebar can hide it.
 */
export function BrandMark({ labelClassName = "" }: { labelClassName?: string }) {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-foreground text-sm font-bold text-background">
        B
      </span>
      <span className={`truncate ${labelClassName}`}>Black Finance</span>
    </span>
  );
}
