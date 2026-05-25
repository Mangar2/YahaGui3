import type { MessageScalar, MessageTreeNode } from './interfaces';
import { deriveDisplayName as deriveTopicDisplayName } from './displayName';
import { splitTopic } from './topicPath';
import type { TopicSettingsStore } from '../settings/interfaces';

export type ControlIconAsset = string | null;

export interface TopicControlItem {
  topic: string;
  label: string;
  valueText: string;
  unit: string;
  topicType: string;
  valueType: string;
  enumeration: string[];
  isSwitch: boolean;
  isSwitchOn: boolean;
  iconAsset: ControlIconAsset;
}

const TYPE_IDENTIFIER: Record<string, string> = {
  window: 'Window',
  temperature: 'Temperature',
  humidity: 'Humidity',
  'roller shutter': 'Roller',
  pressure: 'Air Pressure',
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
  messageTree?: MessageTreeNode,
): TopicControlItem[] {
  if (!activeNode) {
    return [];
  }

  const nodes: MessageTreeNode[] = [];
  const childNodes = activeNode.childs ? Object.values(activeNode.childs) : [];
  for (const childNode of childNodes) {
    if (typeof childNode.topic !== 'string' || childNode.topic.length === 0 || childNode.value === undefined) {
      continue;
    }
    if (splitTopic(childNode.topic).at(-1) === 'set') {
      continue;
    }

    nodes.push(childNode);
  }

  // Legacy parity: if a node only exposes a "set" child, show the current node itself as control element.
  if (nodes.length === 0 && shouldRenderCurrentNodeAsControl(activeNode, topicChunks)) {
    nodes.push(activeNode);
  }

  return buildTopicControlItemsFromNodes(nodes, topicChunks, settingsStore, messageTree);
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
  messageTree?: MessageTreeNode,
): TopicControlItem[] {
  const items: TopicControlItem[] = [];
  for (const node of nodes) {
    if (typeof node.topic !== 'string' || node.topic.length === 0 || node.value === undefined) {
      continue;
    }
    if (splitTopic(node.topic).at(-1) === 'set') {
      continue;
    }
    items.push(buildControlItem(node, topicChunks, settingsStore, messageTree));
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
  messageTree?: MessageTreeNode,
): TopicControlItem {
  const topic = node.topic ?? '';
  const value = node.value ?? null;

  const navSettings = settingsStore ? settingsStore.getNavSettings(splitTopic(topic)) : null;
  const configuredTopicType = navSettings?.getTopicType() ?? 'Automatic';
  const configuredValueType = navSettings?.getValueType() ?? 'Automatic';
  const enumeration = navSettings?.getEnumList() ?? [];

  const topicType = decideTopicType(configuredTopicType, topic, value);
  const valueType = decideValueType(configuredValueType, value);
  const isSwitch = isSwitchType(topicType, value, valueType);
  const isSwitchOn = isSwitchOnValue(topicType, value, valueType, enumeration);
  const iconName = getConfiguredIconName(topic, settingsStore);

  const displayNameOptions: {
    currentTopicChunks: string[];
    messageTree?: MessageTreeNode | null;
    settingsStore?: TopicSettingsStore;
  } = {
    currentTopicChunks: topicChunks,
  };
  if (typeof settingsStore !== 'undefined') {
    displayNameOptions.settingsStore = settingsStore;
  }
  if (typeof messageTree !== 'undefined') {
    displayNameOptions.messageTree = messageTree;
  }

  return {
    topic,
    label: deriveTopicDisplayName(topic, displayNameOptions),
    valueText: formatMessageScalar(value),
    unit: UNIT_IDENTIFIER[topicType] ?? '',
    topicType,
    valueType,
    enumeration,
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

  if (item.topicType === 'Parameter' && item.valueType === 'Enumeration' && item.enumeration.length > 1) {
    return checked ? item.enumeration[0] : item.enumeration[1];
  }

  return checked ? 'on' : 'off';
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
 * Decides topic type with legacy-compatible automatic behavior.
 * @param configuredTopicType Topic type configured in settings.
 * @param topic Full topic path.
 * @param value Current topic value.
 * @returns {string} Decided topic type.
 */
function decideTopicType(configuredTopicType: string, topic: string, value: MessageScalar): string {
  if (configuredTopicType !== 'Automatic') {
    return configuredTopicType.length > 0 ? configuredTopicType : 'Information';
  }

  const lastChunk = splitTopic(topic).at(-1)?.toLowerCase() ?? '';

  for (const [identifier, mappedType] of Object.entries(TYPE_IDENTIFIER)) {
    if (lastChunk.includes(identifier)) {
      return mappedType;
    }
  }

  if (isAutomaticSwitchValue(value)) {
    return 'Switch';
  }
  return 'Information';
}

/**
 * Decides value type with legacy-compatible automatic fallback.
 * @param configuredValueType Value type configured in settings.
 * @param value Current topic value.
 * @returns {string} Decided value type.
 */
function decideValueType(configuredValueType: string, value: MessageScalar): string {
  void value;
  if (configuredValueType === 'Automatic' || configuredValueType.length === 0) {
    return 'String';
  }
  return configuredValueType;
}

/**
 * Checks whether a topic should be rendered as a switch control.
 * @param topicType Decided topic type.
 * @param value Current topic value.
 * @param valueType Decided value type.
 * @returns {boolean} True when switch UI is appropriate.
 */
function isSwitchType(topicType: string, value: MessageScalar, valueType: string): boolean {
  void value;
  if (valueType.toLowerCase() === 'enumeration') {
    return true;
  }

  return SWITCH_TOPIC_TYPES.has(topicType);
}

/**
 * Determines whether a switch-like topic is currently considered active.
 * @param topicType Decided topic type.
 * @param value Current topic value.
 * @param valueType Decided value type.
 * @param enumList Enumeration list for parameter mode.
 * @returns {boolean} True when interpreted as switched on.
 */
function isSwitchOnValue(topicType: string, value: MessageScalar, valueType: string, enumList: string[]): boolean {
  const valueLower = String(value ?? '').toLowerCase();

  if (valueLower.length === 0) {
    return false;
  }

  if (topicType === 'Roller') {
    return valueLower !== 'down' && valueLower !== '0';
  }

  if (topicType === 'Parameter') {
    if (valueType !== 'Enumeration') {
      return true;
    }
    const isOffState = enumList.slice(1).some((entry: string): boolean => valueLower === entry.toLowerCase());
    return !isOffState;
  }

  return !['off', '0', 'false'].includes(valueLower);
}

/**
 * Detects whether automatic topic typing should infer a switch.
 * @param value Current topic value.
 * @returns {boolean} True when value matches legacy on/off semantics.
 */
function isAutomaticSwitchValue(value: MessageScalar): boolean {
  const valueLower = String(value ?? '').toLowerCase();
  return valueLower === 'on' || valueLower === 'off';
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
  const configuredPictures = getConfiguredPictures(iconName);
  const pictures = configuredPictures ?? getTopicMatchedPictures(topic);

  if (pictures === null) {
    return null;
  }

  if (!Array.isArray(pictures)) {
    return pictures;
  }

  return resolveStatefulIcon(pictures, topicValue);
}

/**
 * Returns configured pictures when icon name is explicitly set.
 * @param iconName Configured icon name.
 * @returns {string | string[] | null} Mapped icon or null when automatic/unknown.
 */
function getConfiguredPictures(iconName: string): string | string[] | null {
  const normalizedIconName = iconName.trim();
  if (normalizedIconName.length === 0 || normalizedIconName === 'Automatic') {
    return null;
  }

  return ICONS[normalizedIconName] ?? null;
}

/**
 * Finds pictures by legacy topic matching order: last chunk, then full topic.
 * @param topic Full topic path.
 * @returns {string | string[] | null} Mapped icon pictures or null.
 */
function getTopicMatchedPictures(topic: string): string | string[] | null {
  const lastChunk = splitTopic(topic).at(-1) ?? '';
  const checkStrings = [lastChunk, topic];
  for (const checkString of checkStrings) {
    const matchedPictures = findPicturesByText(checkString);
    if (matchedPictures !== null) {
      return matchedPictures;
    }
  }

  return null;
}

/**
 * Finds pictures by matching icon keys in one text.
 * @param text Source text used for includes matching.
 * @returns {string | string[] | null} Matching picture entry.
 */
function findPicturesByText(text: string): string | string[] | null {
  const normalizedText = text.toLowerCase();
  for (const [pictureName, pictureValue] of Object.entries(ICONS)) {
    if (normalizedText.includes(pictureName.toLowerCase())) {
      return pictureValue;
    }
  }

  return null;
}

/**
 * Selects one picture from stateful icon variants based on topic value.
 * @param pictures Stateful icon pictures [off, on].
 * @param topicValue Current topic value text.
 * @returns {ControlIconAsset} Selected asset.
 */
function resolveStatefulIcon(pictures: string[], topicValue: string): ControlIconAsset {
  if (pictures.length === 0) {
    return null;
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
