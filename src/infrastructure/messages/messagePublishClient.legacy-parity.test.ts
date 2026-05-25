import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessagePublishClient, hasMatchingValue, hasMatchingValueInTree } from './messagePublishClient';
import { MessageStoreClient } from './messageStoreClient';
import { createEmptyMessageTree, replaceManyNodes } from '../../domain/messages/messageTree';
import { getMessageRuntimeStore } from '../../domain/messages/messageRuntimeStore';
import type { MessageTopicData } from '../../domain/messages/interfaces';

afterEach((): void => {
  getMessageRuntimeStore().reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe('tree-based publish verification parity', (): void => {
  it('matches expected value from continuously updated verification tree', (): void => {
    const firstPayload: MessageTopicData[] = [{ topic: 'home/room/socket', value: 'off' }];
    const secondPayload: MessageTopicData[] = [{ topic: 'home/room/light', value: 'on' }];

    let verificationTree = createEmptyMessageTree();
    verificationTree = replaceManyNodes(verificationTree, firstPayload);
    expect(hasMatchingValueInTree(verificationTree, 'home/room/light', 'on')).toBe(false);

    verificationTree = replaceManyNodes(verificationTree, secondPayload);
    expect(hasMatchingValueInTree(verificationTree, 'home/room/light', 'on')).toBe(true);
  });

  it('notifies all registered waiters through the central runtime callback mechanism', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => {
      return new Response('puback', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const timeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((handler: TimerHandler): ReturnType<typeof setTimeout> => {
        if (typeof handler === 'function') {
          handler();
        }
        return 0 as ReturnType<typeof setTimeout>;
      });

    const loadSpy = vi.spyOn(MessageStoreClient.prototype, 'loadTopicSection').mockResolvedValue([
      { topic: 'home/room/light', value: 'on' },
    ]);

    const waiterSpy = vi.fn();
    const unregister = getMessageRuntimeStore().registerWaiter(
      (snapshot): boolean => hasMatchingValueInTree(snapshot, 'home/room/light', 'on'),
      (_snapshot, payload): void => {
        waiterSpy(payload);
      },
    );

    const client = new MessagePublishClient('http://localhost:8080', '/publish', '/store', '/set');

    await client.publishChange('home/room/light', 'on', 1);
    unregister();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(waiterSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('allows button verification by on/off equivalence instead of exact string equality', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => {
      return new Response('puback', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler: TimerHandler): ReturnType<typeof setTimeout> => {
      if (typeof handler === 'function') {
        handler();
      }
      return 0 as ReturnType<typeof setTimeout>;
    });

    const loadSpy = vi
      .spyOn(MessageStoreClient.prototype, 'loadTopicSection')
      .mockResolvedValueOnce([{ topic: 'home/room/light', value: '1234' }])
      .mockResolvedValueOnce([{ topic: 'home/room/light', value: 'on' }]);

    const client = new MessagePublishClient('http://localhost:8080', '/publish', '/store', '/set');

    await client.publishChange('home/room/light', 'on', 5, {
      matchesExpectedValue: (actualValue: string | null): boolean => actualValue !== null && actualValue !== 'off',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });
});
