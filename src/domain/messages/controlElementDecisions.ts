import type { MessageScalar, MessageTreeNode } from './interfaces';
import { splitTopic } from './topicPath';

export type ControlIconKind =
  | 'light'
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'roller'
  | 'window'
  | 'camera'
  | 'switch'
  | 'default';

export interface TopicControlItem {
  topic: string;
  label: string;
  valueText: string;
  unit: string;
  topicType: string;
  isSwitch: boolean;
  isSwitchOn: boolean;
  iconKind: ControlIconKind;
}

const TYPE_IDENTIFIER: Record<string, string> = {
  window: 'Window',
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Air Pressure',
  roller: 'Roller',
  light: 'Light',
  switch: 'Switch',
  camera: 'Camera',
};

const UNIT_IDENTIFIER: Record<string, string> = {
  Temperature: 'degC',
  Humidity: '%rH',
  'Air Pressure': 'hPa',
};

const SWITCH_TOPIC_TYPES: ReadonlySet<string> = new Set<string>(['Roller', 'Light', 'Switch']);
const ICON_KEYWORD_MAP: { keyword: string; iconKind: ControlIconKind }[] = [
  { keyword: 'temperature', iconKind: 'temperature' },
  { keyword: 'humidity', iconKind: 'humidity' },
  { keyword: 'pressure', iconKind: 'pressure' },
  { keyword: 'light', iconKind: 'light' },
  { keyword: 'roller', iconKind: 'roller' },
  { keyword: 'window', iconKind: 'window' },
  { keyword: 'camera', iconKind: 'camera' },
];
const ICON_TOPIC_TYPE_MAP: Record<string, ControlIconKind> = {
  Temperature: 'temperature',
  Humidity: 'humidity',
  'Air Pressure': 'pressure',
  Light: 'light',
  Roller: 'roller',
  Window: 'window',
  Camera: 'camera',
  Switch: 'switch',
};

/**
 * Builds the right-side control items for the active overview node.
 * @param activeNode Currently selected message tree node.
 * @param topicChunks Current topic path chunks from the URL.
 * @returns {TopicControlItem[]} Sorted topic controls with icon, label and value metadata.
 */
export function buildTopicControlItems(activeNode: MessageTreeNode | null, topicChunks: string[]): TopicControlItem[] {
  if (!activeNode) {
    return [];
  }

  const items: TopicControlItem[] = [];
  const childNodes = activeNode.childs ? Object.values(activeNode.childs) : [];
  for (const childNode of childNodes) {
    if (typeof childNode.topic !== 'string' || childNode.topic.length === 0 || childNode.value === undefined) {
      continue;
    }
    if (splitTopic(childNode.topic).at(-1) === 'set') {
      continue;
    }

    items.push(buildControlItem(childNode, topicChunks));
  }

  // Legacy parity: if a node only exposes a "set" child, show the current node itself as control element.
  if (items.length === 0 && shouldRenderCurrentNodeAsControl(activeNode, topicChunks)) {
    items.push(buildControlItem(activeNode, topicChunks));
  }

  return sortControlItems(items);
}

/**
 * Builds one control item from a tree node.
 * @param node Source tree node.
 * @param topicChunks Current topic path chunks from the URL.
 * @returns {TopicControlItem} Control item metadata.
 */
function buildControlItem(node: MessageTreeNode, topicChunks: string[]): TopicControlItem {
  const topic = node.topic ?? '';
  const value = node.value ?? null;
  const topicType = decideTopicType(topic, value);
  const isSwitch = isSwitchType(topicType, value);
  const isSwitchOn = isSwitchOnValue(topicType, value);

  return {
    topic,
    label: deriveDisplayName(topic, topicChunks),
    valueText: formatMessageScalar(value),
    unit: UNIT_IDENTIFIER[topicType] ?? '',
    topicType,
    isSwitch,
    isSwitchOn,
    iconKind: decideIconKind(topic, topicType),
  };
}

/**
 * Checks whether current node should be rendered as control fallback.
 * @param activeNode Active node.
 * @param topicChunks Current topic chunks.
 * @returns {boolean} True when current node should be rendered.
 */
function shouldRenderCurrentNodeAsControl(activeNode: MessageTreeNode, topicChunks: string[]): boolean {
  if (typeof activeNode.topic !== 'string' || activeNode.topic.length === 0 || activeNode.value === undefined) {
    return false;
  }

  // Do not render fallback at root level.
  if (topicChunks.length === 0) {
    return false;
  }

  const lastChunk = splitTopic(activeNode.topic).at(-1);
  if (lastChunk === 'set') {
    return false;
  }

  return true;
}

/**
 * Sorts control items for stable UI ordering.
 * @param items Unsorted control items.
 * @returns {TopicControlItem[]} Sorted control items.
 */
function sortControlItems(items: TopicControlItem[]): TopicControlItem[] {
  return [...items].sort((left: TopicControlItem, right: TopicControlItem): number => {
    if (left.topicType < right.topicType) {
      return -1;
    }
    if (left.topicType > right.topicType) {
      return 1;
    }
    return left.label.localeCompare(right.label);
  });
}

/**
 * Calculates the publish value for a switch interaction.
 * @param item Control item that should be switched.
 * @param checked New target checked state from the toggle element.
 * @returns {string} Message value to publish.
 */
export function getNewSwitchValue(item: TopicControlItem, checked: boolean): string {
  if (item.topicType === 'Roller') {
    return checked ? 'up' : 'down';
  }
  return checked ? 'on' : 'off';
}

/**
 * Derives a short UI label for a topic based on the current navigation depth.
 * @param topic Full topic path.
 * @param topicChunks Current overview path chunks.
 * @returns {string} Human-readable control label.
 */
function deriveDisplayName(topic: string, topicChunks: string[]): string {
  const topicPathChunks = splitTopic(topic);
  const relativeChunks = topicPathChunks.slice(topicChunks.length);
  const preferredChunk = relativeChunks.at(-1) ?? topicPathChunks.at(-1);
  return preferredChunk ?? topic;
}

/**
 * Converts message values to deterministic display text.
 * @param value Message scalar value.
 * @returns {string} Display representation.
 */
function formatMessageScalar(value: MessageScalar): string {
  if (value === null) {
    return 'null';
  }
  return String(value);
}

/**
 * Decides an automatic topic type based on topic path and value.
 * @param topic Full topic path.
 * @param value Current topic value.
 * @returns {string} Decided topic type.
 */
function decideTopicType(topic: string, value: MessageScalar): string {
  const lastChunk = splitTopic(topic).at(-1)?.toLowerCase() ?? '';

  for (const [identifier, mappedType] of Object.entries(TYPE_IDENTIFIER)) {
    if (lastChunk.includes(identifier)) {
      return mappedType;
    }
  }

  if (isSwitchLikeValue(value)) {
    return 'Switch';
  }
  return 'Information';
}

/**
 * Checks whether a topic should be rendered as a switch control.
 * @param topicType Decided topic type.
 * @param value Current topic value.
 * @returns {boolean} True when switch UI is appropriate.
 */
function isSwitchType(topicType: string, value: MessageScalar): boolean {
  return SWITCH_TOPIC_TYPES.has(topicType) || isSwitchLikeValue(value);
}

/**
 * Determines whether a switch-like topic is currently considered active.
 * @param topicType Decided topic type.
 * @param value Current topic value.
 * @returns {boolean} True when interpreted as switched on.
 */
function isSwitchOnValue(topicType: string, value: MessageScalar): boolean {
  const valueLower = String(value ?? '').toLowerCase();
  if (topicType === 'Roller') {
    return valueLower !== 'down' && valueLower !== '0' && valueLower !== 'closed';
  }
  return !['off', '0', 'false', 'down', 'closed'].includes(valueLower);
}

/**
 * Detects whether a value can be interpreted as a switch state.
 * @param value Current topic value.
 * @returns {boolean} True when value is switch-like.
 */
function isSwitchLikeValue(value: MessageScalar): boolean {
  const valueLower = String(value ?? '').toLowerCase();
  return ['on', 'off', 'up', 'down', 'open', 'closed', '0', '1', 'true', 'false'].includes(valueLower);
}

/**
 * Decides an icon kind based on topic and type.
 * @param topic Full topic path.
 * @param topicType Decided type.
 * @returns {ControlIconKind} Icon choice for rendering.
 */
function decideIconKind(topic: string, topicType: string): ControlIconKind {
  const iconByType = ICON_TOPIC_TYPE_MAP[topicType];
  if (iconByType) {
    return iconByType;
  }

  const topicLower = topic.toLowerCase();
  for (const iconEntry of ICON_KEYWORD_MAP) {
    if (topicLower.includes(iconEntry.keyword)) {
      return iconEntry.iconKind;
    }
  }

  return 'default';
}
