export type MessageScalar = string | number | boolean | null;

export interface MessageReason {
  timestamp: string;
  message: string;
}

export interface MessageHistoryEntry {
  time?: string;
  value?: MessageScalar;
  reason?: MessageReason[];
}

export interface MessageTopicData {
  topic: string;
  value?: MessageScalar;
  time?: string;
  reason?: MessageReason[];
  history?: MessageHistoryEntry[];
}

export interface MessageStoreDirectRequest {
  topic?: string;
  time: boolean;
  history: boolean;
  reason: boolean;
  levelAmount: number;
  nodes: MessageTopicData[];
}

export interface MessageStoreQueryOptions {
  time: boolean;
  history: boolean;
  reason: boolean;
  levelAmount: number;
}

export interface MessageTreeNode {
  childs: Record<string, MessageTreeNode> | null;
  topic?: string;
  value?: MessageScalar;
  time?: string;
  reason?: MessageReason[];
  history?: MessageHistoryEntry[];
}
