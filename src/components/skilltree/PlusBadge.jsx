// The yellow "+N" contribution indicator on derived resource rows.
export function PlusBadge({ value }) {
  const v = Number(value) || 0;
  if (v === 0) return null;
  return (
    <span className="text-[10px] font-semibold text-amber-400">
      {v > 0 ? `+${v}` : String(v)}
    </span>
  );
}