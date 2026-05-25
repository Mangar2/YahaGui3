/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailStatusPanel } from './DetailStatusPanel';
import { createEmptyMessageTree, replaceManyNodes } from '../../../domain/messages/messageTree';
import type { MessageTreeNode, MessageTopicData } from '../../../domain/messages/interfaces';
import { TopicNavSettings, TopicSettingsStore } from '../../../domain/settings/interfaces';

afterEach((): void => {
  cleanup();
});

/**
 * Creates a minimal settings-store mock for detail status tests.
 * @returns {TopicSettingsStore} Store-like object with getNavSettings.
 */
function createSettingsStoreMock(): TopicSettingsStore {
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

/**
 * Builds one message tree from payload entries.
 * @param payload Message payload list.
 * @returns {MessageTreeNode} Message tree.
 */
function buildTree(payload: MessageTopicData[]): MessageTreeNode {
  return replaceManyNodes(createEmptyMessageTree(), payload);
}

/**
 * Renders one detail status panel.
 * @param topic Full topic path.
 * @param topicNode Topic node.
 * @param settingsStore Settings store mock.
 * @param isUpdatingTopic Pending update state.
 * @param onPublishValueChange Publish handler.
 */
function renderStatusPanel(
  topic: string,
  topicNode: MessageTreeNode,
  settingsStore: TopicSettingsStore,
  isUpdatingTopic: boolean,
  onPublishValueChange: (newValue: string) => Promise<void>,
): void {
  render(
    <DetailStatusPanel
      topic={topic}
      messageTree={buildTree([{ topic, value: String(topicNode.value ?? '') }])}
      topicNode={topicNode}
      settingsStore={settingsStore}
      settingsRevision={0}
      isUpdatingTopic={isUpdatingTopic}
      onPublishValueChange={onPublishValueChange}
    />,
  );
}

describe('DetailStatusPanel legacy parity', (): void => {
  it('auto-promotes updatable automatic information topics to Parameter in detail view', (): void => {
    const topic = 'home/room/custom_value';
    const topicNode: MessageTreeNode = {
      topic,
      value: '12',
      childs: {
        set: {
          topic: `${topic}/set`,
          value: '12',
          childs: null,
        },
      },
    };
    const settingsStore = createSettingsStoreMock();

    renderStatusPanel(topic, topicNode, settingsStore, false, vi.fn().mockResolvedValue(undefined));

    expect(screen.getByText('custom_value (Type: Parameter)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
  });

  it('renders enumeration Parameter as select with options and update button', (): void => {
    const topic = 'home/room/mode';
    const topicNode: MessageTreeNode = {
      topic,
      value: 'off',
      childs: null,
    };
    const settingsStore = createSettingsStoreMock();
    const navSettings = settingsStore.getNavSettings(['home', 'room', 'mode']);
    navSettings.setTopicType('Parameter');
    navSettings.setValueType('Enumeration');
    navSettings.setEnumList(['auto', 'off']);

    renderStatusPanel(topic, topicNode, settingsStore, false, vi.fn().mockResolvedValue(undefined));

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'auto' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'off' })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('renders switch control for Switch type and publishes on change', (): void => {
    const topic = 'home/room/switch_main';
    const topicNode: MessageTreeNode = {
      topic,
      value: 'off',
      childs: null,
    };
    const settingsStore = createSettingsStoreMock();
    settingsStore.getNavSettings(['home', 'room', 'switch_main']).setTopicType('Switch');
    const onPublishValueChange = vi.fn().mockResolvedValue(undefined);

    renderStatusPanel(topic, topicNode, settingsStore, false, onPublishValueChange);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onPublishValueChange).toHaveBeenCalledTimes(1);
    expect(onPublishValueChange).toHaveBeenCalledWith('on');
  });

  it('blocks value changes while detail update is pending', (): void => {
    const topic = 'home/room/switch_main';
    const topicNode: MessageTreeNode = {
      topic,
      value: 'off',
      childs: null,
    };
    const settingsStore = createSettingsStoreMock();
    settingsStore.getNavSettings(['home', 'room', 'switch_main']).setTopicType('Switch');
    const onPublishValueChange = vi.fn().mockResolvedValue(undefined);

    renderStatusPanel(topic, topicNode, settingsStore, true, onPublishValueChange);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onPublishValueChange).toHaveBeenCalledTimes(0);
    expect(screen.getByLabelText('Detailwert wird aktualisiert')).toBeTruthy();
  });
});
