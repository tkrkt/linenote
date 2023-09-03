import * as vscode from "vscode";
import { filterResolved, getNotesDir, splitArr } from "./util";
import { Note } from "./note";

export class Decorator {
  context: vscode.ExtensionContext;
  lineDecorator?: vscode.TextEditorDecorationType;
  gutterDecorator?: vscode.TextEditorDecorationType;
  noteMarkerDecorator?: vscode.TextEditorDecorationType;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.reload();
  }

  reload() {
    if (this.lineDecorator) {
      this.lineDecorator.dispose();
    }
    if (this.gutterDecorator) {
      this.gutterDecorator.dispose();
    }
    if (this.noteMarkerDecorator) {
      this.noteMarkerDecorator.dispose();
    }

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

    const noteMarkerProp: vscode.DecorationRenderOptions = {};
    const gutterProp: vscode.DecorationRenderOptions = {};

    // set line color
    const line: string | undefined = config.get("linenote.lineColor");
    if (line && line.trim().length) {
      noteMarkerProp.backgroundColor = line.trim();
    }

    // set ruler color
    const ruler: string | undefined = config.get("linenote.rulerColor");
    if (ruler && ruler.trim().length) {
      noteMarkerProp.overviewRulerLane = vscode.OverviewRulerLane.Right;
      noteMarkerProp.overviewRulerColor = ruler.trim();
    }

    const showGutterIcon: boolean | undefined = config.get(
      "linenote.showGutterIcon"
    );
    if (showGutterIcon) {
      let iconPath: string | null = config.get<string | null>("linenote.gutterIconPath")!;
      if (iconPath) {
        gutterProp.gutterIconPath = iconPath;
      } else {
        gutterProp.gutterIconPath = this.context.asAbsolutePath(
          "images/gutter.png"
        );
      }
      gutterProp.gutterIconSize = "cover";
    }

    this.noteMarkerDecorator = vscode.window.createTextEditorDecorationType(noteMarkerProp);
    this.lineDecorator = vscode.window.createTextEditorDecorationType({});
    this.gutterDecorator = vscode.window.createTextEditorDecorationType(
      gutterProp
    );
  }

  async decorate() {
    const editors = vscode.window.visibleTextEditors;
    for (const editor of editors) {
      const noteDir = getNotesDir(editor.document.fileName);
      // load notes and create decoration options
      const uuids = Note.matchUuids(editor.document.getText());
      const filePath = editor.document.uri.fsPath;
      const notes = uuids.map(uuid => new Note({
        filePath,
        noteDir,
        uuid,
        line: Note.getLine(editor.document, uuid),
      }));
      const [lineProps, gutterProps, noteMarkerProps] = splitArr(
        await filterResolved(
          notes.map(
            async (
              note
            ): Promise<[vscode.DecorationOptions, vscode.DecorationOptions, vscode.DecorationOptions]> => {
              const markdown = new vscode.MarkdownString(
                await note.readAsMarkdown()
              );
              markdown.isTrusted = true;
              const noteLine = editor.document.lineAt(note.line);
              const line = editor.document.lineAt(note.line + 1);
              return [
                {
                  // line decorator
                  // notes marker line and noted line
                  range: new vscode.Range(
                    // subtract 1 because api's line number starts with 0, not 1
                    noteLine.range.start,
                    line.range.end
                  ),
                  hoverMessage: markdown,
                },
                {
                  // gutter decorator
                  range: new vscode.Range(
                    line.range.start,
                    line.range.start
                  ),
                  hoverMessage: markdown
                },
                {
                  // note marker decoratior
                  range: new vscode.Range(
                    noteLine.range.start,
                    noteLine.range.end
                  ),
                }
              ];
            }
          )
        )
      );

      editor.setDecorations(this.noteMarkerDecorator!, noteMarkerProps);
      editor.setDecorations(this.lineDecorator!, lineProps);
      editor.setDecorations(this.gutterDecorator!, gutterProps);
    }
  }
}
