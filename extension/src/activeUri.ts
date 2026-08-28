export type UriLike = { scheme?: string; fsPath?: string };

export function uriFromTabInput<T>(input: unknown): T | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const record = input as { uri?: T; modified?: T };
  if (record.uri) {
    return record.uri;
  }
  if (record.modified) {
    return record.modified;
  }
  return undefined;
}

export function resolveActiveFileUri<T>(input: {
  commandUri?: T;
  activeTextEditor?: { document?: { uri?: T } };
  visibleTextEditors?: Array<{ document?: { uri?: T } }>;
  activeTabInput?: unknown;
}): T | undefined {
  if (input.commandUri) {
    return input.commandUri;
  }
  const fromActive = input.activeTextEditor?.document?.uri;
  if (fromActive) {
    return fromActive;
  }
  const fromTab = uriFromTabInput<T>(input.activeTabInput);
  if (fromTab) {
    return fromTab;
  }
  for (const editor of input.visibleTextEditors ?? []) {
    if (editor.document?.uri) {
      return editor.document.uri;
    }
  }
  return undefined;
}
