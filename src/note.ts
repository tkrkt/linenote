import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { getEditor } from "./editorUtil";
import { globalActiveNoteMarkers } from "./extension";
import { getNoteMarkerRegex, getUuidFromMatch, relNotesDir } from "./noteUtil";

export interface Props {
  filePath: string;
  notePath: string;
  uuid: string;
  line: number;
}

export interface ConstructorProps {
  filePath: string;
  uuid: string;
  noteDir: string;
  line: number;
}

export class Note implements Props {
  filePath: string;
  notePath: string;
  uuid: string;
  line: number;

  constructor(props: ConstructorProps) {
    this.filePath = props.filePath;
    this.uuid = props.uuid,
    // e.g. $PROJECT_ROOT/.vscode/.linenoteplus/73WakrfVbNJBaAmhQtEeDv.md
    this.notePath = path.join(props.noteDir, this.uuid + '.md');
    this.line = props.line;
  }

   static getLine = (document: vscode.TextDocument, uuid: string): number => {
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      const line = document.lineAt(lineIndex);
      const charIndex = line.text.indexOf(uuid);
      if (charIndex !== -1) {
        return lineIndex;
      }
    }
    throw new Error(`Note with UUID "${uuid}" not found in document "${document.uri.fsPath}".`);
  }

  static matchUuids = (text: string): string[] => {
    const uuids: string[] = [];
    const matches = text.match(getNoteMarkerRegex());;
    if (!matches) {
      return uuids;
    }
    for (const match of matches) {
      uuids.push(getUuidFromMatch(match));
    }
    return  uuids;
  }

  static matchUuidOnActiveLine = (editor: vscode.TextEditor): string | null => {
    const anchor = editor.selection.anchor;
    const line = editor.document.lineAt(anchor);
    return Note.matchUuid(line.text);
  }

  static matchUuid = (lineText: string): string | null => {
    const match = lineText.match(getNoteMarkerRegex());
    if (match) {
      const matchText = match[0];
      return getUuidFromMatch(matchText);
    }
    return null;
  }

  /** does file this note targets exist? */
  async fsExists(): Promise<boolean> {
    try {
      await fs.stat(this.filePath);
      return true;
    } catch (e) {
      return false;
    }
  }

  async noteExists(): Promise<boolean> {
    try {
      await fs.stat(this.notePath);
      return true;
    } catch (e) {
      return false;
    }
  }

  async open(): Promise<void> {
    globalActiveNoteMarkers[this.uuid] = this;
    const editor = getEditor();
    const currentColumn = editor.viewColumn;
    const viewColumns = vscode.window.visibleTextEditors.length;
    const targetColumn = currentColumn === 1 ? 2 : 1;
    await vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.file(this.notePath),
      {
        preview: false,
        viewColumn: viewColumns > 1 ? targetColumn
          : vscode.ViewColumn.Beside,
      }
    );
  }

  async write(body: string): Promise<void> {
    globalActiveNoteMarkers[this.uuid] = this;
    return await fs.outputFile(this.notePath, body);
  }

  async read(): Promise<string> {
    try {
      const buffer = await fs.readFile(this.notePath);
      return buffer.toString();
    } catch (e) {
      throw new Error(
        `003: Tried to read note with uuid "${this.uuid}"` +
        `at path "${this.notePath}" ` +
        `at for file "${this.filePath}" ` +
        `at line "${this.line}" ` +
        `but the path did not exist.`
      );
    }
  }

  async readAsMarkdown(): Promise<string> {
    let body = '\\<empty note\\>';

    if (await this.noteExists()) {
      const noteText = await this.read();
      if (noteText.trim() !== '') {
        body = await this.read();
      }
    }

    // create footer
    const edit = `[Edit](${vscode.Uri.parse(
      `command:linenoteplus.openNote?${encodeURIComponent(
        JSON.stringify(this.uuid)
      )}`
    )})`;
    const remove = `[Remove](${vscode.Uri.parse(
      `command:linenoteplus.removeNote?${encodeURIComponent(
        JSON.stringify(this.uuid)
      )}`
    )})`;

    return `${body}\n\n${edit} ${remove}`;
  }

  async remove(): Promise<void> {
    delete globalActiveNoteMarkers[this.uuid];
    await fs.unlink(this.notePath);
  }
}
