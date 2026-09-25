export const DEV_VISUAL_EDITOR_MAX_OPERATIONS = 50;

export type DevVisualEditorOperation =
  | {
      kind: 'rename';
      beforeText: string;
      afterText: string;
    }
  | {
      kind: 'resize';
      anchorText: string;
      tag: string;
      width?: string | null;
      height?: string | null;
    }
  | {
      kind: 'remove';
      anchorText: string;
      tag: string;
    };

export interface DevVisualEditorApplyRequest {
  sourceText: string;
  filePath?: string;
  expectedHash?: string;
  dryRun?: boolean;
  operations: DevVisualEditorOperation[];
}

export interface DevVisualEditorCandidate {
  filePath: string;
  occurrences: number;
  line: number;
}

export interface DevVisualEditorApplyResponse {
  ok: true;
  filePath: string;
  hash: string;
  changed: boolean;
}
