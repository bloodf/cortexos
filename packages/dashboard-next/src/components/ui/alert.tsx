import * as React from "react";
import { Banner as AstryxBanner } from "@astryxdesign/core/Banner";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

function isAlertTitleElement(
  child: React.ReactNode,
): child is React.ReactElement<React.HTMLAttributes<HTMLElement>> {
  return React.isValidElement(child) && child.type === AlertTitle;
}

function isAlertDescriptionElement(
  child: React.ReactNode,
): child is React.ReactElement<React.HTMLAttributes<HTMLElement>> {
  return React.isValidElement(child) && child.type === AlertDescription;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const status = variant === "destructive" ? "error" : "info";

    let titleNode: React.ReactNode = null;
    let descriptionNode: React.ReactNode = null;
    const restChildren: React.ReactNode[] = [];

    React.Children.forEach(children, (child) => {
      if (isAlertTitleElement(child)) {
        titleNode = child.props.children;
      } else if (isAlertDescriptionElement(child)) {
        descriptionNode = child.props.children;
      } else {
        restChildren.push(child);
      }
    });

    return (
      <AstryxBanner
        ref={ref}
        status={status}
        title={titleNode ?? ""}
        description={descriptionNode}
        className={cn(className)}
        {...props}
      >
        {restChildren.length > 0 ? restChildren : null}
      </AstryxBanner>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h5>
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props}>
    {children}
  </div>
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
