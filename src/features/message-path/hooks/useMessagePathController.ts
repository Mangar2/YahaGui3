import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageTree } from '../../../domain/messages/messageTree';
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

const LEVEL_AMOUNT = 7;
const REFRESH_INTERVAL_MS = 2500;

/**
 * Controls loading and refreshing the currently active message path.
 * @returns Reactive state for breadcrumb path and topic loading.
 */
export function useMessagePathController(): MessagePathControllerState {
  const [topic, setTopic] = useTopicQueryState();
  const topicChunks = useMemo((): string[] => splitTopic(topic), [topic]);

  const treeRef = useRef<MessageTree>(new MessageTree());
  const clientRef = useRef<MessageStoreClient>(new MessageStoreClient(getMessageStoreBaseUrl()));
  const refreshRunningRef = useRef<boolean>(false);

  const [version, setVersion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);

  const activeNode = useMemo((): MessageTreeNode | null => {
    return treeRef.current.getNodeByTopicChunks(topicChunks);
  }, [topicChunks, version]);

  const navItems = useMemo((): string[] => {
    return buildNavItems(topicChunks, activeNode);
  }, [topicChunks, activeNode]);

  useEffect((): void => {
    let cancelled = false;

    async function runInitialLoad(): Promise<void> {
      setIsLoading(true);
      try {
        const payload = await clientRef.current.loadTopicSection(joinTopic(topicChunks), {
          history: false,
          reason: false,
          levelAmount: LEVEL_AMOUNT,
        });
        if (cancelled) {
          return;
        }
        applyPayload(treeRef.current, payload, setVersion);
        setLastRefreshIso(new Date().toISOString());
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
          const request: MessageStoreDirectRequest = {
            topic: joinTopic(topicChunks),
            history: false,
            reason: false,
            levelAmount: LEVEL_AMOUNT,
            nodes: [],
          };

          const payload = await clientRef.current.refreshTopicSection(request);
          applyPayload(treeRef.current, payload, setVersion);
          setLastRefreshIso(new Date().toISOString());
          setError(null);
        } catch (unknownError: unknown) {
          setError(formatLoadError(unknownError));
        } finally {
          refreshRunningRef.current = false;
        }
      })();
    }, REFRESH_INTERVAL_MS);

    return (): void => {
      window.clearInterval(intervalId);
    };
  }, [topicChunks]);

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
 * @returns Navigation entries for the left panel.
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
 * Applies a payload to the tree and triggers one rerender tick.
 * @param tree Tree instance.
 * @param payload Parsed payload list.
 * @param setVersion React state setter for rerendering.
 */
function applyPayload(
  tree: MessageTree,
  payload: MessageTopicData[],
  setVersion: Dispatch<SetStateAction<number>>,
): void {
  tree.replaceManyNodes(payload);
  setVersion((value: number): number => value + 1);
}

/**
 * Converts an unknown error into a UI-safe message.
 * @param unknownError Caught error value.
 * @returns Normalized message string.
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
