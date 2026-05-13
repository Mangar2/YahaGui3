import type { RulePath, Rule, RuleTreeNode } from './interfaces';

/**
 * In-memory rule tree store with navigation and mutation helpers.
 */
export class RuleTreeStore {
  private readonly tree: RuleTreeNode;

  /**
   * @param initialTree Initial tree loaded from API.
   */
  constructor(initialTree: RuleTreeNode) {
    this.tree = cloneTreeNode(initialTree);
  }

  /**
   * Returns a cloned snapshot of the full tree for persistence.
   * @returns {RuleTreeNode} Cloned tree root.
   */
  getSnapshot(): RuleTreeNode {
    return cloneTreeNode(this.tree);
  }

  /**
   * Counts all rules in the current tree.
   * @returns {number} Total rule count.
   */
  countRules(): number {
    return countRulesRec(this.tree);
  }

  /**
   * Gets all child names for the selected folder path.
   * @param path Folder path.
   * @returns {string[]} Sorted child names.
   */
  getNameList(path: RulePath): string[] {
    const folderPath = path.clone();
    folderPath.name = null;
    const node = this.getNode(folderPath);
    if (node?.childs === undefined) {
      return [];
    }

    return Object.keys(node.childs).sort((left: string, right: string): number => left.localeCompare(right));
  }

  /**
   * Gets the currently selected rule.
   * @param path Path that points to a rule.
   * @returns {Rule | null} Rule or null.
   */
  getRule(path: RulePath): Rule | null {
    const node = this.getNode(path);
    if (node?.rule === undefined) {
      return null;
    }

    return cloneRule(node.rule);
  }

  /**
   * Resolves navigation for one selected chunk from current path.
   * @param currentPath Current path.
   * @param chunk Selected chunk.
   * @returns {RulePath} New path.
   */
  getPath(currentPath: RulePath, chunk: string): RulePath {
    const result = currentPath.clone();
    result.name = null;

    const node = this.getNode(result);
    if (node?.childs === undefined) {
      return result;
    }

    const targetNode = node.childs[chunk];
    if (targetNode === undefined) {
      return result;
    }

    if (targetNode.rule !== undefined) {
      result.name = chunk;
    } else {
      result.push(chunk);
    }

    return result;
  }

  /**
   * Adds a new rule in the current folder and selects it.
   * @param currentPath Current path.
   * @returns {RulePath} Path to the newly added rule.
   */
  addRule(currentPath: RulePath): RulePath {
    const folderPath = currentPath.clone();
    folderPath.name = null;

    const parentNode = this.ensureFolderNode(folderPath);
    parentNode.childs ??= {};

    const baseName = 'new';
    const uniqueName = this.createUniqueChildName(parentNode, baseName);
    const newPath = folderPath.clone();
    newPath.name = uniqueName;

    parentNode.childs[uniqueName] = {
      rule: {
        name: newPath.toTopic(),
        topic: '',
      },
    };

    return newPath;
  }

  /**
   * Renames the selected rule path and keeps the existing rule payload.
   * @param sourcePath Current path to the rule.
   * @param targetPath New path for the same rule.
   * @returns {{ success: boolean; error: string | null }} Rename result.
   */
  renameRulePath(sourcePath: RulePath, targetPath: RulePath): { success: boolean; error: string | null } {
    const sourceNode = this.getNode(sourcePath);
    if (sourceNode?.rule === undefined) {
      return { success: false, error: 'Ausgewaehlte Regel wurde nicht gefunden.' };
    }

    const targetName = targetPath.name;
    if (targetName === null || targetName.trim().length === 0) {
      return { success: false, error: 'Regelname ist leer.' };
    }

    const sourceParentPath = sourcePath.clone();
    const sourceKey = sourceParentPath.pop();
    const sourceParentNode = this.getNode(sourceParentPath);
    if (sourceKey === undefined || sourceParentNode?.childs === undefined) {
      return { success: false, error: 'Quellpfad ist ungueltig.' };
    }

    const targetParentPath = targetPath.clone();
    targetParentPath.name = null;
    const targetParentNode = this.ensureFolderNode(targetParentPath);
    targetParentNode.childs ??= {};

    if (sourcePath.toTopic() !== targetPath.toTopic() && targetParentNode.childs[targetName] !== undefined) {
      return { success: false, error: `Eine Regel oder ein Ordner mit dem Namen "${targetName}" existiert bereits.` };
    }

    const movedRule = cloneRule(sourceNode.rule);
    movedRule.name = targetPath.toTopic();

    sourceParentNode.childs = Object.fromEntries(
      Object.entries(sourceParentNode.childs).filter(([childKey]: [string, RuleTreeNode]): boolean => childKey !== sourceKey),
    );
    targetParentNode.childs[targetName] = { rule: movedRule };

    return { success: true, error: null };
  }

  /**
   * Ensures a folder node exists for the given path.
   * @param path Folder path.
   * @returns {RuleTreeNode} Existing or newly created folder node.
   */
  private ensureFolderNode(path: RulePath): RuleTreeNode {
    let current: RuleTreeNode = this.tree;
    current.childs ??= {};

    for (const chunk of path.chunks) {
      current.childs ??= {};
      current.childs[chunk] ??= { childs: {} };
      const next = current.childs[chunk];
      next.childs ??= {};
      current = next;
    }

    return current;
  }

  /**
   * Resolves an existing tree node by path.
   * @param path Path to resolve.
   * @returns {RuleTreeNode | null} Resolved node or null.
   */
  private getNode(path: RulePath): RuleTreeNode | null {
    let current: RuleTreeNode = this.tree;

    for (const chunk of path.chunks) {
      if (current.childs?.[chunk] === undefined) {
        return null;
      }
      current = current.childs[chunk];
    }

    if (path.name !== null) {
      if (current.childs?.[path.name] === undefined) {
        return null;
      }
      return current.childs[path.name];
    }

    return current;
  }

  /**
   * Creates a unique child name in one parent folder.
   * @param parent Parent node.
   * @param baseName Name prefix.
   * @returns {string} Unique child key.
   */
  private createUniqueChildName(parent: RuleTreeNode, baseName: string): string {
    parent.childs ??= {};
    if (parent.childs[baseName] === undefined) {
      return baseName;
    }

    let suffix = 1;
    while (parent.childs[`${baseName}-${String(suffix)}`] !== undefined) {
      suffix += 1;
    }

    return `${baseName}-${String(suffix)}`;
  }
}

/**
 * Counts all rule nodes recursively.
 * @param node Current node.
 * @returns {number} Rule count.
 */
function countRulesRec(node: RuleTreeNode): number {
  let count = node.rule === undefined ? 0 : 1;
  if (node.childs === undefined) {
    return count;
  }

  for (const childNode of Object.values(node.childs)) {
    count += countRulesRec(childNode);
  }

  return count;
}

/**
 * Creates a deep clone of one rule object.
 * @param rule Rule to clone.
 * @returns {Rule} Cloned rule.
 */
function cloneRule(rule: Rule): Rule {
  return structuredClone(rule);
}

/**
 * Creates a deep clone of one rule tree node.
 * @param node Node to clone.
 * @returns {RuleTreeNode} Cloned node.
 */
function cloneTreeNode(node: RuleTreeNode): RuleTreeNode {
  return structuredClone(node);
}
