import { useCallback, useEffect, useState } from 'react';

/**
 * Reads the current topic query parameter from the browser URL.
 * @returns {string} Topic path or empty string.
 */
function readTopicFromLocation(): string {
  const searchParams = new URLSearchParams(window.location.search);
  const topic = searchParams.get('topic');
  return topic ?? '';
}

/**
 * Writes the topic query parameter and keeps browser history in sync.
 * @param topic New topic path.
 */
function writeTopicToLocation(topic: string): void {
  const currentUrl = new URL(window.location.href);
  if (topic.length === 0) {
    currentUrl.searchParams.delete('topic');
  } else {
    currentUrl.searchParams.set('topic', topic);
  }
  window.history.pushState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}

/**
 * Exposes the current topic query parameter as React state.
 * @returns {readonly [string, (topic: string) => void]} Topic value and setter.
 */
export function useTopicQueryState(): readonly [string, (topic: string) => void] {
  const [topic, setTopic] = useState<string>(readTopicFromLocation());

  const setTopicAndUrl = useCallback((nextTopic: string): void => {
    writeTopicToLocation(nextTopic);
    setTopic(nextTopic);
  }, []);

  useEffect((): (() => void) => {
    /**
     * Updates local topic state when browser history changes.
     * @returns {void}
     */
    function handlePopState(): void {
      setTopic(readTopicFromLocation());
    }

    window.addEventListener('popstate', handlePopState);
    return (): void => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return [topic, setTopicAndUrl] as const;
}
