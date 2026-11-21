import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/application/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-modal-overlay-enter",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** Shared default viewport/overflow/padding contract for simple dialogs
 * (spec unify-cards-modals MODAL-001..004, MODAL-006, SPACE-001): the dialog
 * is bounded by the available dynamic viewport height, scrolls internally
 * when its content is taller, and contains overscroll so the obscured page
 * does not start scrolling. Consumers may still override width and height;
 * structured shells MUST use `STRUCTURED_DIALOG_CONTENT_CLASS` below. */
const VIEWPORT_SCROLL_BASE = "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain";

/**
 * Viewport-safe width (MODAL-003): 100% minus a 1rem gutter on each side.
 * The content element is `position: fixed`, so its containing block IS the
 * viewport — `w-full` would put the dialog border flush on both screen
 * edges and leave no visible screen margin at 320 px. Both shared content
 * primitives and any width-overriding consumer must use it.
 */
const VIEWPORT_SAFE_WIDTH = "w-[calc(100%-2rem)]";
/**
 * Shell for dialogs with an intentional fixed header/footer plus a dedicated
 * scrollable body (MODAL-005, MODAL-008): the shell itself never scrolls
 * (`overflow-hidden` + `overflow-y-hidden` override the shared default), its
 * height stays bounded by the available dynamic viewport like every dialog
 * (review I1), the inert `overscroll-contain` of the scrolling default is
 * cleared here because the shell owns NO scrolling (review I2) and it never
 * adds outer padding; the body region carries `min-h-0` + `overflow-y-auto`
 * + `overscroll-contain` (see `STRUCTURED_DIALOG_BODY_CLASS`), while its
 * header/footer keep their own spacing.
 */
export const STRUCTURED_DIALOG_CONTENT_CLASS =
  "flex flex-col overflow-hidden overflow-y-hidden overscroll-auto p-0 sm:p-0 max-h-[calc(100dvh-2rem)]";

/** Body region for structured shells: `min-h-0` is mandatory so the flex
 * content cannot be silently clipped by the `overflow-hidden` shell. */
export const STRUCTURED_DIALOG_BODY_CLASS =
  "min-h-0 flex-1 overscroll-contain overflow-y-auto bg-surface px-6 py-6 sm:px-8";

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        VIEWPORT_SAFE_WIDTH,
        "max-w-lg bg-surface border border-border text-fg block-shadow-raised animate-modal-enter p-6 sm:p-8",
        VIEWPORT_SCROLL_BASE,
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-none p-1.5 text-muted transition-colors hover:text-danger hover:border-danger focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none">
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // `pr-12` keeps long titles clear of the absolutely-positioned close
      // control (right-4 + p-1.5 + icon ≈ 44 px) — spec SPACE-004.
      "font-display uppercase tracking-[0.06em] text-lg leading-tight text-fg pr-12",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted mt-1", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
