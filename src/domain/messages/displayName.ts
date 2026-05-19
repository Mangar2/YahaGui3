import type { MessageTreeNode } from './interfaces';
import { getNodeByTopicChunks } from './messageTree';
import { splitTopic } from './topicPath';
import type { TopicSettingsStore } from '../settings/interfaces';

const TYPE_IDENTIFIER_FOR_NAMING: Record<string, string> = {
  window: 'Window',
  temperature: 'Temperature',
  humidity: 'Humidity',
  'roller shutter': 'Roller',
  pressure: 'Air Pressure',
};

const TYPES_USED_FOR_NAMING: ReadonlySet<string> = new Set<string>([
  'Window',
  'Light',
  'Temperature',
  'Humidity',
  'Roller',
]);

interface DisplayNameOptions {
  currentTopicChunks?: string[];
  messageTree?: MessageTreeNode | null;
  settingsStore?: TopicSettingsStore;
}

/**
 * Derives a human-readable display name with legacy-equivalent ambiguity resolution.
 * @param topic Full topic path.
 * @param options Display-name context options.
 * @param options.currentTopicChunks Topic chunks of the current screen position.
 * @param options.messageTree Full message tree used for duplicate detection.
 * @param options.settingsStore Settings store to read configured topic types.
 * @returns {string} Display name for UI labels.
 */
export function deriveDisplayName(topic: string, options: DisplayNameOptions = {}): string {
  const topicChunks = splitTopic(topic);
  if (topicChunks.length === 0) {
    return topic;
  }

  const currentTopicChunks = options.currentTopicChunks ?? [];
  const messageTree = options.messageTree ?? null;
  const settingsStore = options.settingsStore;

  let result = deriveNameBasedOnTopicType(topicChunks, settingsStore);
  result = result.toLowerCase();

  if (result.startsWith('pc') && !result.startsWith('pc ')) {
    result = `PC ${result.slice(2)}`;
  }

  const prefix = getUnambiguousPrefix(topicChunks, currentTopicChunks, result, messageTree);
  return capitalizeFirstLetters(`${prefix}${result}`);
}

/**
 * Derives the initial base name from configured or automatic topic type detection.
 * @param topicChunks Full topic chunks.
 * @param settingsStore Settings store for topic-type config.
 * @returns {string} Base name used for later ambiguity resolution.
 */
function deriveNameBasedOnTopicType(topicChunks: string[], settingsStore?: TopicSettingsStore): string {
  const configuredType = settingsStore?.getNavSettings(topicChunks).getTopicType() ?? 'Automatic';
  const lastChunk = topicChunks.at(-1);
  const topicType = decideTypeForNaming(configuredType, lastChunk);

  if (TYPES_USED_FOR_NAMING.has(topicType)) {
    return topicType;
  }

  if (typeof lastChunk === 'string' && lastChunk.length > 0) {
    return lastChunk;
  }

  return 'No topic';
}

/**
 * Decides a topic type for naming, matching the legacy decideType behavior for display names.
 * @param configuredType Configured topic type.
 * @param topicChunk Last topic chunk.
 * @returns {string} Decided topic type.
 */
function decideTypeForNaming(configuredType: string, topicChunk: string | undefined): string {
  if (configuredType !== 'Automatic') {
    return configuredType.length > 0 ? configuredType : 'Information';
  }

  if (typeof topicChunk === 'string') {
    const loweredChunk = topicChunk.toLowerCase();
    for (const [identifier, mappedType] of Object.entries(TYPE_IDENTIFIER_FOR_NAMING)) {
      if (loweredChunk.includes(identifier)) {
        return mappedType;
      }
    }
  }

  return 'Information';
}

/**
 * Finds a prefix that disambiguates identical labels in the current tree context.
 * @param topicChunks Full topic chunks of the element.
 * @param currentTopicChunks Current UI context chunks.
 * @param currentName Current derived name in lowercase.
 * @param messageTree Full message tree.
 * @returns {string} Prefix including trailing space or empty string.
 */
function getUnambiguousPrefix(
  topicChunks: string[],
  currentTopicChunks: string[],
  currentName: string,
  messageTree: MessageTreeNode | null,
): string {
  const subtopic = topicChunks.at(-1);
  if (typeof subtopic !== 'string' || subtopic.length === 0 || messageTree === null) {
    return '';
  }

  let alreadyUnique = getWordCount([subtopic], currentTopicChunks, messageTree) <= 1;
  if (alreadyUnique) {
    return '';
  }

  const prefixProposal: string[] = [];
  const isCrossRooms = currentTopicChunks.length <= 1 && topicChunks.length >= 2;
  const roomChunk = topicChunks[1];
  if (isCrossRooms && typeof roomChunk === 'string' && roomChunk.length > 0 && currentName !== roomChunk) {
    prefixProposal.push(roomChunk);
    alreadyUnique = getWordCount([...prefixProposal, subtopic], currentTopicChunks, messageTree) <= 1;
  }

  for (let index = topicChunks.length - 2; index >= 2; index -= 1) {
    if (alreadyUnique) {
      break;
    }

    const currentChunk = topicChunks[index];
    if (typeof currentChunk !== 'string' || currentChunk.length === 0) {
      continue;
    }

    alreadyUnique = getWordCount([...prefixProposal, currentChunk, subtopic], currentTopicChunks, messageTree) <= 1;
    if ((alreadyUnique || index === 2) && currentChunk !== 'switch' && currentChunk !== currentName) {
      prefixProposal.push(currentChunk);
    }
  }

  if (prefixProposal.length === 0) {
    return '';
  }

  return `${prefixProposal.join(' ')} `;
}

/**
 * Counts how often a candidate word path exists in the subtree at the current UI position.
 * @param wordChunks Candidate name chunks.
 * @param currentTopicChunks Current UI context chunks.
 * @param messageTree Full message tree.
 * @returns {number} Match count with early cutoff.
 */
function getWordCount(wordChunks: string[], currentTopicChunks: string[], messageTree: MessageTreeNode): number {
  const currentNode = getNodeByTopicChunks(messageTree, currentTopicChunks);
  if (currentNode === null) {
    return 0;
  }

  return countWordsRec(wordChunks, currentNode);
}

/**
 * Recursively counts occurrences of a candidate chunk sequence in a subtree.
 * @param wordChunks Candidate sequence to match.
 * @param currentNode Current node in traversal.
 * @param cutoff Maximum count at which traversal stops.
 * @returns {number} Number of matches found.
 */
function countWordsRec(wordChunks: string[], currentNode: MessageTreeNode, cutoff: number = 2): number {
  if (wordChunks.length === 0) {
    return 1;
  }

  const childs = currentNode.childs;
  if (childs === null) {
    return 0;
  }

  let result = 0;
  for (const [chunk, childNode] of Object.entries(childs)) {
    if (wordChunks[0] === chunk) {
      result += countWordsRec(wordChunks.slice(1), childNode, cutoff);
    } else {
      result += countWordsRec(wordChunks, childNode, cutoff);
    }

    if (result >= cutoff) {
      break;
    }
  }

  return result;
}

/**
 * Capitalizes the first letter of each whitespace-separated word.
 * @param name Raw display name.
 * @returns {string} Capitalized name.
 */
function capitalizeFirstLetters(name: string): string {
  return name
    .split(' ')
    .map((chunk: string): string => {
      if (chunk.length === 0) {
        return chunk;
      }
      return `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`;
    })
    .join(' ');
}
