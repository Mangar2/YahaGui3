import { describe, expect, it } from 'vitest';
import { deriveDisplayName } from './displayName';
import { createEmptyMessageTree, replaceManyNodes } from './messageTree';
import type { MessageTreeNode, MessageTopicData } from './interfaces';

/**
 * Builds a message tree from topics for display-name ambiguity tests.
 * @param topics Topic list used to populate the tree.
 * @returns {MessageTreeNode} Message tree containing all listed topics.
 */
function buildTree(topics: string[]): MessageTreeNode {
  const payload: MessageTopicData[] = topics.map((topic: string): MessageTopicData => {
    return {
      topic,
      value: 'on',
    };
  });
  return replaceManyNodes(createEmptyMessageTree(), payload);
}

describe('deriveDisplayName legacy parity catalog', (): void => {
  it('matches legacy-equivalent naming for representative overview and detail scenarios', (): void => {
    const messageTree = buildTree([
      'home/wardrobe/ventilation/power',
      'home/wardrobe/light/power',
      'home/bedroom/light/power',
      'home/wardrobe/switch/power',
      'home/office/pcpower',
      'home/office/temperature',
      'home/bathroom/humidity',
      'home/wardrobe/ventilation/state',
    ]);

    const cases = [
      {
        id: 'overview-root-ambiguous-power',
        topic: 'home/wardrobe/ventilation/power',
        currentTopicChunks: ['home'],
      },
      {
        id: 'overview-room-ambiguous-power',
        topic: 'home/wardrobe/ventilation/power',
        currentTopicChunks: ['home', 'wardrobe'],
      },
      {
        id: 'overview-switch-prefix-is-skipped',
        topic: 'home/wardrobe/switch/power',
        currentTopicChunks: ['home'],
      },
      {
        id: 'overview-unique-state-no-prefix',
        topic: 'home/wardrobe/ventilation/state',
        currentTopicChunks: ['home', 'wardrobe'],
      },
      {
        id: 'detail-cross-room-ambiguous-power',
        topic: 'home/wardrobe/ventilation/power',
        currentTopicChunks: [],
      },
      {
        id: 'detail-pc-special-case',
        topic: 'home/office/pcpower',
        currentTopicChunks: [],
      },
      {
        id: 'detail-type-based-temperature',
        topic: 'home/office/temperature',
        currentTopicChunks: [],
      },
      {
        id: 'detail-type-based-humidity',
        topic: 'home/bathroom/humidity',
        currentTopicChunks: [],
      },
    ].map((testCase) => {
      return {
        id: testCase.id,
        topic: testCase.topic,
        currentTopicChunks: testCase.currentTopicChunks,
        displayName: deriveDisplayName(testCase.topic, {
          currentTopicChunks: testCase.currentTopicChunks,
          messageTree,
        }),
      };
    });

    expect(cases).toMatchInlineSnapshot(`
      [
        {
          "currentTopicChunks": [
            "home",
          ],
          "displayName": "Wardrobe Ventilation Power",
          "id": "overview-root-ambiguous-power",
          "topic": "home/wardrobe/ventilation/power",
        },
        {
          "currentTopicChunks": [
            "home",
            "wardrobe",
          ],
          "displayName": "Ventilation Power",
          "id": "overview-room-ambiguous-power",
          "topic": "home/wardrobe/ventilation/power",
        },
        {
          "currentTopicChunks": [
            "home",
          ],
          "displayName": "Wardrobe Power",
          "id": "overview-switch-prefix-is-skipped",
          "topic": "home/wardrobe/switch/power",
        },
        {
          "currentTopicChunks": [
            "home",
            "wardrobe",
          ],
          "displayName": "State",
          "id": "overview-unique-state-no-prefix",
          "topic": "home/wardrobe/ventilation/state",
        },
        {
          "currentTopicChunks": [],
          "displayName": "Wardrobe Ventilation Power",
          "id": "detail-cross-room-ambiguous-power",
          "topic": "home/wardrobe/ventilation/power",
        },
        {
          "currentTopicChunks": [],
          "displayName": "PC Power",
          "id": "detail-pc-special-case",
          "topic": "home/office/pcpower",
        },
        {
          "currentTopicChunks": [],
          "displayName": "Temperature",
          "id": "detail-type-based-temperature",
          "topic": "home/office/temperature",
        },
        {
          "currentTopicChunks": [],
          "displayName": "Humidity",
          "id": "detail-type-based-humidity",
          "topic": "home/bathroom/humidity",
        },
      ]
    `);
  });
});
