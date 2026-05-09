import type { MessageTopicData, MessageTreeNode } from './interfaces';
import { splitTopic } from './topicPath';

type MutableMessageTreeNode = {
  childs: Record<string, MutableMessageTreeNode> | null;
  topic?: string;
  value?: string | number | boolean | null;
  time?: string;
  reason?: { timestamp: string; message: string }[];
  history?: { time?: string; value?: string | number | boolean | null; reason?: { timestamp: string; message: string }[] }[];
};

/**
 * Holds the mutable message tree and provides topic-path based access.
 */
export class MessageTree {
  private readonly root: MutableMessageTreeNode = { childs: null };

  /**
   * Adds or updates multiple nodes from an API payload.
   * @param payload Normalized message list from the message-store endpoint.
   */
  public replaceManyNodes(payload: MessageTopicData[]): void {
    for (const message of payload) {
      this.replaceSingleNode(message);
    }
  }

  /**
   * Returns the node represented by topic chunks.
   * @param topicChunks Topic path chunks.
   * @returns Node at path or null if the path is not available.
   */
  public getNodeByTopicChunks(topicChunks: string[]): MessageTreeNode | null {
    let node: MutableMessageTreeNode | null = this.root;
    for (const topicChunk of topicChunks) {
      if (!node?.childs) {
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
   * Returns true when no children are available at root level.
   * @returns True when the tree is empty.
   */
  public isEmpty(): boolean {
    return !this.root.childs || Object.keys(this.root.childs).length === 0;
  }

  /**
   * Creates the missing path and returns the matching node.
   * @param topic Complete topic path.
   * @returns Mutable node at the requested path.
   */
  private getNodeAndAddIfMissing(topic: string): MutableMessageTreeNode {
    const topicChunks = splitTopic(topic);
    let node = this.root;
    for (const topicChunk of topicChunks) {
      if (!node.childs) {
        node.childs = {};
      }
      if (!node.childs[topicChunk]) {
        node.childs[topicChunk] = { childs: null };
      }
      node = node.childs[topicChunk];
    }
    return node;
  }

  /**
   * Replaces one node and merges history like the legacy service.
   * @param message Message topic payload.
   */
  private replaceSingleNode(message: MessageTopicData): void {
    const node = this.getNodeAndAddIfMissing(message.topic);
    node.topic = message.topic;
    node.value = message.value;
    node.time = message.time;
    node.reason = message.reason;
    if (message.history) {
      node.history = message.history;
    }
  }
}
