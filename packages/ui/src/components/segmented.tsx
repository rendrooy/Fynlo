"use client";

interface SegmentedProps<T extends string> {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}

export function Segmented<T extends string>({
  label,
  onChange,
  options,
  value,
}: SegmentedProps<T>) {
  return (
    <div aria-label={label} className="segmented" role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={option.value === value ? "active" : undefined}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
