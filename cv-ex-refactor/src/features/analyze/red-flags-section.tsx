import { Card } from '@/components/ui';

export interface RedFlagsSectionProps {
  redFlags: Array<{ flag: string; concern: string }>;
}

// Inline section for /analyze results. Returns null when empty to keep layout tight.
export function RedFlagsSection({ redFlags }: RedFlagsSectionProps) {
  if (!redFlags?.length) return null;

  return (
    <Card variant="default" padding="md" className="border-l-4 border-l-amber-500">
      <header className="mb-3 flex items-center gap-2">
        <span aria-hidden="true">🚩</span>
        <h3 className="font-display text-title-md font-bold text-on-surface">
          Cẩn trọng — {redFlags.length} điểm cần xem lại
        </h3>
      </header>
      <ul className="flex flex-col gap-3">
        {redFlags.map((rf, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            <p className="text-body-md font-semibold text-on-surface">{rf.flag}</p>
            <p className="text-body-sm text-on-surface-variant">{rf.concern}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
