/**
 * Splits a topic by '/' and removes empty chunks.
 * @param topic Topic path from URL or API.
 * @returns {string[]} Normalized topic chunks.
 */
export function splitTopic(topic: string): string[] {
  return topic.split('/').filter((chunk: string): boolean => chunk.length > 0);
}

/**
 * Joins topic chunks into a slash separated path.
 * @param topicChunks Topic path chunks.
 * @returns {string} Combined topic path.
 */
export function joinTopic(topicChunks: string[]): string {
  return topicChunks.join('/');
}

/**
 * Encodes a topic path for usage in URLs while keeping slash separators.
 * @param topic Topic path.
 * @returns {string} URL-safe topic path.
 */
export function encodeTopicForPath(topic: string): string {
  const chunks = splitTopic(topic);
  return chunks.map((chunk: string): string => encodeURIComponent(chunk)).join('/');
}
