import * as vscode from "vscode";
import { filterResolved } from "./promiseUtil";
import { getCorrespondingNotes, isNotePath } from "./noteUtil";

let lineDecorator: vscode.TextEditorDecorationType;

export const initDecorator = async () => {
  if (lineDecorator) {
    lineDecorator.dispose();
  }

  const prop: vscode.DecorationRenderOptions = {};

  // set line color
  const line: string | undefined = vscode.workspace
    .getConfiguration()
    .get("linenote.lineColor");
  if (line && line.trim().length) {
    prop.backgroundColor = line.trim();
  }

  // set ruler color
  const ruler: string | undefined = vscode.workspace
    .getConfiguration()
    .get("linenote.rulerColor");
  if (ruler && ruler.trim().length) {
    prop.overviewRulerLane = vscode.OverviewRulerLane.Right;
    prop.overviewRulerColor = ruler.trim();
  }

  lineDecorator = vscode.window.createTextEditorDecorationType(prop);
};

export const decorate = async () => {
  if (!vscode.window.activeTextEditor) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const fsPath = editor.document.uri.fsPath;

  // do not decorate the note itself
  if (await isNotePath(fsPath)) {
    return;
  }

  const notes = await getCorrespondingNotes(fsPath);
  const options: vscode.DecorationOptions[] = await filterResolved(
    notes.map(async note => {
      // create hover text
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;

      const body = await note.read();

      const edit = `[Edit](${vscode.Uri.parse(
        `command:linenote.openNote?${encodeURIComponent(
          JSON.stringify(note.notePath)
        )}`
      )})`;
      const remove = `[Remove](${vscode.Uri.parse(
        `command:linenote.removeNote?${encodeURIComponent(
          JSON.stringify(note.notePath)
        )}`
      )})`;
      const nav = `*${note.name}* ${edit} ${remove}`;

      markdown.appendMarkdown(`${body}\n\n${nav}`);

      return {
        range: new vscode.Range(
          // subtract 1 because api's line number starts with 0, not 1
          editor.document.lineAt(note.from - 1).range.start,
          editor.document.lineAt(note.to - 1).range.end
        ),
        hoverMessage: markdown
      };
    })
  );

  // init decorator for first use
  if (!lineDecorator) {
    await initDecorator();
  }

  // recheck editor (because I used 'await'!)
  if (vscode.window.activeTextEditor !== editor) {
    return;
  }
  editor.setDecorations(lineDecorator, options);
};
