import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyDevVisualEditor, DevVisualEditorError } from './devVisualEditorServer';

const temporaryRoots: string[] = [];

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-dev-editor-'));
  temporaryRoots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, 'src', relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('dev visual editor source apply', () => {
  it('previews and writes a unique text rename', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<button>Reset</button>\n',
    });
    const operations = [{ kind: 'rename' as const, beforeText: 'Reset', afterText: 'Clear' }];
    const preview = await applyDevVisualEditor({ sourceText: 'Reset', operations, dryRun: true }, root);

    expect(preview.filePath).toBe('components/Panel.tsx');
    expect(preview.changed).toBe(true);
    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe('<button>Reset</button>\n');

    const result = await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations,
      dryRun: false,
    }, root);

    expect(result.changed).toBe(true);
    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe('<button>Clear</button>\n');
  });

  it('adds an inline size to a simple JSX element', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<button className="reset">Reset</button>\n',
    });
    const result = await applyDevVisualEditor({
      sourceText: 'Reset',
      operations: [{ kind: 'resize', anchorText: 'Reset', tag: 'button', width: '200px', height: '48px' }],
      dryRun: false,
    }, root).catch((error) => error);

    expect(result).toBeInstanceOf(DevVisualEditorError);
    expect((result as DevVisualEditorError).code).toBe('SOURCE_PREVIEW_REQUIRED');

    const preview = await applyDevVisualEditor({
      sourceText: 'Reset',
      operations: [{ kind: 'resize', anchorText: 'Reset', tag: 'button', width: '200px', height: '48px' }],
      dryRun: true,
    }, root);
    await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations: [{ kind: 'resize', anchorText: 'Reset', tag: 'button', width: '200px', height: '48px' }],
      dryRun: false,
    }, root);

    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe(
      '<button className="reset" style={{ width: "200px", height: "48px" }}>Reset</button>\n'
    );
  });

  it('removes a bounded JSX element', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<div>\n  <p>Reset</p>\n</div>\n',
    });
    const preview = await applyDevVisualEditor({
      sourceText: 'Reset',
      operations: [{ kind: 'remove', anchorText: 'Reset', tag: 'p' }],
      dryRun: true,
    }, root);
    await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations: [{ kind: 'remove', anchorText: 'Reset', tag: 'p' }],
      dryRun: false,
    }, root);

    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe('<div>\n</div>\n');
  });

  it('refuses ambiguous matches and path traversal', async () => {
    const root = await createProject({
      'components/One.tsx': '<span>Reset</span>\n',
      'components/Two.tsx': '<span>Reset</span>\n',
    });

    await expect(applyDevVisualEditor({
      sourceText: 'Reset',
      operations: [{ kind: 'rename', beforeText: 'Reset', afterText: 'Clear' }],
      dryRun: true,
    }, root)).rejects.toMatchObject({ code: 'SOURCE_AMBIGUOUS' });

    await expect(applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: '../server.ts',
      operations: [{ kind: 'rename', beforeText: 'Reset', afterText: 'Clear' }],
      dryRun: true,
    }, root)).rejects.toMatchObject({ code: 'INVALID_FILE_PATH' });
  });

  it('does not edit TypeScript strings or JSX comments', async () => {
    const root = await createProject({
      'components/Panel.tsx': `const label = 'Reset';
export const view = <div>{/* </div> */}<p>Keep</p></div>;
`,
    });

    await expect(applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: 'components/Panel.tsx',
      operations: [{ kind: 'rename', beforeText: 'Reset', afterText: `'+require('child_process').execSync('calc')+'` }],
      dryRun: true,
    }, root)).rejects.toMatchObject({ code: 'SOURCE_TEXT_NOT_FOUND' });

    const preview = await applyDevVisualEditor({
      sourceText: 'Keep',
      filePath: 'components/Panel.tsx',
      operations: [{ kind: 'remove', anchorText: 'Keep', tag: 'p' }],
      dryRun: true,
    }, root);
    await applyDevVisualEditor({
      sourceText: 'Keep',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations: [{ kind: 'remove', anchorText: 'Keep', tag: 'p' }],
      dryRun: false,
    }, root);

    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe(
      `const label = 'Reset';
export const view = <div>{/* </div> */}</div>;
`
    );
  });

  it('rejects duplicate JSX text in one file', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<div><span>Reset</span><span>Reset</span></div>\n',
    });

    await expect(applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: 'components/Panel.tsx',
      operations: [{ kind: 'rename', beforeText: 'Reset', afterText: 'Clear' }],
      dryRun: true,
    }, root)).rejects.toMatchObject({ code: 'SOURCE_TEXT_AMBIGUOUS' });
  });

  it('updates literal style properties and can clear a dimension', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<button style={{ color: "red", width: "10px" }}>Reset</button>\n',
    });
    const operations = [{ kind: 'resize' as const, anchorText: 'Reset', tag: 'button', width: '20px', height: null }];
    const preview = await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: 'components/Panel.tsx',
      operations,
      dryRun: true,
    }, root);
    await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations,
      dryRun: false,
    }, root);

    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe(
      '<button style={{ color: "red", width: "20px" }}>Reset</button>\n'
    );
  });

  it('removes the only style property without leaving a dangling comma', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<button style={{ width: "10px", }}>Reset</button>\n',
    });
    const operations = [{ kind: 'resize' as const, anchorText: 'Reset', tag: 'button', width: null, height: null }];
    const preview = await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: 'components/Panel.tsx',
      operations,
      dryRun: true,
    }, root);
    await applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations,
      dryRun: false,
    }, root);

    expect(await fs.readFile(path.join(root, 'src/components/Panel.tsx'), 'utf8')).toBe(
      '<button style={{  }}>Reset</button>\n'
    );
  });

  it('rejects a write when the source changes after preview', async () => {
    const root = await createProject({
      'components/Panel.tsx': '<button>Reset</button>\n',
    });
    const operations = [{ kind: 'rename' as const, beforeText: 'Reset', afterText: 'Clear' }];
    const preview = await applyDevVisualEditor({
      sourceText: 'Reset',
      operations,
      dryRun: true,
    }, root);
    await fs.appendFile(path.join(root, 'src/components/Panel.tsx'), '// external edit\n', 'utf8');

    await expect(applyDevVisualEditor({
      sourceText: 'Reset',
      filePath: preview.filePath,
      expectedHash: preview.hash,
      operations,
      dryRun: false,
    }, root)).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  });
});
