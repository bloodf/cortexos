import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  asChild?: boolean;
}

function nodeToText(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (React.isValidElement<{ children?: React.ReactNode }>(node) && node.type === React.Fragment) {
    return childrenToLabel(node.props.children);
  }
  return "";
}

function childrenToLabel(children: React.ReactNode): string {
  if (children == null) return "Button";
  const text = React.Children.toArray(children).map(nodeToText).join("").trim();
  return text || "Button";
}

/**
 * Compatibility wrapper that renders Astryx buttons for the common case and
 * falls back to the original Tailwind-styled button when `asChild` is used
 * (Astryx Button does not support polymorphic children).
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      const Comp = Slot;
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    const label = props["aria-label"] ?? childrenToLabel(children);

    const isPrimary =
      variant !== "destructive" &&
      variant !== "outline" &&
      variant !== "secondary" &&
      variant !== "ghost" &&
      variant !== "link";

    const astryxVariant =
      variant === "destructive"
        ? "destructive"
        : variant === "outline" || variant === "secondary"
          ? "secondary"
          : variant === "ghost" || variant === "link"
            ? "ghost"
            : "primary";

    const astryxSize = size === "lg" ? "lg" : size === "sm" ? "sm" : "md";
    const isIconOnly = size === "icon";

    // Forest green CTA override for primary buttons (Accent 1 stays dark teal).
    const accentStyle = isPrimary
      ? ({ "--color-accent": "#3E5641" } as React.CSSProperties)
      : undefined;

    if (isIconOnly) {
      return (
        <IconButton
          icon={children}
          label={props["aria-label"] || label}
          variant={astryxVariant}
          size={astryxSize}
          className={className}
          style={accentStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={ref as any}
          {...props}
        />
      );
    }

    return (
      <AstryxButton
        label={label}
        variant={astryxVariant}
        size={astryxSize}
        className={className}
        style={accentStyle}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        {...props}
      >
        {children}
      </AstryxButton>
    );
  },
);
Button.displayName = "Button";

export { Button };
