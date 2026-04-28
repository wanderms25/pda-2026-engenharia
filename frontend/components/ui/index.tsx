import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// BUTTON
// =============================================================================
type ButtonVariant =
  | "default"
  | "primary"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "success";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  default:
    "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 active:scale-[0.98]",
  primary:
    "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 active:scale-[0.98]",
  destructive:
    "bg-danger text-danger-foreground shadow-glow-danger hover:opacity-90 active:scale-[0.98]",
  outline:
    "border border-border bg-background-alt/50 backdrop-blur hover:bg-card hover:border-primary/40 text-foreground",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-card hover:text-foreground text-foreground-muted",
  success:
    "bg-success text-success-foreground shadow-glow-success hover:opacity-90 active:scale-[0.98]",
};

const buttonSizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3 text-xs",
  lg: "h-12 rounded-lg px-6 text-base",
  icon: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant as ButtonVariant],
        buttonSizes[size as ButtonSize],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

// =============================================================================
// CARD
// =============================================================================
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-border-subtle bg-card text-card-foreground shadow-card",
      "transition-colors duration-150",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-row space-y-1.5 p-5 sm:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base sm:text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm text-foreground-muted", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 sm:p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 sm:p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// =============================================================================
// INPUT
// =============================================================================
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg border border-border bg-background-alt px-3.5 py-2 text-sm",
      "transition-all duration-150",
      "placeholder:text-foreground-muted",
      "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

// =============================================================================
// LABEL
// =============================================================================
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-medium leading-none text-foreground-muted uppercase tracking-wide mb-1.5 block",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

// =============================================================================
// SELECT (nativo estilizado)
// =============================================================================
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full appearance-none rounded-lg border border-border bg-background-alt px-3.5 pr-10 py-2 text-sm",
        "transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <svg
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </div>
));
Select.displayName = "Select";

// =============================================================================
// BADGE
// =============================================================================
type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "outline"
  | "primary";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/10 text-primary border border-primary/20",
  success: "bg-success-muted text-success border border-success/30",
  warning: "bg-warning-muted text-warning border border-warning/30",
  danger: "bg-danger-muted text-danger border border-danger/30",
  outline: "border border-border text-foreground-muted",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant | string;
  className?: string;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        (badgeVariants as Record<string,string>)[variant ?? "default"],
        className,
      )}
      {...props}
    />
  );
}

// =============================================================================
// STAT CARD — card especializado para mostrar métricas numéricas
// =============================================================================
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  accent?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  accent = "primary",
  className,
  ...props
}: StatCardProps) {
  const accentColors = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <Card
      className={cn("relative overflow-hidden group", className)}
      {...props}
    >
      {/* Efeito de brilho sutil no hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-foreground-muted font-medium mb-2">
              {label}
            </p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">
              {value}
            </p>
            {trend && (
              <p className={cn("text-xs mt-1.5", accentColors[accent])}>
                {trend}
              </p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "w-10 h-10 rounded-lg bg-background-alt flex items-center justify-center shrink-0",
                accentColors[accent],
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}