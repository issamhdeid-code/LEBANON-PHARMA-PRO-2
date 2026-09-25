import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { DEV_VISUAL_EDITOR_MAX_OPERATIONS } from '../types/devVisualEditor';
import type {
  DevVisualEditorApplyRequest,
  DevVisualEditorApplyResponse,
  DevVisualEditorCandidate,
  DevVisualEditorOperation,
} from '../types/devVisualEditor';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const MAX_TEXT_LENGTH = 500;
const MAX_STYLE_LENGTH = 120;
const MAX_CANDIDATES = 40;

type TypeScriptApi = typeof import('typescript');
type TypeScriptNode = import('typescript').Node;
type TypeScriptSourceFile = import('typescript').SourceFile;
type TypeScriptJsxElement = import('typescript').JsxElement;
type TypeScriptJsxOpeningElement = import('typescript').JsxOpeningElement;
type TypeScriptJsxAttribute = import('typescript').JsxAttribute;
type TypeScriptStringLiteralLike = import('typescript').StringLiteral | import('typescript').NoSubstitutionTemplateLiteral;

type SourceRoot = {
  root: string;
  files: string[];
};

type TextEdit = {
  start: number;
  end: number;
  text: string;
};

type JsxTextMatch = {
  node: TypeScriptNode;
  value: string;
  ancestors: TypeScriptNode[];
  literal?: TypeScriptStringLiteralLike;
};

export class DevVisualEditorError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DevVisualEditorError';
  }
}

function fail(status: number, code: string, message: string, details?: Record<string, unknown>): never {
  throw new DevVisualEditorError(status, code, message, details);
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isSafeReplacementText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_TEXT_LENGTH
    && !/[\r\n<>{}]/u.test(value);
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toRelativeSourcePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
}

let typescriptModule: Promise<TypeScriptApi> | undefined;

async function getTypeScript(): Promise<TypeScriptApi> {
  if (!typescriptModule) {
    typescriptModule = import('typescript').catch(() => {
      typescriptModule = undefined;
      fail(503, 'DEV_PARSER_UNAVAILABLE', 'The development source parser is unavailable.');
    });
  }
  return typescriptModule;
}

async function listSourceFiles(rootDir: string): Promise<SourceRoot> {
  const requestedRoot = path.resolve(rootDir, 'src');
  const root = await fs.realpath(requestedRoot);
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  files.sort();
  return { root, files };
}

async function resolveSourceFile(root: string, filePath: string): Promise<string> {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > 300) {
    fail(400, 'INVALID_FILE_PATH', 'Choose a valid source file.');
  }

  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const relativeInput = normalized.startsWith('src/') ? normalized.slice(4) : normalized;
  const absolutePath = path.resolve(root, relativeInput);
  const relative = path.relative(root, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(403, 'INVALID_FILE_PATH', 'The source file must be inside src/.');
  }
  if (!SOURCE_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
    fail(400, 'INVALID_FILE_PATH', 'Only TypeScript and JavaScript source files can be changed.');
  }

  let realRoot: string;
  let realFile: string;
  try {
    realRoot = await fs.realpath(root);
    realFile = await fs.realpath(absolutePath);
  } catch {
    fail(404, 'SOURCE_NOT_FOUND', 'The selected source file was not found.');
  }
  if (!isWithin(realRoot, realFile)) {
    fail(403, 'INVALID_FILE_PATH', 'The source file must be inside src/.');
  }
  return realFile;
}

function normalizeTag(value: unknown, code: string, message: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z][\w:.-]*$/u.test(value) || value.length > 80) {
    fail(400, code, message);
  }
  return value;
}

function normalizeResizeValue(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_STYLE_LENGTH) {
    fail(400, 'INVALID_RESIZE', `Resize ${field} is invalid.`);
  }
  return value.trim() || null;
}

function validateRequest(value: unknown): DevVisualEditorApplyRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(400, 'INVALID_REQUEST', 'A visual-editor request is required.');
  }
  const request = value as Partial<DevVisualEditorApplyRequest>;
  if (typeof request.sourceText !== 'string' || request.sourceText.length > MAX_TEXT_LENGTH) {
    fail(400, 'INVALID_SOURCE_TEXT', 'The selected source text is invalid.');
  }
  if (request.filePath !== undefined && typeof request.filePath !== 'string') {
    fail(400, 'INVALID_FILE_PATH', 'The source file path is invalid.');
  }
  if (request.expectedHash !== undefined && typeof request.expectedHash !== 'string') {
    fail(400, 'INVALID_HASH', 'The source confirmation hash is invalid.');
  }
  if (!Array.isArray(request.operations) || request.operations.length === 0 || request.operations.length > DEV_VISUAL_EDITOR_MAX_OPERATIONS) {
    fail(400, 'INVALID_OPERATIONS', `Between one and ${DEV_VISUAL_EDITOR_MAX_OPERATIONS} visual-editor operations are required.`);
  }

  const operations: DevVisualEditorOperation[] = request.operations.map((operation) => {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      fail(400, 'INVALID_OPERATIONS', 'A visual-editor operation is invalid.');
    }
    const candidate = operation as Record<string, unknown>;
    if (candidate.kind === 'rename') {
      if (!isSafeText(candidate.beforeText, MAX_TEXT_LENGTH) || !isSafeReplacementText(candidate.afterText)) {
        fail(400, 'INVALID_RENAME', 'Rename text is invalid or longer than 500 characters.');
      }
      return {
        kind: 'rename',
        beforeText: normalizeText(candidate.beforeText),
        afterText: candidate.afterText,
      };
    }
    if (candidate.kind === 'resize') {
      if (!isSafeText(candidate.anchorText, MAX_TEXT_LENGTH)) {
        fail(400, 'INVALID_RESIZE', 'Resize needs a selected text anchor.');
      }
      const tag = normalizeTag(candidate.tag, 'INVALID_RESIZE', 'Resize needs a valid element tag.');
      const width = normalizeResizeValue(candidate.width, 'width');
      const height = normalizeResizeValue(candidate.height, 'height');
      if (width === undefined && height === undefined) {
        fail(400, 'INVALID_RESIZE', 'Resize needs at least one width or height value.');
      }
      return {
        kind: 'resize',
        anchorText: normalizeText(candidate.anchorText),
        tag,
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
      };
    }
    if (candidate.kind === 'remove') {
      if (!isSafeText(candidate.anchorText, MAX_TEXT_LENGTH)) {
        fail(400, 'INVALID_REMOVE', 'Remove needs a selected text anchor.');
      }
      return {
        kind: 'remove',
        anchorText: normalizeText(candidate.anchorText),
        tag: normalizeTag(candidate.tag, 'INVALID_REMOVE', 'Remove needs a valid element tag.'),
      };
    }
    fail(400, 'INVALID_OPERATIONS', 'The visual-editor operation type is not supported.');
  });

  return {
    sourceText: normalizeText(request.sourceText),
    filePath: request.filePath,
    expectedHash: request.expectedHash,
    dryRun: request.dryRun !== false,
    operations,
  };
}

function parseSourceFile(ts: TypeScriptApi, filePath: string, content: string): TypeScriptSourceFile {
  const extension = path.extname(filePath).toLowerCase();
  const scriptKind = extension === '.tsx'
    ? ts.ScriptKind.TSX
    : extension === '.jsx'
      ? ts.ScriptKind.JSX
      : extension === '.ts'
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
  const parseDiagnostics = (sourceFile as TypeScriptSourceFile & {
    parseDiagnostics?: readonly import('typescript').Diagnostic[];
  }).parseDiagnostics;
  if (parseDiagnostics && parseDiagnostics.length > 0) {
    fail(422, 'SOURCE_PARSE_FAILED', 'The source file could not be parsed safely.');
  }
  return sourceFile;
}

function getJsxTextValue(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  node: TypeScriptNode,
): { value: string; literal?: TypeScriptStringLiteralLike } | null {
  if (ts.isJsxText(node)) {
    return { value: node.getText(sourceFile) };
  }
  if (ts.isJsxExpression(node) && node.expression) {
    const expression = node.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return { value: expression.text, literal: expression };
    }
  }
  return null;
}

function collectJsxTextMatches(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  text: string,
): JsxTextMatch[] {
  const expected = normalizeText(text);
  if (!expected) return [];
  const matches: JsxTextMatch[] = [];
  const visit = (node: TypeScriptNode, ancestors: TypeScriptNode[]): void => {
    const value = getJsxTextValue(ts, sourceFile, node);
    if (value && normalizeText(value.value) === expected) {
      matches.push({ node, value: expected, ancestors, literal: value.literal });
    }
    ts.forEachChild(node, (child) => visit(child, [...ancestors, node]));
  };
  visit(sourceFile, []);
  return matches;
}

function findUniqueTextMatch(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  text: string,
): JsxTextMatch {
  const matches = collectJsxTextMatches(ts, sourceFile, text);
  if (matches.length === 0) {
    fail(409, 'SOURCE_TEXT_NOT_FOUND', `The source no longer contains the JSX text "${text}".`);
  }
  if (matches.length > 1) {
    fail(409, 'SOURCE_TEXT_AMBIGUOUS', `The source contains more than one JSX text match for "${text}".`);
  }
  return matches[0];
}

function jsxTagName(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  tagName: import('typescript').JsxTagNameExpression,
): string | null {
  if (ts.isIdentifier(tagName) || ts.isJsxNamespacedName(tagName)) {
    return tagName.getText(sourceFile);
  }
  return null;
}

function findUniqueEnclosingElement(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  match: JsxTextMatch,
  tag: string,
): TypeScriptJsxElement {
  const candidates: TypeScriptJsxElement[] = [];
  const expectedTag = tag;
  for (const ancestor of match.ancestors) {
    if (!ts.isJsxElement(ancestor)) continue;
    const ancestorTag = jsxTagName(ts, sourceFile, ancestor.openingElement.tagName);
    if (ancestorTag === expectedTag) candidates.push(ancestor);
  }
  if (candidates.length !== 1) {
    fail(
      422,
      'SOURCE_ELEMENT_NOT_FOUND',
      'The selected DOM tag does not identify one JSX element for this text anchor.',
    );
  }
  return candidates[0];
}

function applyTextEdits(content: string, edits: TextEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let previousStart = content.length + 1;
  let next = content;
  for (const edit of ordered) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > content.length || edit.end > previousStart) {
      fail(500, 'SOURCE_EDIT_INVALID', 'The source edit could not be applied safely.');
    }
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
    previousStart = edit.start;
  }
  return next;
}

function replacementForJsxText(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  match: JsxTextMatch,
  replacement: string,
): TextEdit {
  if (ts.isJsxText(match.node)) {
    const raw = match.node.getText(sourceFile);
    const leadingWhitespace = raw.length - raw.trimStart().length;
    const trailingWhitespace = raw.length - raw.trimEnd().length;
    return {
      start: match.node.getStart(sourceFile) + leadingWhitespace,
      end: match.node.getEnd() - trailingWhitespace,
      text: replacement,
    };
  }
  if (match.literal) {
    return {
      start: match.literal.getStart(sourceFile),
      end: match.literal.getEnd(),
      text: JSON.stringify(replacement),
    };
  }
  fail(500, 'SOURCE_EDIT_INVALID', 'The JSX text edit could not be bounded safely.');
}

function replaceRename(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  content: string,
  operation: Extract<DevVisualEditorOperation, { kind: 'rename' }>,
): string {
  if (operation.beforeText === operation.afterText) return content;
  const match = findUniqueTextMatch(ts, sourceFile, operation.beforeText);
  return applyTextEdits(content, [replacementForJsxText(ts, sourceFile, match, operation.afterText)]);
}

function findStyleAttribute(
  ts: TypeScriptApi,
  opening: TypeScriptJsxOpeningElement,
): TypeScriptJsxAttribute | null {
  const attributes = opening.attributes.properties.filter(ts.isJsxAttribute);
  const styleAttributes = attributes.filter((attribute) => attribute.name.getText().toLowerCase() === 'style');
  if (styleAttributes.length > 1) {
    fail(422, 'STYLE_PROP_AMBIGUOUS', 'The selected JSX element has multiple style props.');
  }
  return styleAttributes[0] || null;
}

function getStyleObjectLiteral(
  ts: TypeScriptApi,
  styleAttribute: TypeScriptJsxAttribute,
): import('typescript').ObjectLiteralExpression {
  const initializer = styleAttribute.initializer;
  if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression || !ts.isObjectLiteralExpression(initializer.expression)) {
    fail(422, 'STYLE_PROP_UNSUPPORTED', 'Resize needs a JSX style object with literal properties.');
  }
  return initializer.expression;
}

function propertyName(
  ts: TypeScriptApi,
  property: import('typescript').ObjectLiteralElementLike,
): string | null {
  if (!('name' in property) || !property.name) return null;
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function removeObjectPropertyEdit(
  sourceFile: TypeScriptSourceFile,
  objectLiteral: import('typescript').ObjectLiteralExpression,
  property: import('typescript').ObjectLiteralElementLike,
): TextEdit {
  const index = objectLiteral.properties.indexOf(property);
  const next = objectLiteral.properties[index + 1];
  const previous = objectLiteral.properties[index - 1];
  if (next) {
    return { start: property.getStart(sourceFile), end: next.getStart(sourceFile), text: '' };
  }
  if (previous) {
    return { start: previous.getEnd(), end: property.getEnd(), text: '' };
  }
  const trailing = sourceFile.text.slice(property.getEnd(), objectLiteral.getEnd() - 1);
  const trailingComma = trailing.match(/^\s*,/u);
  return {
    start: property.getStart(sourceFile),
    end: property.getEnd() + (trailingComma ? trailingComma[0].length : 0),
    text: '',
  };
}

function insertObjectPropertiesEdit(
  sourceFile: TypeScriptSourceFile,
  objectLiteral: import('typescript').ObjectLiteralExpression,
  properties: Array<{ name: string; value: string }>,
): TextEdit {
  const raw = objectLiteral.getText(sourceFile);
  const closingIndex = raw.length - 1;
  const beforeClosing = raw.slice(0, closingIndex);
  const separator = objectLiteral.properties.length > 0 && !beforeClosing.trimEnd().endsWith(',') ? ', ' : ' ';
  const text = properties.map(({ name, value }) => `${name}: ${JSON.stringify(value)}`).join(', ');
  return {
    start: objectLiteral.getEnd() - 1,
    end: objectLiteral.getEnd() - 1,
    text: `${separator}${text} `,
  };
}

function resizeElement(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  content: string,
  operation: Extract<DevVisualEditorOperation, { kind: 'resize' }>,
): string {
  const match = findUniqueTextMatch(ts, sourceFile, operation.anchorText);
  const element = findUniqueEnclosingElement(ts, sourceFile, match, operation.tag);
  const opening = element.openingElement;
  const requested = [
    { name: 'width', value: operation.width },
    { name: 'height', value: operation.height },
  ].filter((entry): entry is { name: string; value: string | null } => entry.value !== undefined);
  if (requested.length === 0) return content;

  const styleAttribute = findStyleAttribute(ts, opening);
  if (!styleAttribute) {
    const properties = requested
      .filter((entry): entry is { name: string; value: string } => entry.value !== null)
      .map((entry) => ({ name: entry.name, value: entry.value }));
    if (properties.length === 0) return content;
    const raw = opening.getText(sourceFile);
    const closingIndex = raw.lastIndexOf('>');
    if (closingIndex < 0) fail(422, 'SOURCE_ELEMENT_NOT_FOUND', 'The selected JSX opening tag could not be bounded.');
    const styleProp = ` style={{ ${properties.map(({ name, value }) => `${name}: ${JSON.stringify(value)}`).join(', ')} }}`;
    return applyTextEdits(content, [{
      start: opening.getEnd() - 1,
      end: opening.getEnd() - 1,
      text: styleProp,
    }]);
  }

  const objectLiteral = getStyleObjectLiteral(ts, styleAttribute);
  if (objectLiteral.properties.some((property) => ts.isSpreadAssignment(property))) {
    fail(422, 'STYLE_PROP_UNSUPPORTED', 'Resize cannot safely edit a style object containing a spread property.');
  }
  const edits: TextEdit[] = [];
  const additions: Array<{ name: string; value: string }> = [];
  for (const request of requested) {
    const matching = objectLiteral.properties.filter((property) => propertyName(ts, property) === request.name);
    if (matching.length > 1) {
      fail(422, 'STYLE_PROP_AMBIGUOUS', `The selected JSX element has multiple ${request.name} style properties.`);
    }
    const property = matching[0];
    if (!property) {
      if (request.value !== null) additions.push({ name: request.name, value: request.value });
      continue;
    }
    if (!ts.isPropertyAssignment(property)) {
      fail(422, 'STYLE_PROP_UNSUPPORTED', `The selected ${request.name} style property is not a literal assignment.`);
    }
    if (request.value === null) {
      edits.push(removeObjectPropertyEdit(sourceFile, objectLiteral, property));
    } else {
      const initializer = property.initializer;
      if (!ts.isStringLiteral(initializer)
          && !ts.isNoSubstitutionTemplateLiteral(initializer)
          && !ts.isNumericLiteral(initializer)) {
        fail(422, 'STYLE_PROP_UNSUPPORTED', `The selected ${request.name} style property is not a literal value.`);
      }
      edits.push({
        start: initializer.getStart(sourceFile),
        end: initializer.getEnd(),
        text: JSON.stringify(request.value),
      });
    }
  }
  if (additions.length > 0) {
    edits.push(insertObjectPropertiesEdit(sourceFile, objectLiteral, additions));
  }
  return applyTextEdits(content, edits);
}

function removeElement(
  ts: TypeScriptApi,
  sourceFile: TypeScriptSourceFile,
  content: string,
  element: TypeScriptJsxElement,
): string {
  const start = element.getStart(sourceFile);
  const end = element.getEnd();
  const lineStart = content.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = content.indexOf('\n', end);
  const lineEnd = lineEndIndex < 0 ? content.length : lineEndIndex;
  const line = content.slice(lineStart, lineEnd);
  const beforeText = line.slice(0, start - lineStart);
  const afterText = line.slice(end - lineStart);
  if (!beforeText.trim() && !afterText.trim()) {
    return content.slice(0, lineStart) + content.slice(lineEndIndex < 0 ? content.length : lineEndIndex + 1);
  }
  return applyTextEdits(content, [{ start, end, text: '' }]);
}

function applyOperation(
  ts: TypeScriptApi,
  filePath: string,
  content: string,
  operation: DevVisualEditorOperation,
): string {
  const sourceFile = parseSourceFile(ts, filePath, content);
  if (operation.kind === 'rename') {
    return replaceRename(ts, sourceFile, content, operation);
  }
  const match = findUniqueTextMatch(ts, sourceFile, operation.anchorText);
  const element = findUniqueEnclosingElement(ts, sourceFile, match, operation.tag);
  if (operation.kind === 'resize') {
    return resizeElement(ts, sourceFile, content, operation);
  }
  return removeElement(ts, sourceFile, content, element);
}

function applyOperations(
  ts: TypeScriptApi,
  filePath: string,
  content: string,
  operations: DevVisualEditorOperation[],
): string {
  let next = content;
  for (const operation of operations) {
    next = applyOperation(ts, filePath, next, operation);
  }
  return next;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function findCandidates(
  ts: TypeScriptApi,
  sourceRoot: SourceRoot,
  request: DevVisualEditorApplyRequest,
): Promise<DevVisualEditorCandidate[]> {
  const terms = [
    ...request.operations.map((operation) => operation.kind === 'rename' ? operation.beforeText : operation.anchorText),
    request.sourceText,
  ]
    .map((term) => term.trim())
    .filter((term, index, all) => term.length > 0 && all.indexOf(term) === index);
  const candidates: DevVisualEditorCandidate[] = [];

  for (const filePath of sourceRoot.files) {
    const content = await fs.readFile(filePath, 'utf8');
    let sourceFile: TypeScriptSourceFile;
    try {
      sourceFile = parseSourceFile(ts, filePath, content);
    } catch (error) {
      if (error instanceof DevVisualEditorError && error.code === 'SOURCE_PARSE_FAILED') continue;
      throw error;
    }
    let occurrences = 0;
    let firstIndex = Number.POSITIVE_INFINITY;
    for (const term of terms) {
      const matches = collectJsxTextMatches(ts, sourceFile, term);
      occurrences += matches.length;
      for (const match of matches) firstIndex = Math.min(firstIndex, match.node.getStart(sourceFile));
    }
    if (occurrences > 0) {
      candidates.push({
        filePath: toRelativeSourcePath(sourceRoot.root, filePath),
        occurrences,
        line: lineNumberAt(content, firstIndex),
      });
    }
  }

  return candidates
    .sort((a, b) => a.occurrences - b.occurrences || a.filePath.localeCompare(b.filePath))
    .slice(0, MAX_CANDIDATES);
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, Math.max(index, 0)).split('\n').length;
}

async function writeSourceAtomically(filePath: string, content: string): Promise<void> {
  const temporaryPath = `${filePath}.lp-dev-${process.pid}-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function applyDevVisualEditor(
  value: unknown,
  rootDir: string,
): Promise<DevVisualEditorApplyResponse> {
  const request = validateRequest(value);
  const ts = await getTypeScript();
  const sourceRoot = await listSourceFiles(rootDir);
  let filePath: string;

  if (request.filePath) {
    filePath = await resolveSourceFile(sourceRoot.root, request.filePath);
  } else {
    const candidates = await findCandidates(ts, sourceRoot, request);
    if (candidates.length === 0) {
      fail(404, 'SOURCE_NOT_FOUND', 'No JSX source file contains the selected element text.');
    }
    if (candidates.length > 1) {
      fail(409, 'SOURCE_AMBIGUOUS', 'More than one JSX source file contains the selected text.', { candidates });
    }
    filePath = await resolveSourceFile(sourceRoot.root, candidates[0].filePath);
  }

  const original = await fs.readFile(filePath, 'utf8');
  const currentHash = hashContent(original);
  if (!request.dryRun) {
    if (!request.expectedHash) {
      fail(428, 'SOURCE_PREVIEW_REQUIRED', 'Confirm the source preview before writing.');
    }
    if (request.expectedHash !== currentHash) {
      fail(409, 'SOURCE_CHANGED', 'The source file changed after preview. Pick the element again.');
    }
  }

  const updated = applyOperations(ts, filePath, original, request.operations);
  if (request.dryRun || updated === original) {
    return {
      ok: true,
      filePath: toRelativeSourcePath(sourceRoot.root, filePath),
      hash: currentHash,
      changed: updated !== original,
    };
  }

  const latest = await fs.readFile(filePath, 'utf8');
  if (hashContent(latest) !== currentHash) {
    fail(409, 'SOURCE_CHANGED', 'The source file changed while the preview was being confirmed. Pick the element again.');
  }
  await writeSourceAtomically(filePath, updated);
  const written = await fs.readFile(filePath, 'utf8');
  const writtenHash = hashContent(written);
  if (writtenHash !== hashContent(updated)) {
    fail(500, 'SOURCE_WRITE_VERIFY_FAILED', 'The source file could not be verified after writing.');
  }
  return {
    ok: true,
    filePath: toRelativeSourcePath(sourceRoot.root, filePath),
    hash: writtenHash,
    changed: true,
  };
}
