"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-describedby"?: string;
}

function onlyDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  id,
  "aria-describedby": ariaDescribedBy,
}: OtpInputProps) {
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const hasCalledCompleteRef = React.useRef(false);

  const digits = React.useMemo(() => {
    const chars = onlyDigits(value).slice(0, length).split("");
    return Array.from({ length }, (_, i) => chars[i] ?? "");
  }, [value, length]);

  React.useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusInput = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    inputRefs.current[clamped]?.focus();
  };

  const emitChange = (nextDigits: string[]) => {
    const nextValue = nextDigits.join("");
    onChange(nextValue);

    const isComplete = onlyDigits(nextValue).length === length && nextValue.length === length;
    if (isComplete && !hasCalledCompleteRef.current) {
      hasCalledCompleteRef.current = true;
      onComplete?.(nextValue);
    } else if (!isComplete) {
      hasCalledCompleteRef.current = false;
    }
  };

  const distributeFrom = (startIndex: number, rawInput: string) => {
    const incoming = onlyDigits(rawInput);
    if (incoming.length === 0) return;

    const nextDigits = [...digits];
    let cursor = startIndex;

    for (let i = 0; i < incoming.length && cursor < length; i++, cursor++) {
      nextDigits[cursor] = incoming[i];
    }

    emitChange(nextDigits);

    const lastFilledIndex = Math.min(cursor, length - 1);
    focusInput(lastFilledIndex);
  };

  const handleChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = event.target.value;
    const incoming = onlyDigits(rawInput);

    if (incoming.length === 0) {
      // Cleared this box (or non-digit input stripped away entirely).
      const nextDigits = [...digits];
      nextDigits[index] = "";
      emitChange(nextDigits);
      return;
    }

    if (incoming.length > 1) {
      // Multiple characters landed in one box (paste-into-onChange or fast
      // typing/autofill). Distribute starting at this box, same as paste.
      distributeFrom(index, incoming);
      return;
    }

    // Single digit typed: set it and move to the next box.
    const nextDigits = [...digits];
    nextDigits[index] = incoming;
    emitChange(nextDigits);

    if (index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (digits[index]) {
        // Filled box: clear it in place.
        event.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index] = "";
        emitChange(nextDigits);
        return;
      }

      // Empty box: move to previous box and clear it.
      if (index > 0) {
        event.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index - 1] = "";
        emitChange(nextDigits);
        focusInput(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusInput(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusInput(index + 1);
      return;
    }
  };

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;
    event.preventDefault();
    distributeFrom(index, pasted);
  };

  return (
    <div
      role="group"
      aria-label="Verification code"
      className="flex flex-row gap-2 sm:gap-3"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          id={index === 0 ? id : undefined}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error || undefined}
          maxLength={length}
          disabled={disabled}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "h-10 w-9 rounded-xl border border-input bg-background text-center text-base font-medium text-foreground shadow-sm transition-colors sm:h-12 sm:w-12 sm:text-lg md:h-14 md:w-14 md:text-xl",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            error && "border-destructive focus:ring-destructive",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
      ))}
    </div>
  );
}
