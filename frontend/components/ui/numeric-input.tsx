"use client";
import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  value: string | number;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
  unidade?: string;
}

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, allowDecimal = true, unidade, className, ...props }, ref) => {
    function handle(e: React.ChangeEvent<HTMLInputElement>) {
      let raw = e.target.value.replace(",", ".");
      if (allowDecimal) {
        raw = raw.replace(/[^0-9.]/g, "");
        const parts = raw.split(".");
        if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
      } else {
        raw = raw.replace(/\D/g, "");
      }
      onChange(raw);
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode={allowDecimal ? "decimal" : "numeric"}
          value={value}
          onChange={handle}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
            "transition-colors placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            unidade && "pr-10",
            className
          )}
          {...props}
        />
        {unidade && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none select-none">
            {unidade}
          </span>
        )}
      </div>
    );
  }
);

NumericInput.displayName = "NumericInput";
export default NumericInput;
