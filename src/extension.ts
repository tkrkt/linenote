import * as fs from 'fs-extra';
import * as path from 'path';
import * as short from "short-uuid";
import * as vscode from "vscode";
import { Position } from "vscode";
import { NoteLinkProvider, editText, removeText } from './DocumentLinkProvider';
import { formatIndentation } from "./commandUtil";
import { Decorator } from "./decorator";
import { CleanUpOrphanedNodesConf, getEditor, onDidSaveTextDocument, updateIsActiveEditorNoteContext } from "./editorUtil";
import { Note } from "./note";
import {
  cleanUpOrphanedNotes,
  getNotePrefix,
  getNotesDir,
  getUuidFromNotePath,
  initializeGlobalActiveNoteMarkers,
  isNotePath,
  watchCorrespondingNotes,
} from "./noteUtil";
import debounce = require("lodash.debounce");

export type GlobalActiveNoteMarkers = Record<string, Note>;
export const globalActiveNoteMarkers: GlobalActiveNoteMarkers = {};

export const activate = (context: vscode.ExtensionContext) => {
  const provider = new NoteLinkProvider();
  const documentLinkDisposable = vscode.languages.registerDocumentLinkProvider('*', provider);

  initializeGlobalActiveNoteMarkers(globalActiveNoteMarkers);

  const decorator: Decorator = new Decorator(context);
  let disposed: boolean = false;

  const conf = vscode.workspace.getConfiguration();
  const exclude: any = conf.get('files.exclude');
  const noteDir: any = conf.get('linenoteplus.notesDirectory');
  const excludeFiles = {
    ...exclude,
    [noteDir]: true,
  };
  conf.update('files.exclude', excludeFiles);
  
  const cleanUpOnInterval = () => {
    // watch orphaned notes
    const automaticallyDelete = async () => {
      if (disposed) {
        return;
      }
      const interval = vscode.workspace
        .getConfiguration()
        .get("linenoteplus.cleanUpOrphanedNotesInterval");
      if (typeof interval === "number" && interval >= 0) {
        const start = +new Date();
        await cleanUpOrphanedNotes();
        const duration = +new Date() - start;
        setTimeout(automaticallyDelete, Math.max(0, interval - duration));
      }
    };
  }

  const cleanupOnSave = () => {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument)
    );
  }

  // set cleanup orphaned nodes logic
  // based on conf
  const cleanupOrphanedNodes =
    conf.get<CleanUpOrphanedNodesConf>('linenoteplus.cleanUpOrphanedNotes')!;
  switch (cleanupOrphanedNodes) {
    case 'on-save':
      cleanupOnSave();
      break;
    case 'on-interval':
      cleanUpOnInterval();
      break;
    case 'on-save-and-on-interval': 
      cleanupOnSave();
      cleanUpOnInterval();
      break;
    case 'on-save-and-on-interval': 
    case 'never':
    default:
  }

  const decorateDebounce = debounce(() => {
    if (disposed) {
      return;
    }
    decorator.decorate();
  }, 500);
  decorateDebounce();

  // watch note files
  let unwatch: (() => void) | undefined;
  const watch = async () => {
    if (unwatch) {
      unwatch();
      unwatch = void 0;
    }
    if (disposed) {
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const fsPath = editor.document.uri.fsPath;
      unwatch = await watchCorrespondingNotes(fsPath, decorateDebounce);
    }
  };
  watch();

  const registerCommand = vscode.commands.registerCommand;
  context.subscriptions.push(
    new vscode.Disposable(() => (disposed = true)),

    documentLinkDisposable, 

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        updateIsActiveEditorNoteContext();
        watch();
        decorateDebounce();
      }
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      if (
        vscode.window.activeTextEditor &&
        event.document === vscode.window.activeTextEditor.document
      ) {
        decorateDebounce();
      }
    }),

    vscode.workspace.onDidCloseTextDocument(async event => {
      // remove note if it is empty
      const notePath = event.uri.fsPath;
      const uuid = getUuidFromNotePath(notePath);
      const note = globalActiveNoteMarkers[uuid];
      const body = await note.read();
      if (!body.trim().length) {
        await vscode.commands.executeCommand('linenoteplus.removeNote', uuid);
      }
    }),

    vscode.workspace.onDidChangeConfiguration(async event => {
      if (
        event.affectsConfiguration("linenoteplus.lineColor") ||
        event.affectsConfiguration("linenoteplus.rulerColor") || 
        event.affectsConfiguration("linenoteplus.cleanupOrphanedNotes") ||
        event.affectsConfiguration("linenoteplus.cleanupOrphanedNotesInterval") ||
        event.affectsConfiguration("linenoteplus.notesDirectory")
      ) {
        decorator.reload();
        decorator.decorate();
      }
    }),

    registerCommand('linenoteplus.addNote', async (_uuid?: string) => {
      const editor = getEditor();
      const filePath = editor.document.uri.fsPath;
      const noteDir = getNotesDir(editor.document.fileName);
      const anchor = editor.selection.anchor;
      const commentPos = new Position(anchor.line, 0);
      const placeHolderUuid = short.generate().toString();
      const uuid = await vscode.window.showInputBox({
        placeHolder: placeHolderUuid,
        prompt: 'Enter name for note',
      }) || placeHolderUuid;
      const marker = `${getNotePrefix()}${uuid} ${editText} ${removeText}\n`;
      const isSuccessful = await editor.edit(edit => {
          edit.insert(commentPos, marker);
      }, {
          undoStopAfter: false,
          undoStopBefore: false
      });
      // Use editor actions to comment the marker - this lets us work with any language - indejames
      if (isSuccessful) {
          await vscode.commands.executeCommand("cursorMove", { to: "up" });
          // TODO add a check here to make sure this works - otherwise I should remove the
          // marker. - indiejames
          await vscode.commands.executeCommand('editor.action.commentLine');
          await formatIndentation();
      }
      const note = new Note({
        filePath,
        noteDir,
        uuid,
        line: Note.getLine(editor.document, uuid),
      });
      globalActiveNoteMarkers[uuid] = note;
      // create empty note if it does not exist
      if (!(await note.noteExists())) {
        await note.write("");
      }
      await note.open();
    }),

    registerCommand('linenoteplus.openNote', async (uuid?: string) => {
      const editor = getEditor();
      const filePath = editor.document.uri.fsPath;
      const noteDir = getNotesDir(editor.document.fileName);
      if (!noteDir) {
        return;
      }
      if (!fs.existsSync(noteDir)) {
          vscode.window.showErrorMessage(`Can only edit existing notes.`);
          return;
      }
      if (uuid) {
        const note = new Note({
          noteDir,
          filePath,
          uuid,
          line: Note.getLine(editor.document, uuid),
        });
        await note.open();
        return;
      }
      const _uuid = Note.matchUuidOnActiveLine(editor);
      if (_uuid) {
          const note = new Note({
            noteDir,
            filePath,
            uuid: _uuid,
            line: Note.getLine(editor.document, _uuid),
          });
          await note.open();
      } else {
          vscode.window.showErrorMessage("Select a note marker to edit a note.");
      }
    }),

    registerCommand(
      "linenoteplus.removeNote",
      async (uuid?: string) => {
        const _uuid = uuid || Note.matchUuidOnActiveLine(getEditor());
        if (_uuid) {
          // remove specified note (when invoked from the hover text)
          const note = globalActiveNoteMarkers[_uuid];
          if (note.line > -1) {
            const uri = vscode.Uri.parse(note.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const line = document.lineAt(note.line);
            const edit = new vscode.WorkspaceEdit();
            edit.delete(uri, line.rangeIncludingLineBreak);
            vscode.workspace.applyEdit(edit);
          }
          await note.remove();
          decorateDebounce();
          return;
        }
      }
    ),

    registerCommand("linenoteplus.revealLine", async () => {
      const editor = getEditor();
      const filePath = editor.document.uri.fsPath;
      if (!isNotePath(filePath)) {
        return;
      }
      const uuid = path.basename(filePath, '.md');
      const note = globalActiveNoteMarkers[uuid];
      if (!note) {
        throw new Error(`001: Note with uuid "${uuid}" did not exist in globalActiveNoteMarkers cache.`);
      }
      if (!await note.fsExists()) {
        return;
      }
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(note.filePath)
      );
      const line = Note.getLine(document, uuid);
      const selection = document.lineAt(line).range;
      const currentColumn = editor.viewColumn;
      const viewColumns = vscode.window.visibleTextEditors.length;
      const targetColumn = currentColumn === 1 ? 2 : 1;
      await vscode.window.showTextDocument(document, {
        selection,
        viewColumn: viewColumns > 1 ? targetColumn
          : vscode.ViewColumn.Beside,
      });;
    }),

  );
};

