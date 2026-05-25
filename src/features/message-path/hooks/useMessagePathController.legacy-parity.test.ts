import { describe, expect, it } from 'vitest';
import { buildConfiguredControlItems, hasPendingPublish } from './useMessagePathController';
import { createEmptyMessageTree, getNodeByTopicChunks, replaceManyNodes } from '../../../domain/messages/messageTree';
import type { MessageTreeNode, MessageTopicData } from '../../../domain/messages/interfaces';
import { TopicNavSettings, TopicSettingsStore } from '../../../domain/settings/interfaces';

interface SettingsStoreMockConfig {
  disabledByTopic?: Record<string, string[]>;
  additionalTopics?: string[];
}

/**
 * Creates a legacy-equivalent settings-store mock for overview selection tests.
 * @param config Mock behavior configuration.
 * @returns {TopicSettingsStore} Store-like object with getNavSettings and getAdditionalTopics.
 */
function createSettingsStoreMock(config: SettingsStoreMockConfig = {}): TopicSettingsStore {
  const settingsByTopic: Record<string, TopicNavSettings> = {};
  const disabledByTopic = config.disabledByTopic ?? {};
  const additionalTopics = config.additionalTopics ?? [];

  const storeLike = {
    getNavSettings(topicChunks: string[]): TopicNavSettings {
      const topic = topicChunks.join('/');
      const existing = settingsByTopic[topic];
      if (existing) {
        return existing;
      }

      const created = new TopicNavSettings();
      const disabled = disabledByTopic[topic] ?? [];
      for (const itemName of disabled) {
        created.disable(itemName);
      }
      settingsByTopic[topic] = created;
      return created;
    },
    getAdditionalTopics(): string[] {
      return additionalTopics;
    },
  };

  return storeLike as TopicSettingsStore;
}

/**
 * Builds a message tree from topic payload list.
 * @param payload Topic payload list.
 * @returns {MessageTreeNode} Populated tree.
 */
function buildTree(payload: MessageTopicData[]): MessageTreeNode {
  return replaceManyNodes(createEmptyMessageTree(), payload);
}

describe('buildConfiguredControlItems legacy selection parity', (): void => {
  it('selects enabled direct childs and configured additional descendants only', (): void => {
    const tree = buildTree([
      { topic: 'home/room/light_main', value: 'on' },
      { topic: 'home/room/socket_1', value: 'off' },
      { topic: 'home/room/set', value: 'ignored' },
      { topic: 'home/room/extra/deep/value', value: 12 },
    ]);

    const activeNode = getNodeByTopicChunks(tree, ['home', 'room']);
    const settingsStore = createSettingsStoreMock({
      disabledByTopic: {
        'home/room': ['socket_1'],
      },
      additionalTopics: ['home/room/extra/deep/value'],
    });

    const items = buildConfiguredControlItems(tree, activeNode, ['home', 'room'], settingsStore);
    const itemTopics = items.map((item) => item.topic).sort();

    expect(itemTopics).toEqual(['home/room/extra/deep/value', 'home/room/light_main']);
  });

  it('returns no overview control when no eligible child or additional topic exists', (): void => {
    const tree = buildTree([
      { topic: 'home/room/set', value: 'ignored' },
    ]);

    const activeNode = getNodeByTopicChunks(tree, ['home', 'room']);
    const settingsStore = createSettingsStoreMock({ additionalTopics: [] });

    const items = buildConfiguredControlItems(tree, activeNode, ['home', 'room'], settingsStore);

    expect(items).toHaveLength(0);
  });
});

describe('hasPendingPublish legacy polling guard', (): void => {
  it('returns true when at least one topic is pending', (): void => {
    expect(hasPendingPublish({ 'home/room/light': false, 'home/room/socket': true })).toBe(true);
  });

  it('returns false when no topic is pending', (): void => {
    expect(hasPendingPublish({ 'home/room/light': false, 'home/room/socket': false })).toBe(false);
    expect(hasPendingPublish({})).toBe(false);
  });
});
