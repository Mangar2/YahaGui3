import { describe, expect, it } from 'vitest';
import { hasMatchingValue } from './messagePublishClient';
import type { MessageTopicData } from '../../domain/messages/interfaces';

describe('hasMatchingValue legacy parity', (): void => {
  it('accepts only exact value equality for the requested topic', (): void => {
    const payload: MessageTopicData[] = [
      { topic: 'home/room/light', value: 'off' },
    ];

    expect(hasMatchingValue(payload, 'home/room/light', 'off')).toBe(true);
    expect(hasMatchingValue(payload, 'home/room/light', 'on')).toBe(false);
  });

  it('does not treat switch-like synonyms as equal states', (): void => {
    const payloadZero: MessageTopicData[] = [{ topic: 'home/room/light', value: '0' }];
    const payloadOne: MessageTopicData[] = [{ topic: 'home/room/light', value: '1' }];

    expect(hasMatchingValue(payloadZero, 'home/room/light', 'off')).toBe(false);
    expect(hasMatchingValue(payloadOne, 'home/room/light', 'on')).toBe(false);
  });

  it('matches only the targeted topic entry', (): void => {
    const payload: MessageTopicData[] = [
      { topic: 'home/room/light', value: 'off' },
      { topic: 'home/room/socket', value: 'on' },
    ];

    expect(hasMatchingValue(payload, 'home/room/socket', 'on')).toBe(true);
    expect(hasMatchingValue(payload, 'home/room/socket', 'off')).toBe(false);
  });
});
