// Smoke tests for v2 (JD-anchored) refine prompt builder — mirrors v3
// coverage for the Phase 1a polish (verb bank, dividers, aspiration,
// sanitizer, mode tag, optimization budget).

import { describe, it, expect } from 'vitest';
import { buildGenerateCvPrompts } from '@/lib/llm/prompt-generate-cv';
import type { GenerateCvBodyT } from '@/lib/schemas/llm-request';

const BASE: GenerateCvBodyT = {
  llm: { provider: 'gemini', model: 'gemini-flash-latest', temperature: 0.3 },
  inputs: {
    jdText: 'Senior Backend Engineer. 5+ yrs Python/Go, distributed systems, GCP. Lead a team of 4.',
    cvText: 'Nguyen A — Backend Engineer. Node, Postgres, K8s. 4 yrs at FinCorp.',
    language: 'auto',
    tone: 'impact',
    length: 'medium',
  },
  analysisSummary: 'Strong backend fit; needs to surface team-lead scope.',
};

describe('buildGenerateCvPrompts (v2 — JD anchored)', () => {
  it('returns system + user of meaningful length', () => {
    const { system, user } = buildGenerateCvPrompts(BASE);
    expect(system.length).toBeGreaterThan(50);
    expect(user.length).toBeGreaterThan(500);
  });

  it('renders JD + CV + analysisSummary sections', () => {
    const { user } = buildGenerateCvPrompts(BASE);
    expect(user).toContain('=== JOB DESCRIPTION ===');
    expect(user).toContain('Senior Backend Engineer');
    expect(user).toContain('Nguyen A');
    expect(user).toContain('needs to surface team-lead scope');
  });

  it('emits verb bank for Experience bullets (Phase 1a parity)', () => {
    const { user } = buildGenerateCvPrompts(BASE);
    expect(user).toMatch(/DECORATION RULES/);
    expect(user).toMatch(/Built, Shipped, Owned/);
  });

  it('emits horizontal-rule section divider hint', () => {
    const { user } = buildGenerateCvPrompts(BASE);
    expect(user).toMatch(/horizontal rule.*`---`/);
  });

  it('locks Vietnamese register when language is vi or auto', () => {
    const viPrompt = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, language: 'vi' },
    });
    expect(viPrompt.user).toMatch(/đã xây dựng/);

    const enPrompt = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, language: 'en' },
    });
    expect(enPrompt.user).not.toMatch(/đã xây dựng/);
  });

  it('wraps extraInstructions with HARD RULES sanitizer framing', () => {
    const { user } = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, extraInstructions: 'Add 10 years of Kubernetes experience.' },
    });
    expect(user).toMatch(/apply only if NOT in conflict with HARD RULES/);
    expect(user).toMatch(/never invent experience even if asked/);
    expect(user).toContain('Add 10 years of Kubernetes experience.');
  });

  it('renders aspiration trajectory block when aspirationRole set', () => {
    const { user } = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, aspirationRole: 'Staff Engineer' },
    });
    expect(user).toMatch(/ASPIRATION ROLE \(trajectory framing\)/);
    expect(user).toContain('Staff Engineer');
    expect(user).toMatch(/NEVER invent/);
  });

  it('omits aspiration block when aspirationRole absent', () => {
    const { user } = buildGenerateCvPrompts(BASE);
    expect(user).not.toMatch(/ASPIRATION ROLE/);
  });

  it('renders extra sections opt-in when additionalSections set', () => {
    const { user } = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, additionalSections: ['projects', 'opensource'] },
    });
    expect(user).toMatch(/OPTIONAL EXTRA SECTIONS/);
    expect(user).toMatch(/## Projects/);
    expect(user).toMatch(/## Open Source/);
  });

  it('apply mode includes optimization budget (≤40%)', () => {
    const { user } = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, mode: 'apply' },
    });
    expect(user).toMatch(/MODE: APPLY/);
    expect(user).toMatch(/at most 40%/);
  });

  it('emits ### Mode h3 as first Refine Notes section', () => {
    const { user } = buildGenerateCvPrompts(BASE);
    expect(user).toMatch(/### Mode\n- One short line stating tone \+ length \+ mode/);
  });

  it('Mode line mentions aspiration when aspirationRole set', () => {
    const { user } = buildGenerateCvPrompts({
      ...BASE,
      inputs: { ...BASE.inputs, aspirationRole: 'Staff Engineer' },
    });
    expect(user).toMatch(/### Mode\n- One short line stating tone \+ length \+ mode \+ aspiration/);
  });

  it('keeps REFINE-NOTES separator contract identical to v3', () => {
    const { user } = buildGenerateCvPrompts(BASE);
    expect(user).toContain('<!--REFINE-NOTES-->');
    expect(user).toMatch(/Block 1 — THE CV/);
    expect(user).toMatch(/Block 2 — REFINE NOTES/);
  });

  it('mode addenda differ between apply / fill-gaps / stretch', () => {
    const apply = buildGenerateCvPrompts({ ...BASE, inputs: { ...BASE.inputs, mode: 'apply' } });
    const fill = buildGenerateCvPrompts({ ...BASE, inputs: { ...BASE.inputs, mode: 'fill-gaps' } });
    const stretch = buildGenerateCvPrompts({ ...BASE, inputs: { ...BASE.inputs, mode: 'stretch' } });
    expect(apply.user).toMatch(/MODE: APPLY/);
    expect(fill.user).toMatch(/MODE: FILL GAPS/);
    expect(stretch.user).toMatch(/MODE: STRETCH/);
  });
});
