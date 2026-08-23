import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('has document', () => {
    expect(typeof document).toBe('object');
  });
});
