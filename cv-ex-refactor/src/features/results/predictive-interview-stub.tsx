import { EmptyState } from '@/components/ui';

/**
 * Locked decision #1: render EmptyState only — no LLM call.
 * Predictive Interview Questions are scoped to Phase 2.
 */
export function PredictiveInterviewStub() {
  return (
    <EmptyState
      title="Predictive Interview Questions"
      description="Available in Phase 2 — interview questions tailored to your fit gaps will appear here."
    />
  );
}
