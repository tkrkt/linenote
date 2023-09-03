import * as vscode from 'vscode';
import { getEditor } from './editorUtil';


export const formatIndentation = async () => {
  const editor = getEditor()

  const cursorPosition = editor.selection.anchor;
  const currentPosition = cursorPosition.line;

  // Get the text of the subsequent line
  const subsequentLine = editor.document.lineAt(currentPosition + 1);

  // Update the indentation of the current line to match the subsequent line
  await editor.edit(editBuilder => {
    const indentation = subsequentLine.firstNonWhitespaceCharacterIndex;
    const position = new vscode.Position(currentPosition, 0);
    editBuilder.insert(position, subsequentLine.text.substring(0, indentation));
  });
}