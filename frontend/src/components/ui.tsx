import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LoaderCircle, X, TriangleAlert } from "lucide-react";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-gold",
      secondary: "button-secondary",
      ghost: "button-ghost",
      danger: "button-danger",
    },
    size: { default: "", sm: "button-sm" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(variants({ variant, size }), className)} {...props} />
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const previousFocus = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content
          className="modal-content"
          onOpenAutoFocus={() => {
            previousFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const target = previousFocus.current?.isConnected
              ? previousFocus.current
              : document.getElementById("main-content");
            target?.focus({ preventScroll: true });
          }}
        >
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description>
            {description || "Customize your Starry AI experience."}
          </DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close
            className="modal-close"
            aria-label="Close dialog"
          >
            <X size={20} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Loading({ text = "Gathering the stars…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{text}</p>
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <TriangleAlert size={20} />
      <div>
        {error instanceof Error ? error.message : String(error)}
        {retry && (
          <button className="text-link" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
