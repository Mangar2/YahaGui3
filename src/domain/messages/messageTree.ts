import type { MessageTopicData, MessageTreeNode } from './interfaces';
import { splitTopic } from './topicPath';

/**
 * Creates a new empty message tree root node.
 * @returns {MessageTreeNode} Empty message tree.
 */
export function createEmptyMessageTree(): MessageTreeNode {
  return { childs: null };
}

/**
 * Returns a node by topic chunks.
 * @param tree Message tree root node.
 * @param topicChunks Topic chunks for lookup.
 * @returns {MessageTreeNode | null} Matching node or null.
 */
export function getNodeByTopicChunks(tree: MessageTreeNode, topicChunks: string[]): MessageTreeNode | null {
  let node: MessageTreeNode | null = tree;
  for (const topicChunk of topicChunks) {
    if (!node.childs) {
      return null;
    }
    const childCandidate: MessageTreeNode | undefined = node.childs[topicChunk];
    if (typeof childCandidate === 'undefined') {
      return null;
    }
    node = childCandidate;
  }
  return node;
}

/**
 * Returns a node by full topic path.
 * @param tree Message tree root node.
 * @param topic Full topic path.
 * @returns {MessageTreeNode | null} Matching node or null.
 */
export function getNodeByTopic(tree: MessageTreeNode, topic: string): MessageTreeNode | null {
  return getNodeByTopicChunks(tree, splitTopic(topic));
}

/**
 * Replaces many nodes in immutable fashion.
 * @param tree Current tree root.
 * @param payload Topic data payload from backend.
 * @returns {MessageTreeNode} Updated tree root.
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
 * @returns {MessageTreeNode} Updated tree root.
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
 * @returns {MessageTreeNode} Updated node.
 */
function updateAtPath(node: MessageTreeNode, topicChunks: string[], depth: number, message: MessageTopicData): MessageTreeNode {
  if (depth >= topicChunks.length) {
    return applyMessageToNode(node, message);
  }

  const topicChunk = topicChunks[depth];
  if (typeof topicChunk !== 'string') {
    return applyMessageToNode(node, message);
  }
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
 * @returns {MessageTreeNode} Updated node.
 */
function applyMessageToNode(node: MessageTreeNode, message: MessageTopicData): MessageTreeNode {
  const updatedNodeBase: MessageTreeNode = {
    childs: node.childs,
    topic: message.topic,
  };

  const updatedNode: MessageTreeNode = {
    ...updatedNodeBase,
    ...(message.value !== undefined ? { value: message.value } : {}),
    ...(message.time !== undefined ? { time: message.time } : {}),
    ...(message.reason !== undefined ? { reason: message.reason } : {}),
  };

  // Legacy behavior: if history is missing in the new payload, keep old history.
  if (message.history !== undefined) {
    updatedNode.history = message.history;
  } else if (node.history !== undefined) {
    updatedNode.history = node.history;
  }

  return updatedNode;
}
