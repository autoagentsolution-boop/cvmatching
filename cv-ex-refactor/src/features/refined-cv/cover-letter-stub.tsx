import { Badge, Button, Card } from '@/components/ui';

/**
 * Cover Letter stub — visual Phase 2 placeholder.
 * Rendered in the Refined CV aside. Button is disabled with Phase 2 affordance.
 */
export function CoverLetterStub() {
  return (
    <Card padding="md" className="relative overflow-hidden bg-primary-container">
      {/* Decorative background icon */}
      <span
        className="material-symbols-outlined absolute -bottom-3 -right-3 select-none text-[80px] text-on-primary-container/10"
        aria-hidden="true"
      >
        auto_awesome
      </span>

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px] text-on-primary-container"
            aria-hidden="true"
          >
            lightbulb
          </span>
          <h3 className="text-label-md font-bold text-on-primary-container">
            Generate Cover Letter
          </h3>
        </div>

        <p className="text-label-sm text-on-primary-container/80 leading-relaxed">
          AI-tailored cover letter from your refined CV. Consider a custom cover letter for a
          2.5× higher interview rate.
        </p>

        <div className="flex items-center gap-2">
          <span title="Available in Phase 2">
            <Button variant="secondary" size="sm" disabled>
              Generate
            </Button>
          </span>
          <Badge variant="info" size="sm">
            Phase 2
          </Badge>
        </div>
      </div>
    </Card>
  );
}
