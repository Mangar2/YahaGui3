import { describe, expect, it } from 'vitest';
import { buildTopicControlItemsFromNodes, getNewSwitchValue } from './controlElementDecisions';
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

  it('matches legacy automatic topic type mapping and on-off fallback only', (): void => {
    const automaticRoller = buildTopicControlItemsFromNodes(
      [buildNode('home/room/roller shutter', 30)],
      ['home', 'room'],
    );
    const automaticLightSubstring = buildTopicControlItemsFromNodes(
      [buildNode('home/room/light_start_voltage', 230)],
      ['home', 'room'],
    );
    const automaticOnOff = buildTopicControlItemsFromNodes(
      [buildNode('home/room/custom/state', 'on')],
      ['home', 'room'],
    );
    const automaticNonOnOff = buildTopicControlItemsFromNodes(
      [buildNode('home/room/custom/state', 'true')],
      ['home', 'room'],
    );

    expect(automaticRoller[0]?.topicType).toBe('Roller');
    expect(automaticLightSubstring[0]?.topicType).toBe('Information');
    expect(automaticOnOff[0]?.topicType).toBe('Switch');
    expect(automaticNonOnOff[0]?.topicType).toBe('Information');
  });

  it('maps automatic value type to String exactly like legacy', (): void => {
    const automaticValueTypeNumber = buildTopicControlItemsFromNodes(
      [buildNode('home/room/custom/value', 5)],
      ['home', 'room'],
    );
    const automaticValueTypeBoolean = buildTopicControlItemsFromNodes(
      [buildNode('home/room/custom/value', false)],
      ['home', 'room'],
    );

    expect(automaticValueTypeNumber[0]?.valueType).toBe('String');
    expect(automaticValueTypeBoolean[0]?.valueType).toBe('String');
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

  it('renders switch control only for switching topic types or enumeration values', (): void => {
    const settingsStore = buildSettingsStoreMock();
    const infoSettings = settingsStore.getNavSettings(['home', 'room', 'state_info']);
    infoSettings.setTopicType('Information');

    const enumSettings = settingsStore.getNavSettings(['home', 'room', 'state_enum']);
    enumSettings.setTopicType('Information');
    enumSettings.setValueType('Enumeration');
    enumSettings.setEnumList(['on', 'off']);

    const items = buildTopicControlItemsFromNodes(
      [
        buildNode('home/room/state_info', 'on'),
        buildNode('home/room/state_enum', 'off'),
        buildNode('home/room/roller shutter', 'down'),
      ],
      ['home', 'room'],
      settingsStore,
    );

    const byTopic = new Map(items.map((item) => [item.topic, item]));
    expect(byTopic.get('home/room/state_info')?.isSwitch).toBe(false);
    expect(byTopic.get('home/room/state_enum')?.isSwitch).toBe(true);
    expect(byTopic.get('home/room/roller shutter')?.isSwitch).toBe(true);
  });

  it('interprets reached switch state exactly like legacy across types', (): void => {
    const settingsStore = buildSettingsStoreMock();

    const parameterSettings = settingsStore.getNavSettings(['home', 'room', 'mode']);
    parameterSettings.setTopicType('Parameter');
    parameterSettings.setValueType('Enumeration');
    parameterSettings.setEnumList(['auto', 'off', 'sleep']);

    const switchSettings = settingsStore.getNavSettings(['home', 'room', 'forced_switch']);
    switchSettings.setTopicType('Switch');

    const lightSettings = settingsStore.getNavSettings(['home', 'room', 'forced_light']);
    lightSettings.setTopicType('Light');

    const items = buildTopicControlItemsFromNodes(
      [
        buildNode('home/room/forced_switch', 'false'),
        buildNode('home/room/forced_light', '1'),
        buildNode('home/room/roller shutter', 'down'),
        buildNode('home/room/mode', 'sleep'),
        buildNode('home/room/mode', 'auto'),
      ],
      ['home', 'room'],
      settingsStore,
    );

    const byTopicAndValue = new Map(items.map((item) => [`${item.topic}:${item.valueText}`, item]));
    expect(byTopicAndValue.get('home/room/forced_switch:false')?.isSwitchOn).toBe(false);
    expect(byTopicAndValue.get('home/room/forced_light:1')?.isSwitchOn).toBe(true);
    expect(byTopicAndValue.get('home/room/roller shutter:down')?.isSwitchOn).toBe(false);
    expect(byTopicAndValue.get('home/room/mode:sleep')?.isSwitchOn).toBe(false);
    expect(byTopicAndValue.get('home/room/mode:auto')?.isSwitchOn).toBe(true);
  });

  it('builds full control item metadata from node value and settings', (): void => {
    const settingsStore = buildSettingsStoreMock();
    const navSettings = settingsStore.getNavSettings(['home', 'room', 'mode']);
    navSettings.setTopicType('Parameter');
    navSettings.setValueType('Enumeration');
    navSettings.setEnumList(['auto', 'off']);
    navSettings.setIconName('Light');

    const items = buildTopicControlItemsFromNodes(
      [buildNode('home/room/mode', 'off')],
      ['home', 'room'],
      settingsStore,
    );

    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item?.topic).toBe('home/room/mode');
    expect(item?.valueText).toBe('off');
    expect(item?.topicType).toBe('Parameter');
    expect(item?.valueType).toBe('Enumeration');
    expect(item?.enumeration).toEqual(['auto', 'off']);
    expect(item?.isSwitch).toBe(true);
    expect(item?.isSwitchOn).toBe(false);
    expect(item?.unit).toBe('');
    expect(item?.iconAsset).toBe('lightbulb_FILL0_wght400_GRAD0_opsz48.png');
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

  it('prioritizes configured icon over topic text matching', (): void => {
    const settingsStore = buildSettingsStoreMock();
    settingsStore.getNavSettings(['home', 'room', 'temperature']).setIconName('Humidity');

    const items = buildTopicControlItemsFromNodes(
      [buildNode('home/room/temperature', '20')],
      ['home', 'room'],
      settingsStore,
    );

    expect(items[0]?.iconAsset).toBe('humidity_percentage_FILL0_wght400_GRAD0_opsz48.png');
  });

  it('matches topic icon by last chunk before full topic', (): void => {
    const items = buildTopicControlItemsFromNodes(
      [buildNode('home/temperature and humidity sensor/temperature', '20')],
      ['home'],
    );

    expect(items[0]?.iconAsset).toBe('device_thermostat_FILL0_wght400_GRAD0_opsz48.png');
  });

  it('uses stateful icon variant by value for roller', (): void => {
    const closedItems = buildTopicControlItemsFromNodes(
      [buildNode('home/room/roller', 'closed')],
      ['home', 'room'],
    );
    const upItems = buildTopicControlItemsFromNodes(
      [buildNode('home/room/roller', 'up')],
      ['home', 'room'],
    );

    expect(closedItems[0]?.iconAsset).toBe('roller_closed.png');
    expect(upItems[0]?.iconAsset).toBe('roller_open.png');
  });

  it('maps switch interactions to legacy target values', (): void => {
    expect(
      getNewSwitchValue(
        createItemForSwitchValue('Roller', 'String', []),
        true,
      ),
    ).toBe('up');
    expect(
      getNewSwitchValue(
        createItemForSwitchValue('Roller', 'String', []),
        false,
      ),
    ).toBe('down');
    expect(
      getNewSwitchValue(
        createItemForSwitchValue('Switch', 'String', []),
        true,
      ),
    ).toBe('on');
    expect(
      getNewSwitchValue(
        createItemForSwitchValue('Light', 'String', []),
        false,
      ),
    ).toBe('off');
    expect(
      getNewSwitchValue(
        createItemForSwitchValue('Parameter', 'Enumeration', ['auto', 'off']),
        true,
      ),
    ).toBe('auto');
    expect(
      getNewSwitchValue(
        createItemForSwitchValue('Parameter', 'Enumeration', ['auto', 'off']),
        false,
      ),
    ).toBe('off');
  });
});

/**
 * Creates a minimal switch item for getNewSwitchValue tests.
 * @param topicType Topic type.
 * @param valueType Value type.
 * @param enumeration Enumeration list.
 * @returns {import('./controlElementDecisions').TopicControlItem} Switch item.
 */
function createItemForSwitchValue(topicType: string, valueType: string, enumeration: string[]) {
  return {
    topic: 'home/room/topic',
    label: 'topic',
    valueText: '',
    unit: '',
    topicType,
    valueType,
    enumeration,
    isSwitch: true,
    isSwitchOn: false,
    iconAsset: null,
  };
}
