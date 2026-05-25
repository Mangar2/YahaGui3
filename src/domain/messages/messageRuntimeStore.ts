import type { MessageTopicData, MessageTreeNode } from './interfaces';
import { createEmptyMessageTree, getNodeByTopic, replaceManyNodes } from './messageTree';

export type MessageRuntimeListener = (snapshot: MessageTreeNode, payload: MessageTopicData[]) => void;
export type MessageRuntimeWaitPredicate = (snapshot: MessageTreeNode, payload: MessageTopicData[]) => boolean;
export type MessageRuntimeWaitCallback = (snapshot: MessageTreeNode, payload: MessageTopicData[]) => void;

interface MessageRuntimeWaiter {
  id: number;
  predicate: MessageRuntimeWaitPredicate;
  callback: MessageRuntimeWaitCallback;
}

/**
 * Runtime message store that mirrors legacy behavior:
 * one shared tree is updated on every incoming payload.
 */
export class MessageRuntimeStore {
  private tree: MessageTreeNode = createEmptyMessageTree();
  private readonly listeners: Set<MessageRuntimeListener> = new Set<MessageRuntimeListener>();
  private readonly waiters: Map<number, MessageRuntimeWaiter> = new Map<number, MessageRuntimeWaiter>();
  private nextWaiterId = 1;

  /**
   * Returns the current shared tree snapshot.
   * @returns {MessageTreeNode} Current message-tree snapshot.
   */
  public getSnapshot(): MessageTreeNode {
    return this.tree;
  }

  /**
   * Ingests one payload into the shared tree and notifies subscribers.
   * @param payload Incoming message payload.
   * @returns {MessageTreeNode} Updated tree snapshot.
   */
  public ingest(payload: MessageTopicData[]): MessageTreeNode {
    this.tree = replaceManyNodes(this.tree, payload);
    this.triggerWaiters(payload);
    for (const listener of this.listeners) {
      listener(this.tree, payload);
    }
    return this.tree;
  }

  /**
   * Subscribes to tree updates.
   * @param listener Listener called after every ingest operation.
   * @returns {() => void} Unsubscribe function.
   */
  public subscribe(listener: MessageRuntimeListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Registers a central waiter callback that is evaluated on every ingest.
   * @param predicate Predicate that decides whether waiting is complete.
   * @param callback Callback fired once when predicate becomes true.
   * @returns {() => void} Function to unregister the waiter.
   */
  public registerWaiter(predicate: MessageRuntimeWaitPredicate, callback: MessageRuntimeWaitCallback): () => void {
    const waiterId = this.nextWaiterId;
    this.nextWaiterId += 1;

    const waiter: MessageRuntimeWaiter = {
      id: waiterId,
      predicate,
      callback,
    };
    this.waiters.set(waiterId, waiter);

    return (): void => {
      this.waiters.delete(waiterId);
    };
  }

  /**
   * Reads one topic value from the shared tree.
   * @param topic Topic path.
   * @returns {string | null} Topic value as string, or null when missing.
   */
  public getTopicValue(topic: string): string | null {
    const node = getNodeByTopic(this.tree, topic);
    if (!node || node.value === undefined) {
      return null;
    }
    return String(node.value);
  }

  /**
   * Resets the store to an empty tree.
   * Intended for deterministic tests.
   */
  public reset(): void {
    this.tree = createEmptyMessageTree();
    this.waiters.clear();
  }

  /**
   * Evaluates and triggers all registered waiters for the current ingest payload.
   * Waiters are one-shot and are removed after successful callback execution.
   * @param payload Incoming payload for the current ingest call.
   */
  private triggerWaiters(payload: MessageTopicData[]): void {
    const resolvedWaiterIds: number[] = [];
    for (const waiter of this.waiters.values()) {
      if (!waiter.predicate(this.tree, payload)) {
        continue;
      }
      resolvedWaiterIds.push(waiter.id);
      waiter.callback(this.tree, payload);
    }

    for (const waiterId of resolvedWaiterIds) {
      this.waiters.delete(waiterId);
    }
  }
}

const messageRuntimeStore = new MessageRuntimeStore();

/**
 * Returns the singleton runtime store shared by all message flows.
 * @returns {MessageRuntimeStore} Global runtime store.
 */
export function getMessageRuntimeStore(): MessageRuntimeStore {
  return messageRuntimeStore;
}
