import type { MessageScalar, MessageTreeNode } from './interfaces';
import { splitTopic } from './topicPath';
import type { TopicSettingsStore } from '../settings/interfaces';

export type ControlIconAsset = string | null;

export interface TopicControlItem {
  topic: string;
  label: string;
  valueText: string;
  unit: string;
  topicType: string;
  isSwitch: boolean;
  isSwitchOn: boolean;
  iconAsset: ControlIconAsset;
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
const ICONS: Record<string, string | string[]> = {
  Camera: 'camera_indoor_FILL0_wght400_GRAD0_opsz48.png',
  Charge: 'charger_FILL0_wght400_GRAD0_opsz48.png',
  Humidity: 'humidity_percentage_FILL0_wght400_GRAD0_opsz48.png',
  Light: 'lightbulb_FILL0_wght400_GRAD0_opsz48.png',
  Pressure: 'air_pressure.png',
  Temperature: 'device_thermostat_FILL0_wght400_GRAD0_opsz48.png',
  TV: 'tv_gen_FILL0_wght400_GRAD0_opsz48.png',
  Ventilation: 'ventilation.png',
  Window: 'window.png',
  Roller: ['roller_closed.png', 'roller_open.png'],
  Multimedia: 'multimedia.png',
  Presence: 'home_pin_FILL0_wght400_GRAD0_opsz48.png',
  Print: 'print_FILL0_wght400_GRAD0_opsz48.png',
  PC: 'computer_FILL0_wght400_GRAD0_opsz48.png',
  Dishwasher: 'dishwasher_gen_FILL0_wght400_GRAD0_opsz48.png',
  Fridge: 'kitchen_FILL0_wght400_GRAD0_opsz48.png',
  // Extension to provide explicit fallback for configured switch topics.
  Switch: 'lightbulb_FILL0_wght400_GRAD0_opsz48.png',
};

/**
 * Builds the right-side control items for the active overview node.
 * @param activeNode Currently selected message tree node.
 * @param topicChunks Current topic path chunks from the URL.
 * @param settingsStore Settings store used to read topic-specific icon configuration.
 * @returns {TopicControlItem[]} Sorted topic controls with icon, label and value metadata.
 */
export function buildTopicControlItems(
  activeNode: MessageTreeNode | null,
  topicChunks: string[],
  settingsStore?: TopicSettingsStore,
): TopicControlItem[] {
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

    items.push(buildControlItem(childNode, topicChunks, settingsStore));
  }

  // Legacy parity: if a node only exposes a "set" child, show the current node itself as control element.
  if (items.length === 0 && shouldRenderCurrentNodeAsControl(activeNode, topicChunks)) {
    items.push(buildControlItem(activeNode, topicChunks, settingsStore));
  }

  return buildTopicControlItemsFromNodes(items, topicChunks, settingsStore);
}

/**
 * Builds sorted control items from a preselected node list.
 * @param nodes Selected tree nodes that should be shown as controls.
 * @param topicChunks Current topic path chunks from the URL.
 * @param settingsStore Settings store used to read topic-specific icon configuration.
 * @returns {TopicControlItem[]} Sorted topic controls with icon, label and value metadata.
 */
export function buildTopicControlItemsFromNodes(
  nodes: MessageTreeNode[],
  topicChunks: string[],
  settingsStore?: TopicSettingsStore,
): TopicControlItem[] {
  const items: TopicControlItem[] = [];
  for (const node of nodes) {
    if (typeof node.topic !== 'string' || node.topic.length === 0 || node.value === undefined) {
      continue;
    }
    if (splitTopic(node.topic).at(-1) === 'set') {
      continue;
    }
    items.push(buildControlItem(node, topicChunks, settingsStore));
  }

  return sortControlItems(items);
}

/**
 * Builds one control item from a tree node.
 * @param node Source tree node.
 * @param topicChunks Current topic path chunks from the URL.
 * @param settingsStore Settings store used to read topic-specific icon configuration.
 * @returns {TopicControlItem} Control item metadata.
 */
function buildControlItem(
  node: MessageTreeNode,
  topicChunks: string[],
  settingsStore?: TopicSettingsStore,
): TopicControlItem {
  const topic = node.topic ?? '';
  const value = node.value ?? null;
  const topicType = decideTopicType(topic, value);
  const isSwitch = isSwitchType(topicType, value);
  const isSwitchOn = isSwitchOnValue(topicType, value);
  const iconName = getConfiguredIconName(topic, settingsStore);

  return {
    topic,
    label: deriveDisplayName(topic, topicChunks),
    valueText: formatMessageScalar(value),
    unit: UNIT_IDENTIFIER[topicType] ?? '',
    topicType,
    isSwitch,
    isSwitchOn,
    iconAsset: decideIconAsset(iconName, topic, String(value ?? '')),
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
 * Returns configured icon name for a topic or legacy automatic fallback.
 * @param topic Full topic path.
 * @param settingsStore Optional settings store.
 * @returns {string} Configured icon name or "Automatic".
 */
function getConfiguredIconName(topic: string, settingsStore?: TopicSettingsStore): string {
  if (!settingsStore || topic.length === 0) {
    return 'Automatic';
  }

  const topicChunks = splitTopic(topic);
  return settingsStore.getNavSettings(topicChunks).getIconName();
}

/**
 * Decides an icon asset filename based on the legacy priority rules.
 * Priority: configured icon name, then last topic chunk match, then full topic match.
 * @param iconName Configured icon name from topic settings.
 * @param topic Full topic path.
 * @param topicValue Current topic value as string.
 * @returns {ControlIconAsset} Icon asset filename relative to /assets, or null when not resolvable.
 */
function decideIconAsset(iconName: string, topic: string, topicValue: string): ControlIconAsset {
  const normalizedIconName = iconName.trim();
  let pictures: string | string[] | null = null;

  if (normalizedIconName.length > 0 && normalizedIconName !== 'Automatic') {
    pictures = ICONS[normalizedIconName] ?? null;
  }

  // Legacy order: check final topic chunk before full topic path.
  const lastChunk = splitTopic(topic).at(-1) ?? '';
  const checkStrings = [lastChunk, topic];
  for (const checkString of checkStrings) {
    if (pictures !== null) {
      break;
    }

    const normalizedCheck = checkString.toLowerCase();
    for (const [pictureName, pictureValue] of Object.entries(ICONS)) {
      if (normalizedCheck.includes(pictureName.toLowerCase())) {
        pictures = pictureValue;
        break;
      }
    }
  }

  if (pictures === null) {
    return null;
  }

  if (!Array.isArray(pictures)) {
    return pictures;
  }

  const topicValueLower = topicValue.toLowerCase();
  const showOnIcon =
    topicValueLower !== 'off' &&
    topicValueLower !== 'down' &&
    topicValueLower !== '0' &&
    topicValueLower !== 'closed';
  if (showOnIcon && pictures[1]) {
    return pictures[1];
  }

  return pictures[0] ?? null;
}
