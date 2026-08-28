import assert from "node:assert/strict";
import test from "node:test";
import { resolveActiveFileUri, uriFromTabInput } from "../activeUri";

test("Command Palette with no activeTextEditor still uses the active tab URI", () => {
  const tabUri = { fsPath: "C:\\repo\\sample.tfplan.json", scheme: "file" };
  const uri = resolveActiveFileUri({
    activeTextEditor: undefined,
    visibleTextEditors: [],
    activeTabInput: { uri: tabUri },
  });
  assert.equal(uri, tabUri);
});

test("editor-title command argument wins over a different tab", () => {
  const commandUri = { fsPath: "C:\\a\\tfplan.json", scheme: "file" };
  const tabUri = { fsPath: "C:\\b\\other.json", scheme: "file" };
  const uri = resolveActiveFileUri({
    commandUri,
    activeTextEditor: undefined,
    activeTabInput: { uri: tabUri },
  });
  assert.equal(uri, commandUri);
});

test("visible editor is used when palette cleared activeTextEditor", () => {
  const visible = { fsPath: "C:\\repo\\tfplan.json", scheme: "file" };
  const uri = resolveActiveFileUri({
    activeTextEditor: undefined,
    visibleTextEditors: [{ document: { uri: visible } }],
  });
  assert.equal(uri, visible);
});

test("diff tab uses the modified side", () => {
  const modified = { fsPath: "C:\\repo\\tfplan.json", scheme: "file" };
  assert.equal(
    uriFromTabInput({ original: { fsPath: "C:\\old.json" }, modified }),
    modified
  );
});

test("returns undefined when nothing is open", () => {
  assert.equal(resolveActiveFileUri({}), undefined);
});
