import type { MessageTopicData, MessageTreeNode } from './interfaces';
import { splitTopic } from './topicPath';

/**
 * Creates a new empty message tree root node.
 * @returns Empty message tree.
 */
export function createEmptyMessageTree(): MessageTreeNode {
  return { childs: null };
}

/**
 * Returns a node by topic chunks.
 * @param tree Message tree root node.
 * @param topicChunks Topic chunks for lookup.
 * @returns Matching node or null.
 */
export function getNodeByTopicChunks(tree: MessageTreeNode, topicChunks: string[]): MessageTreeNode | null {
  let node: MessageTreeNode | null = tree;
  for (const topicChunk of topicChunks) {
    if (!node.childs) {
      return null;
    }
    const child = node.childs[topicChunk];
    if (!child) {
      return null;
    }
    node = child;
  }
  return node;
}

/**
 * Replaces many nodes in immutable fashion.
 * @param tree Current tree root.
 * @param payload Topic data payload from backend.
 * @returns Updated tree root.
 */
export function replaceManyNodes(tree: MessageTreeNode, payload: MessageTopicData[]): MessageTreeNode {
  let nextTree = tree;
  for (const message of payload) {
    nextTree = replaceSingleNode(nextTree, message);
  }
  return nextTree;
}

/**
 * Replaces one topic node and keeps all unrelated branches untouched.
 * @param tree Current tree root.
 * @param message Message topic payload.
 * @returns Updated tree root.
 */
function replaceSingleNode(tree: MessageTreeNode, message: MessageTopicData): MessageTreeNode {
  const topicChunks = splitTopic(message.topic);
  if (topicChunks.length === 0) {
    return applyMessageToNode(tree, message);
  }

  return updateAtPath(tree, topicChunks, 0, message);
}

/**
 * Recursively clones only the touched branch and applies message data at leaf.
 * @param node Current node in recursion.
 * @param topicChunks Full topic path chunks.
 * @param depth Current recursion depth.
 * @param message Message payload to apply.
 * @returns Updated node.
 */
function updateAtPath(node: MessageTreeNode, topicChunks: string[], depth: number, message: MessageTopicData): MessageTreeNode {
  if (depth >= topicChunks.length) {
    return applyMessageToNode(node, message);
  }

  const topicChunk = topicChunks[depth];
  const currentChilds = node.childs ?? {};
  const currentChild = currentChilds[topicChunk] ?? createEmptyMessageTree();
  const updatedChild = updateAtPath(currentChild, topicChunks, depth + 1, message);

  return {
    ...node,
    childs: {
      ...currentChilds,
      [topicChunk]: updatedChild,
    },
  };
}

/**
 * Applies topic payload values to one node while preserving history behavior from legacy implementation.
 * @param node Existing node.
 * @param message Message payload.
 * @returns Updated node.
 */
function applyMessageToNode(node: MessageTreeNode, message: MessageTopicData): MessageTreeNode {
  const updatedNode: MessageTreeNode = {
    ...node,
    topic: message.topic,
    value: message.value,
    time: message.time,
    reason: message.reason,
  };

  // Legacy behavior: if history is missing in the new payload, keep old history.
  if (message.history) {
    updatedNode.history = message.history;
  }

  return updatedNode;
}
