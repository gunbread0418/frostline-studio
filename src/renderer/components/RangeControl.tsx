interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange(value: number): void;
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '%',
  onChange,
}: RangeControlProps) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>{value}{suffix}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

