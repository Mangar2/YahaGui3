import { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyMessageTree, getNodeByTopicChunks, replaceManyNodes } from '../../../domain/messages/messageTree';
import type { MessageTreeNode } from '../../../domain/messages/interfaces';
import { splitTopic } from '../../../domain/messages/topicPath';
import { MessageStoreClient, MessageStoreClientError } from '../../../infrastructure/messages/messageStoreClient';
import { MessagePublishClient, MessagePublishClientError } from '../../../infrastructure/messages/messagePublishClient';
import {
  getMessageStoreBaseUrl,
  getMessageStorePath,
  getPublishBaseUrl,
  getPublishPath,
  getPublishTopicSetSuffix,
} from '../../../config/runtime';

const DETAIL_INITIAL_LEVEL_AMOUNT = 1;
const DETAIL_POLL_LEVEL_AMOUNT = 0;
const DETAIL_REFRESH_INTERVAL_MS = 2000;

export interface DetailTopicControllerState {
  activeNode: MessageTreeNode | null;
  isLoading: boolean;
  isUpdatingTopic: boolean;
  lastRefreshIso: string | null;
  error: string | null;
  publishValueChange: (newValue: string) => Promise<void>;
}

/**
 * Controls detail-topic loading, polling and publishing.
 * @param topic Full topic path currently shown in detail view.
 * @returns {DetailTopicControllerState} Reactive state and actions for the detail page.
 */
export function useDetailTopicController(topic: string): DetailTopicControllerState {
  const topicChunks = useMemo((): string[] => splitTopic(topic), [topic]);

  const storeClientRef = useRef<MessageStoreClient>(
    new MessageStoreClient(getMessageStoreBaseUrl(), getMessageStorePath()),
  );
  const publishClientRef = useRef<MessagePublishClient>(
    new MessagePublishClient(
      getPublishBaseUrl(),
      getPublishPath(),
      getMessageStorePath(),
      getPublishTopicSetSuffix(),
    ),
  );

  const treeRef = useRef<MessageTreeNode>(createEmptyMessageTree());
  const topicRef = useRef<string>(topic);
  const refreshRunningRef = useRef<boolean>(false);
  const isUpdatingRef = useRef<boolean>(false);

  const [tree, setTree] = useState<MessageTreeNode>(createEmptyMessageTree());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingTopic, setIsUpdatingTopic] = useState<boolean>(false);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeNode = useMemo((): MessageTreeNode | null => {
    return getNodeByTopicChunks(tree, topicChunks);
  }, [tree, topicChunks]);

  useEffect((): void => {
    treeRef.current = tree;
  }, [tree]);

  useEffect((): void => {
    topicRef.current = topic;
  }, [topic]);

  useEffect((): void => {
    isUpdatingRef.current = isUpdatingTopic;
  }, [isUpdatingTopic]);

  useEffect((): void => {
    setTree(createEmptyMessageTree());
  }, [topic]);

  useEffect((): (() => void) => {
    let cancelled = false;

    /**
     * Loads complete detail data including history and direct children.
     * @returns {Promise<void>}
     */
    async function loadInitialDetailNode(): Promise<void> {
      setIsLoading(true);
      if (topic.trim().length === 0) {
        setIsLoading(false);
        setError('Kein Detail-Thema ausgewaehlt.');
        return;
      }

      try {
        const payload = await storeClientRef.current.loadTopicSection(topic, {
          time: true,
          history: true,
          reason: true,
          levelAmount: DETAIL_INITIAL_LEVEL_AMOUNT,
        });
        if (cancelled) {
          return;
        }

        const nextTree = replaceManyNodes(createEmptyMessageTree(), payload);
        setTree(nextTree);
        setLastRefreshIso(new Date().toISOString());
        setError(null);
      } catch (unknownError: unknown) {
        if (!cancelled) {
          setError(formatDetailLoadError(unknownError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialDetailNode();

    return (): void => {
      cancelled = true;
    };
  }, [topic]);

  useEffect((): (() => void) => {
    const intervalId = window.setInterval((): void => {
      if (refreshRunningRef.current || isUpdatingRef.current || topicRef.current.trim().length === 0) {
        return;
      }

      void (async (): Promise<void> => {
        refreshRunningRef.current = true;
        try {
          const currentTopic = topicRef.current;
          const currentTopicChunks = splitTopic(currentTopic);
          const oldNode = getNodeByTopicChunks(treeRef.current, currentTopicChunks);
          const oldTime = oldNode?.time;

          const valuePayload = await storeClientRef.current.loadTopicSection(currentTopic, {
            time: true,
            history: false,
            reason: true,
            levelAmount: DETAIL_POLL_LEVEL_AMOUNT,
          });

          let nextTree = replaceManyNodes(treeRef.current, valuePayload);
          const refreshedNode = getNodeByTopicChunks(nextTree, currentTopicChunks);
          const hasTimestampUpdate =
            typeof refreshedNode?.time === 'string' &&
            refreshedNode.time.length > 0 &&
            refreshedNode.time !== oldTime;

          if (hasTimestampUpdate) {
            const historyPayload = await storeClientRef.current.loadTopicSection(currentTopic, {
              time: true,
              history: true,
              reason: true,
              levelAmount: DETAIL_POLL_LEVEL_AMOUNT,
            });
            nextTree = replaceManyNodes(nextTree, historyPayload);
          }

          setTree(nextTree);
          setLastRefreshIso(new Date().toISOString());
          setError(null);
        } catch (unknownError: unknown) {
          setError(formatDetailLoadError(unknownError));
        } finally {
          refreshRunningRef.current = false;
        }
      })();
    }, DETAIL_REFRESH_INTERVAL_MS);

    return (): void => {
      window.clearInterval(intervalId);
    };
  }, []);

  /**
   * Publishes a new value and refreshes detail node afterwards.
   * @param newValue New value to publish.
   * @returns {Promise<void>}
   */
  async function publishValueChange(newValue: string): Promise<void> {
    if (topic.trim().length === 0 || isUpdatingRef.current) {
      return;
    }

    setIsUpdatingTopic(true);
    try {
      await publishClientRef.current.publishChange(topic, newValue);

      const payload = await storeClientRef.current.loadTopicSection(topic, {
        time: true,
        history: true,
        reason: true,
        levelAmount: DETAIL_INITIAL_LEVEL_AMOUNT,
      });
      setTree((currentTree: MessageTreeNode): MessageTreeNode => {
        return replaceManyNodes(currentTree, payload);
      });
      setLastRefreshIso(new Date().toISOString());
      setError(null);
    } catch (unknownError: unknown) {
      setError(formatDetailPublishError(unknownError));
    } finally {
      setIsUpdatingTopic(false);
    }
  }

  return {
    activeNode,
    isLoading,
    isUpdatingTopic,
    lastRefreshIso,
    error,
    publishValueChange,
  };
}

/**
 * Converts unknown detail-load errors into user-facing messages.
 * @param unknownError Unknown error value.
 * @returns {string} Normalized error message.
 */
function formatDetailLoadError(unknownError: unknown): string {
  if (unknownError instanceof MessageStoreClientError) {
    return `Fehler beim Laden der Detaildaten: ${unknownError.message}`;
  }
  if (unknownError instanceof Error) {
    return `Fehler beim Laden der Detaildaten: ${unknownError.message}`;
  }
  return 'Fehler beim Laden der Detaildaten: Unbekannter Fehler';
}

/**
 * Converts unknown publish errors into user-facing messages.
 * @param unknownError Unknown error value.
 * @returns {string} Normalized error message.
 */
function formatDetailPublishError(unknownError: unknown): string {
  if (unknownError instanceof MessagePublishClientError) {
    return `Fehler beim Publish in der Detailansicht: ${unknownError.message}`;
  }
  if (unknownError instanceof Error) {
    return `Fehler beim Publish in der Detailansicht: ${unknownError.message}`;
  }
  return 'Fehler beim Publish in der Detailansicht: Unbekannter Fehler';
}
