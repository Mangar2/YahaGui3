import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageStoreClient } from './messageStoreClient';
import { MessagePublishClient } from './messagePublishClient';

afterEach((): void => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('infrastructure API contract legacy parity', (): void => {
  it('sends message-store GET with legacy headers and topic path', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify([{ topic: 'home/room/light', value: 'off' }]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new MessageStoreClient('http://localhost:8080', '/store');
    await client.loadTopicSection('home/room/light', {
      time: true,
      history: false,
      reason: true,
      levelAmount: 7,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/store/home/room/light');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({
      levelamount: '7',
      time: 'true',
      history: 'false',
      reason: 'true',
    });
  });

  it('publishes to topic + set suffix and includes browser reason payload', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => {
      return new Response('puback', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const loadSpy = vi.spyOn(MessageStoreClient.prototype, 'loadTopicSection').mockResolvedValue([
      { topic: 'home/room/light', value: 'on' },
    ]);

    const client = new MessagePublishClient('http://localhost:8080', '/publish', '/store', '/set');
    await client.publishChange('home/room/light', 'on', 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/publish');
    expect(init.method).toBe('POST');

    const parsedBody = JSON.parse(String(init.body)) as {
      topic: string;
      value: string;
      reason: Array<{ message: string; timestamp: string }>;
    };

    expect(parsedBody.topic).toBe('home/room/light/set');
    expect(parsedBody.value).toBe('on');
    expect(parsedBody.reason[0]?.message).toBe('request by browser');
    expect(typeof parsedBody.reason[0]?.timestamp).toBe('string');
    expect(loadSpy).toHaveBeenCalledWith(
      'home/room/light',
      {
        time: false,
        history: false,
        reason: false,
        levelAmount: 0,
      },
    );
  });
});
