import { cn } from "@/application/lib/utils";

export interface SegmentedToggleOption<V extends string> {
  value: V;
  label: string;
}

type TogglePattern = "tab" | "toggle" | "radio";

interface SegmentedToggleProps<V extends string> {
  value: V;
  options: SegmentedToggleOption<V>[];
  onChange: (value: V) => void;
  /**
   * Accessibility pattern to use:
   * - "tab":    WAI-ARIA tabs pattern — `role="tab"` + `aria-selected` (default, for content panels).
   * - "toggle": `<button>` with `aria-pressed` (for binary/multi exclusive toggles).
   * - "radio":  WAI-ARIA radiogroup — `role="radio"` + `aria-checked` (for mutually exclusive choice lists).
   */
  pattern?: TogglePattern;
  ariaLabel?: string;
  className?: string;
  itemClassName?: string;
}

/** Role of the toggle container for the WAI-ARIA pattern in use. */
function parentRoleFor(pattern: TogglePattern): "tablist" | "radiogroup" | undefined {
  if (pattern === "tab") return "tablist";
  if (pattern === "radio") return "radiogroup";
  return undefined;
}

/** Role of each option button for the WAI-ARIA pattern in use. */
function childRoleFor(pattern: TogglePattern): "tab" | "radio" | undefined {
  if (pattern === "tab") return "tab";
  if (pattern === "radio") return "radio";
  return undefined;
}

/** Roving-tabindex helper: inside a radiogroup only the selected item is tabbable. */
function tabIndexFor(pattern: TogglePattern, selected: boolean): number | undefined {
  if (pattern !== "radio") return undefined;
  return selected ? 0 : -1;
}

/** Visual class of an option button for the pattern/selection combination. */
function itemClassFor(pattern: TogglePattern, selected: boolean): string {
  if (pattern === "tab" && selected) return "border-b-2 border-accent text-accent";
  if (selected) return "bg-surface text-accent";
  return "text-muted hover:text-fg";
}

export default function SegmentedToggle<V extends string>({
  value,
  options,
  onChange,
  pattern = "tab",
  ariaLabel,
  className,
  itemClassName,
}: Readonly<SegmentedToggleProps<V>>) {
  const isTab = pattern === "tab";
  const isRadio = pattern === "radio";

  return (
    <div
      role={parentRoleFor(pattern)}
      aria-label={ariaLabel}
      className={cn("inline-flex items-center border border-border bg-surface-warm p-1", className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role={childRoleFor(pattern)}
            aria-selected={isTab ? selected : undefined}
            aria-checked={isRadio ? selected : undefined}
            aria-pressed={!isTab && !isRadio ? selected : undefined}
            tabIndex={tabIndexFor(pattern, selected)}
            onClick={() => {
              if (!selected) onChange(opt.value);
            }}
            className={cn(
              "px-3 py-1 font-mono text-xs uppercase tracking-[0.1em] transition-[background-color,border-color,color] duration-fast ease-standard focus-visible:outline-none focus-visible:shadow-focus",
              itemClassFor(pattern, selected),
              itemClassName,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
