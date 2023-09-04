import * as vscode from 'vscode';
import { Note } from './note';
import { getNotesDir, getOrphanedUuidsForCurDoc, isNotePath } from './noteUtil';
import { globalActiveNoteMarkers } from './extension';


export const getEditor = () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor!');
  }
  return editor;
}

export type CleanUpOrphanedNodesConf = 
  | 'on-save'
  | 'on-interval'
  | 'on-save-and-on-interval'
  | 'never'
  ;

export const onDidSaveTextDocument = async (document: vscode.TextDocument) => {
  const uuids: string[] = Note.matchUuids(document.getText());
  const filePath = document.uri.fsPath;
  const noteDir = getNotesDir(filePath);
  await Promise.all(uuids.map(async uuid => {
    const note = new Note({
      filePath,
      noteDir,
      uuid,
      line: Note.getLine(document, uuid),
    });
    globalActiveNoteMarkers[uuid] = note;
    if (!await note.noteExists()) {
      await note.write('');
      await note.open();
    }
  }));
  const uuidsToDelete = getOrphanedUuidsForCurDoc({
    filePath,
    uuids,
  });
  // no Promise.all because no reason to 
  // block UI thread and removeNote
  // decorate call is debounced.
  uuidsToDelete.forEach(async uuid => {
    if (uuid) {
      await vscode.commands.executeCommand('linenoteplus.removeNote', uuid);
    }
  });
}

export const updateIsActiveEditorNoteContext = () => {
  const editor = getEditor();
  if (isNotePath(editor.document.uri.fsPath)) {
    vscode.commands.executeCommand('setContext', 'isActiveEditorNote', true);
  } else {
    vscode.commands.executeCommand('setContext', 'isActiveEditorNote', false);
  }
}