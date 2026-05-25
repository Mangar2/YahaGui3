import { describe, expect, it } from 'vitest';
import { buildTopicControlItemsFromNodes } from './controlElementDecisions';
import type { MessageTreeNode } from './interfaces';
import { TopicNavSettings, TopicSettingsStore } from '../settings/interfaces';

/**
 * Builds one minimal message tree node for control decision tests.
 * @param topic Topic path.
 * @param value Current value.
 * @returns {MessageTreeNode} Tree node with topic/value only.
 */
function buildNode(topic: string, value: string | number | boolean): MessageTreeNode {
  return {
    childs: null,
    topic,
    value,
  };
}

/**
 * Creates a minimal settings-store mock for control decision tests.
 * @returns {TopicSettingsStore} Store-like object exposing getNavSettings.
 */
function buildSettingsStoreMock(): TopicSettingsStore {
  const settingsByTopic: Record<string, TopicNavSettings> = {};
  const storeLike = {
    getNavSettings(topicChunks: string[]): TopicNavSettings {
      const topic = topicChunks.join('/');
      const existing = settingsByTopic[topic];
      if (existing) {
        return existing;
      }

      const created = new TopicNavSettings();
      settingsByTopic[topic] = created;
      return created;
    },
  };

  return storeLike as TopicSettingsStore;
}

describe('buildTopicControlItemsFromNodes legacy switch parity', (): void => {
  it('does not auto-detect light substring topics as switch controls', (): void => {
    const items = buildTopicControlItemsFromNodes(
      [buildNode('home/office/light_start_voltage', 230)],
      ['home', 'office'],
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.topicType).toBe('Information');
    expect(items[0]?.isSwitch).toBe(false);
  });

  it('does not render numeric auto values as switch controls in overview', (): void => {
    const items = buildTopicControlItemsFromNodes([buildNode('home/room/custom/value', 1)], ['home', 'room']);

    expect(items).toHaveLength(1);
    expect(items[0]?.topicType).toBe('Information');
    expect(items[0]?.isSwitch).toBe(false);
  });

  it('keeps automatic on/off detection as switch control', (): void => {
    const items = buildTopicControlItemsFromNodes([buildNode('home/room/custom/state', 'on')], ['home', 'room']);

    expect(items).toHaveLength(1);
    expect(items[0]?.topicType).toBe('Switch');
    expect(items[0]?.isSwitch).toBe(true);
    expect(items[0]?.isSwitchOn).toBe(true);
  });

  it('renders parameter enumeration as switch control', (): void => {
    const settingsStore = buildSettingsStoreMock();
    const navSettings = settingsStore.getNavSettings(['home', 'room', 'mode']);
    navSettings.setTopicType('Parameter');
    navSettings.setValueType('Enumeration');
    navSettings.setEnumList(['auto', 'off']);

    const items = buildTopicControlItemsFromNodes(
      [buildNode('home/room/mode', 'off')],
      ['home', 'room'],
      settingsStore,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.isSwitch).toBe(true);
    expect(items[0]?.isSwitchOn).toBe(false);
  });

  it('matches legacy roller on-state semantics for value closed', (): void => {
    const settingsStore = buildSettingsStoreMock();
    settingsStore.getNavSettings(['home', 'room', 'roller']).setTopicType('Roller');
    const items = buildTopicControlItemsFromNodes(
      [buildNode('home/room/roller', 'closed')],
      ['home', 'room'],
      settingsStore,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.topicType).toBe('Roller');
    expect(items[0]?.isSwitch).toBe(true);
    expect(items[0]?.isSwitchOn).toBe(true);
  });
});
