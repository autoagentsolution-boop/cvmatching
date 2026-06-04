// MustHaveBlock render-shape unit tests (no RTL — vitest is node-env).
// Asserts the function returns null vs JSX element for the conditional-render
// contract. Visual fidelity is covered by manual smoke in dev.

import { describe, it, expect } from 'vitest';
import { MustHaveBlock } from '@/features/job-fit/must-have-block';

describe('MustHaveBlock', () => {
  it('returns null when mustHaves is undefined', () => {
    expect(MustHaveBlock({ mustHaves: undefined })).toBeNull();
  });

  it('returns null when mustHaves is empty array', () => {
    expect(MustHaveBlock({ mustHaves: [] })).toBeNull();
  });

  it('returns a React element when mustHaves has items', () => {
    const out = MustHaveBlock({ mustHaves: ['5+ years Node.js', 'AWS production'] });
    expect(out).not.toBeNull();
    expect(typeof out).toBe('object');
  });
});
