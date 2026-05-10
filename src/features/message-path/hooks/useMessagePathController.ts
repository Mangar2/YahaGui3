import { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyMessageTree, getNodeByTopicChunks, replaceManyNodes } from '../../../domain/messages/messageTree';
import type { MessageStoreDirectRequest, MessageTreeNode, MessageTopicData } from '../../../domain/messages/interfaces';
import { joinTopic, splitTopic } from '../../../domain/messages/topicPath';
import { MessageStoreClient, MessageStoreClientError } from '../../../infrastructure/messages/messageStoreClient';
import { getMessageStoreBaseUrl } from '../../../config/runtime';
import { useTopicQueryState } from './useTopicQueryState';

export interface MessagePathControllerState {
  topicChunks: string[];
  activeNode: MessageTreeNode | null;
  navItems: string[];
  isLoading: boolean;
  lastRefreshIso: string | null;
  error: string | null;
  navigateToDepth: (depth: number) => void;
  selectNavItem: (navItem: string) => void;
}

const OVERVIEW_LEVEL_AMOUNT = 7;
const OVERVIEW_REFRESH_INTERVAL_MS = 2000;
const MAX_POST_FAILURES_BEFORE_FULL_RESYNC = 2;
const OVERVIEW_INCLUDE_HISTORY = false;
const OVERVIEW_INCLUDE_REASON = false;

/**
 * Controls loading and refreshing the currently active message path.
 * @returns {MessagePathControllerState} Reactive state for breadcrumb path and topic loading.
 */
export function useMessagePathController(): MessagePathControllerState {
  const [topic, setTopic] = useTopicQueryState();
  const topicChunks = useMemo((): string[] => splitTopic(topic), [topic]);

  const clientRef = useRef<MessageStoreClient>(new MessageStoreClient(getMessageStoreBaseUrl()));
  const refreshRunningRef = useRef<boolean>(false);
  const topicChunksRef = useRef<string[]>(topicChunks);
  const messageTreeRef = useRef<MessageTreeNode>(createEmptyMessageTree());
  const consecutivePostFailuresRef = useRef<number>(0);

  const [messageTree, setMessageTree] = useState<MessageTreeNode>(createEmptyMessageTree());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);
  const [consecutivePostFailures, setConsecutivePostFailures] = useState<number>(0);

  const activeNode = useMemo((): MessageTreeNode | null => {
    return getNodeByTopicChunks(messageTree, topicChunks);
  }, [messageTree, topicChunks]);

  const navItems = useMemo((): string[] => {
    return buildNavItems(topicChunks, activeNode);
  }, [topicChunks, activeNode]);

  useEffect((): void => {
    topicChunksRef.current = topicChunks;
  }, [topicChunks]);

  useEffect((): void => {
    messageTreeRef.current = messageTree;
  }, [messageTree]);

  useEffect((): void => {
    consecutivePostFailuresRef.current = consecutivePostFailures;
  }, [consecutivePostFailures]);

  useEffect((): void => {
    let cancelled = false;

    /**
     * Loads the current overview section once after topic change.
     * @returns {Promise<void>}
     */
    async function runInitialLoad(): Promise<void> {
      setIsLoading(true);
      try {
        const payload = await fetchOverviewSection(clientRef.current, topicChunks);
        if (cancelled) {
          return;
        }
        setMessageTree((currentTree: MessageTreeNode): MessageTreeNode => replaceManyNodes(currentTree, payload));
        setLastRefreshIso(new Date().toISOString());
        setConsecutivePostFailures(0);
        setError(null);
      } catch (unknownError: unknown) {
        if (cancelled) {
          return;
        }
        setError(formatLoadError(unknownError));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void runInitialLoad();

    return (): void => {
      cancelled = true;
    };
  }, [topicChunks]);

  useEffect((): (() => void) => {
    const intervalId = window.setInterval((): void => {
      if (refreshRunningRef.current) {
        return;
      }

      void (async (): Promise<void> => {
        refreshRunningRef.current = true;
        try {
          const currentTopicChunks = topicChunksRef.current;
          const currentNode = getNodeByTopicChunks(messageTreeRef.current, currentTopicChunks);
          const requestNodes = determineRequestNodes(currentNode, OVERVIEW_INCLUDE_HISTORY, OVERVIEW_INCLUDE_REASON);
          const request: MessageStoreDirectRequest = {
            topic: joinTopic(currentTopicChunks),
            history: OVERVIEW_INCLUDE_HISTORY,
            reason: OVERVIEW_INCLUDE_REASON,
            levelAmount: OVERVIEW_LEVEL_AMOUNT,
            nodes: requestNodes,
          };

          const payload = await refreshOverviewSection(
            clientRef.current,
            request,
            consecutivePostFailuresRef.current,
            currentTopicChunks,
          );
          setMessageTree((currentTree: MessageTreeNode): MessageTreeNode => replaceManyNodes(currentTree, payload));
          setLastRefreshIso(new Date().toISOString());
          setConsecutivePostFailures(0);
          setError(null);
        } catch (unknownError: unknown) {
          setConsecutivePostFailures((previousFailures: number): number => previousFailures + 1);
          setError(formatLoadError(unknownError));
        } finally {
          refreshRunningRef.current = false;
        }
      })();
    }, OVERVIEW_REFRESH_INTERVAL_MS);

    return (): void => {
      window.clearInterval(intervalId);
    };
  }, []);

  /**
   * Navigates to a breadcrumb depth, equivalent to legacy header behavior.
   * @param depth Amount of topic chunks to keep.
   */
  function navigateToDepth(depth: number): void {
    const nextTopic = joinTopic(topicChunks.slice(0, depth));
    setTopic(nextTopic);
  }

  /**
   * Selects a side navigation item using the legacy overview logic.
   * @param navItem Selected navigation item.
   */
  function selectNavItem(navItem: string): void {
    const currentChunk = topicChunks.at(-1);
    const nextTopicChunks = [...topicChunks];
    let changed = false;

    if (navItem === '<') {
      nextTopicChunks.pop();
      changed = true;
    } else if (navItem !== currentChunk && navItem !== 'favorites') {
      nextTopicChunks.push(navItem);
      changed = true;
    }

    if (changed) {
      setTopic(joinTopic(nextTopicChunks));
    }
  }

  return {
    topicChunks,
    activeNode,
    navItems,
    isLoading,
    lastRefreshIso,
    error,
    navigateToDepth,
    selectNavItem,
  };
}

/**
 * Builds side navigation items from current topic and active node children.
 * @param topicChunks Current topic chunks.
 * @param activeNode Active tree node.
 * @returns {string[]} Navigation entries for the left panel.
 */
function buildNavItems(topicChunks: string[], activeNode: MessageTreeNode | null): string[] {
  const items: string[] = [];
  const currentChunk = topicChunks.at(-1);
  if (currentChunk) {
    items.push(currentChunk);
    items.push('<');
  } else {
    items.push('favorites');
  }

  const childs = activeNode?.childs;
  if (childs) {
    for (const topicChunk of Object.keys(childs)) {
      items.push(topicChunk);
    }
  }

  return items;
}

/**
 * Builds a snapshot array for POST /store diff mode from the active subtree.
 * @param activeNode Active subtree root.
 * @returns {MessageTopicData[]} Snapshot nodes with known topic/value/time state.
 */
function buildTopicSnapshotNodes(activeNode: MessageTreeNode | null): MessageTopicData[] {
  if (!activeNode) {
    return [];
  }

  const result: MessageTopicData[] = [];
  collectTopicSnapshotNodes(activeNode, result);
  return result;
}

/**
 * Loads overview section via legacy-equivalent GET configuration.
 * @param client Message-store client.
 * @param topicChunks Current topic chunks.
 * @returns {Promise<MessageTopicData[]>} Loaded topic payload.
 */
async function fetchOverviewSection(client: MessageStoreClient, topicChunks: string[]): Promise<MessageTopicData[]> {
  return client.loadTopicSection(joinTopic(topicChunks), {
    history: OVERVIEW_INCLUDE_HISTORY,
    reason: OVERVIEW_INCLUDE_REASON,
    levelAmount: OVERVIEW_LEVEL_AMOUNT,
  });
}

/**
 * Determines POST /store nodes payload based on request detail level.
 * @param activeNode Active subtree root.
 * @param includeHistory Whether history data is requested.
 * @param includeReason Whether reason data is requested.
 * @returns {MessageTopicData[]} Node list for the request.
 */
function determineRequestNodes(
  activeNode: MessageTreeNode | null,
  includeHistory: boolean,
  includeReason: boolean,
): MessageTopicData[] {
  if (!includeHistory && !includeReason) {
    return [];
  }
  return buildTopicSnapshotNodes(activeNode);
}

/**
 * Refreshes overview section via POST diff mode and falls back to full GET resync when needed.
 * @param client Message-store client.
 * @param request Refresh request payload.
 * @param consecutivePostFailures Consecutive POST failures so far.
 * @param topicChunks Current topic chunks.
 * @returns {Promise<MessageTopicData[]>} Payload for tree merge.
 */
async function refreshOverviewSection(
  client: MessageStoreClient,
  request: MessageStoreDirectRequest,
  consecutivePostFailures: number,
  topicChunks: string[],
): Promise<MessageTopicData[]> {
  if (consecutivePostFailures >= MAX_POST_FAILURES_BEFORE_FULL_RESYNC) {
    return fetchOverviewSection(client, topicChunks);
  }
  return client.refreshTopicSection(request);
}

/**
 * Recursively collects nodes with topics from the active subtree.
 * @param node Current subtree node.
 * @param result Accumulator for snapshot entries.
 */
function collectTopicSnapshotNodes(node: MessageTreeNode, result: MessageTopicData[]): void {
  if (typeof node.topic === 'string' && node.topic.length > 0) {
    result.push({
      topic: node.topic,
      value: node.value,
      time: node.time,
      reason: node.reason,
      history: node.history,
    });
  }

  if (!node.childs) {
    return;
  }

  for (const childNode of Object.values(node.childs)) {
    collectTopicSnapshotNodes(childNode, result);
  }
}

/**
 * Converts an unknown error into a UI-safe message.
 * @param unknownError Caught error value.
 * @returns {string} Normalized message string.
 */
function formatLoadError(unknownError: unknown): string {
  if (unknownError instanceof MessageStoreClientError) {
    return `Fehler beim Laden des Meldungsbaums: ${unknownError.message}`;
  }
  if (unknownError instanceof Error) {
    return `Fehler beim Laden des Meldungsbaums: ${unknownError.message}`;
  }
  return 'Fehler beim Laden des Meldungsbaums: unbekannter Fehler';
}
