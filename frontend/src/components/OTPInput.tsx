import { useState, useRef, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export default function OTPInput({
  length = 4,
  onComplete,
  disabled = false,
  hasError = false,
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;

    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all inputs are filled
    if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === length) {
      onComplete(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Move to previous input on backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);

    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length && i < length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);

      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[nextIndex]?.focus();

      // Check if all inputs are filled
      if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === length) {
        onComplete(newOtp.join(''));
      }
    }
  };

  return (
    <div className="flex gap-2.5 sm:gap-3 justify-center">
      {otp.map((digit, index) => {
        const isFilled = Boolean(digit);
        return (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`w-12 h-13 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-bold font-price rounded-xl border-2 transition-all duration-200 outline-none select-none ${
              hasError
                ? 'border-[var(--brand-error,#D6402F)] bg-red-50/60 text-[var(--brand-error,#D6402F)] focus:border-[var(--brand-error,#D6402F)] focus:ring-4 focus:ring-red-100'
                : isFilled
                ? 'border-[var(--brand-green,#236B34)] bg-[var(--brand-leaf-tint,#EAF5E0)]/40 text-[var(--brand-ink,#1C2B20)] shadow-sm'
                : 'border-[var(--brand-border,#E9E2D3)] bg-white text-[var(--brand-ink,#1C2B20)] hover:border-neutral-300'
            } focus:border-[var(--brand-green,#236B34)] focus:ring-4 focus:ring-[var(--brand-leaf,#5FA82E)]/20 focus:bg-white focus:scale-[1.03] disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:border-neutral-200`}
            aria-label={`Digit ${index + 1}`}
          />
        );
      })}
    </div>
  );
}

