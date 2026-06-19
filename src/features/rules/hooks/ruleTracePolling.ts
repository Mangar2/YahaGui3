import type { MessageReason, MessageScalar, MessageTopicData } from '../../../domain/messages/interfaces';
import { MessageStoreClientError, type MessageStoreClient } from '../../../infrastructure/messages/messageStoreClient';

const TRACE_POLL_INTERVAL_MS = 1000;
const TRACE_POLL_TIMEOUT_MS = 60_000;
const TRACE_FRESHNESS_TOLERANCE_MS = 1000;

export interface RuleTracePollResponse {
  topic: string;
  value: string;
  time: string | null;
  reason: MessageReason[];
}

/**
 * Error used when no fresh trace response arrives within the polling timeout.
 */
export class RuleTraceTimeoutError extends Error {
  /**
   * Creates a timeout error for missing trace responses.
   * @param message Human-readable timeout message.
   */
  public constructor(message: string) {
    super(message);
    this.name = 'RuleTraceTimeoutError';
  }
}

/**
 * Polls the message-store for a fresh trace response newer than the trace-send timestamp.
 * @param messageStoreClient Message-store client instance.
 * @param responseTopic Exact trace response topic.
 * @param traceSentAtIso ISO timestamp from trace-send moment.
 * @param signal Abort signal for cancellation.
 * @returns {Promise<RuleTracePollResponse>} Fresh trace response payload.
 */
export async function pollRuleTraceResponse(
  messageStoreClient: MessageStoreClient,
  responseTopic: string,
  traceSentAtIso: string,
  signal: AbortSignal,
): Promise<RuleTracePollResponse> {
  const sentAtMillis = parseTimestampMillis(traceSentAtIso) ?? Date.now();
  const freshnessThresholdMillis = sentAtMillis - TRACE_FRESHNESS_TOLERANCE_MS;
  const deadlineMillis = Date.now() + TRACE_POLL_TIMEOUT_MS;

  let successfulPollCount = 0;
  let lastPollError: Error | null = null;

  while (Date.now() < deadlineMillis) {
    try {
      const payload = await messageStoreClient.loadTopicSection(
        responseTopic,
        {
          time: true,
          history: false,
          reason: true,
          levelAmount: 0,
        },
        signal,
      );

      successfulPollCount += 1;
      const freshNode = findFreshTraceNode(payload, responseTopic, freshnessThresholdMillis);
      if (freshNode !== null) {
        return {
          topic: freshNode.topic,
          value: stringifyMessageScalar(freshNode.value),
          time: typeof freshNode.time === 'string' ? freshNode.time : null,
          reason: Array.isArray(freshNode.reason) ? freshNode.reason : [],
        };
      }
    } catch (unknownError: unknown) {
      if (isAbortError(unknownError)) {
        throw unknownError;
      }

      if (unknownError instanceof Error) {
        lastPollError = unknownError;
      } else {
        lastPollError = new Error('Unbekannter Fehler beim Polling der Trace-Antwort.');
      }
    }

    await waitForNextPollTick(signal);
  }

  if (successfulPollCount === 0 && lastPollError !== null) {
    throw lastPollError;
  }

  throw new RuleTraceTimeoutError('Keine Trace-Antwort innerhalb von 60 Sekunden erhalten.');
}

/**
 * Finds a trace node with a timestamp newer than the requested freshness threshold.
 * @param payload Message-store payload.
 * @param responseTopic Topic expected for trace response.
 * @param freshnessThresholdMillis Inclusive lower bound for fresh timestamps.
 * @returns {MessageTopicData | null} Fresh matching node or null.
 */
function findFreshTraceNode(
  payload: MessageTopicData[],
  responseTopic: string,
  freshnessThresholdMillis: number,
): MessageTopicData | null {
  for (const node of payload) {
    if (node.topic !== responseTopic) {
      continue;
    }

    const freshestMillis = getFreshestNodeTimestampMillis(node);
    if (freshestMillis !== null && freshestMillis >= freshnessThresholdMillis) {
      return node;
    }
  }

  return null;
}

/**
 * Returns the newest timestamp available in a node (reason first, then node time).
 * @param node Message topic node.
 * @returns {number | null} Milliseconds timestamp or null when unavailable.
 */
function getFreshestNodeTimestampMillis(node: MessageTopicData): number | null {
  const nodeTimeMillis = parseTimestampMillis(node.time);
  const newestReasonMillis = getNewestReasonTimestampMillis(node.reason);

  if (nodeTimeMillis === null) {
    return newestReasonMillis;
  }
  if (newestReasonMillis === null) {
    return nodeTimeMillis;
  }

  return Math.max(nodeTimeMillis, newestReasonMillis);
}

/**
 * Reads the newest reason timestamp in milliseconds.
 * @param reasonList Optional reason list.
 * @returns {number | null} Newest timestamp or null.
 */
function getNewestReasonTimestampMillis(reasonList: MessageReason[] | undefined): number | null {
  if (!Array.isArray(reasonList) || reasonList.length === 0) {
    return null;
  }

  let newestMillis: number | null = null;
  for (const reasonEntry of reasonList) {
    const timestampMillis = parseTimestampMillis(reasonEntry.timestamp);
    if (timestampMillis === null) {
      continue;
    }

    if (newestMillis === null || timestampMillis > newestMillis) {
      newestMillis = timestampMillis;
    }
  }

  return newestMillis;
}

/**
 * Converts message scalar values into printable text.
 * @param value Raw message scalar.
 * @returns {string} Text representation.
 */
function stringifyMessageScalar(value: MessageScalar | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

/**
 * Parses timestamp strings into millisecond precision.
 * @param timestamp Timestamp string.
 * @returns {number | null} Parsed milliseconds or null.
 */
function parseTimestampMillis(timestamp: string | undefined): number | null {
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

/**
 * Waits exactly one polling interval unless the request is aborted.
 * @param signal Abort signal.
 * @returns {Promise<void>} Resolves after one interval.
 */
function waitForNextPollTick(signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = window.setTimeout((): void => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, TRACE_POLL_INTERVAL_MS);

    /**
     * Aborts the pending wait when polling is cancelled.
     */
    function onAbort(): void {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Checks whether an unknown error is an abort-related exception.
 * @param unknownError Unknown thrown value.
 * @returns {boolean} True when the error is AbortError.
 */
function isAbortError(unknownError: unknown): boolean {
  return unknownError instanceof Error && unknownError.name === 'AbortError';
}

/**
 * Formats polling errors for user-facing trace feedback.
 * @param unknownError Unknown polling error.
 * @returns {string} Human-readable trace error.
 */
export function formatTracePollingError(unknownError: unknown): string {
  if (unknownError instanceof RuleTraceTimeoutError) {
    return unknownError.message;
  }
  if (unknownError instanceof MessageStoreClientError) {
    return `Fehler beim Laden der Trace-Antwort: ${unknownError.message}`;
  }
  if (unknownError instanceof Error) {
    return `Fehler beim Laden der Trace-Antwort: ${unknownError.message}`;
  }

  return 'Fehler beim Laden der Trace-Antwort: Unbekannter Fehler';
}
