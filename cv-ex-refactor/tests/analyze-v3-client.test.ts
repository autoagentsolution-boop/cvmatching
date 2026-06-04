// Pure-logic tests for the v0.4 analyze client discriminator. Full fetch
// integration is exercised manually in dev — vitest is node-env without
// happy-dom or fetch-mock, so we only assert the pure type-guard here.

import { describe, it, expect } from 'vitest';
import {
  isNeedsRoleConfirm,
  type AnalyzeV3Response,
  type NeedsRoleConfirmResponse,
  type AnalyzeV3SuccessResponse,
} from '@/features/analyze/api-client';

describe('isNeedsRoleConfirm', () => {
  it('true when needsRoleConfirm: true is set', () => {
    const r: NeedsRoleConfirmResponse = {
      schemaVersion: 'v3',
      needsRoleConfirm: true,
      candidates: [{ canonical: 'X', confidence: 0.6 }],
    };
    expect(isNeedsRoleConfirm(r)).toBe(true);
  });

  it('false for a full success response', () => {
    const r = {
      schemaVersion: 'v3',
      targetRole: 'Senior Backend Engineer',
      overallScore: 82,
      decision: 'good',
      decisionLabel: 'Good Fit',
      summary: '...',
      cvVisibility: 70,
      realExperience: 80,
      risk: 30,
      screeningPass: 70,
      interviewReadiness: 75,
      atsKeyword: 60,
      metrics: [],
      strengths: [],
      gaps: [],
      redFlags: [],
      coverage: [],
      recommendations: [],
      keywordCoverage: { matched: [], partial: [], missing: [] },
    } as unknown as AnalyzeV3SuccessResponse;
    expect(isNeedsRoleConfirm(r)).toBe(false);
  });

  it('false when needsRoleConfirm field is absent', () => {
    const r = { schemaVersion: 'v3', overallScore: 50 } as unknown as AnalyzeV3Response;
    expect(isNeedsRoleConfirm(r)).toBe(false);
  });

  it('narrows the type at compile time', () => {
    const r: AnalyzeV3Response = {
      schemaVersion: 'v3',
      needsRoleConfirm: true,
      candidates: [{ canonical: 'A', confidence: 0.5 }],
    };
    if (isNeedsRoleConfirm(r)) {
      // type narrowed — candidates is accessible without cast
      expect(r.candidates[0]?.canonical).toBe('A');
    }
  });
});
