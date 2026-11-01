import { describe, expect, it } from 'vitest';
import { sourceLabel } from './source-label';

describe('sourceLabel', () => {
  it('returns Replay for replay sources', () => {
    expect(sourceLabel({ providerId: 'replay', label: 'Replay', kind: 'replay' })).toBe('Replay');
  });
  it('prefixes live sources with Live', () => {
    expect(sourceLabel({ providerId: 'apitennis', label: 'api-tennis', kind: 'live' })).toBe(
      'Live · api-tennis',
    );
  });
});
