import * as vscode from "vscode";
import { filterResolved, splitArr } from "./util";
import { getCorrespondingNotes, isNotePath } from "./noteUtil";

export class Decorator {
  context: vscode.ExtensionContext;
  lineDecorator?: vscode.TextEditorDecorationType;
  gutterDecorator?: vscode.TextEditorDecorationType;

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

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

    const lineProp: vscode.DecorationRenderOptions = {};
    const gutterProp: vscode.DecorationRenderOptions = {};

    // set line color
    const line: string | undefined = config.get("linenote.lineColor");
    if (line && line.trim().length) {
      lineProp.backgroundColor = line.trim();
    }

    // set ruler color
    const ruler: string | undefined = config.get("linenote.rulerColor");
    if (ruler && ruler.trim().length) {
      lineProp.overviewRulerLane = vscode.OverviewRulerLane.Right;
      lineProp.overviewRulerColor = ruler.trim();
    }

    const showGutterIcon: boolean | undefined = config.get(
      "linenote.showGutterIcon"
    );
    if (showGutterIcon) {
      let iconPath: string | undefined = config.get("linenote.gutterIconPath");
      if (iconPath) {
        gutterProp.gutterIconPath = iconPath;
      } else {
        gutterProp.gutterIconPath = this.context.asAbsolutePath(
          "images/gutter.png"
        );
      }
      gutterProp.gutterIconSize = "cover";
    }

    this.lineDecorator = vscode.window.createTextEditorDecorationType(lineProp);
    this.gutterDecorator = vscode.window.createTextEditorDecorationType(
      gutterProp
    );
  }

  async decorate() {
    if (!vscode.window.activeTextEditor) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const fsPath = editor.document.uri.fsPath;

    // do not decorate the note itself
    if (await isNotePath(fsPath)) {
      return;
    }

    // load notes and create decoration options
    const notes = await getCorrespondingNotes(fsPath);
    const [lineProps, gutterProps] = splitArr(
      await filterResolved(
        notes.map(
          async (
            note
          ): Promise<[vscode.DecorationOptions, vscode.DecorationOptions]> => {
            const markdown = new vscode.MarkdownString(
              await note.readAsMarkdown()
            );
            markdown.isTrusted = true;
            return [
              {
                range: new vscode.Range(
                  // subtract 1 because api's line number starts with 0, not 1
                  editor.document.lineAt(note.from - 1).range.start,
                  editor.document.lineAt(note.to - 1).range.end
                ),
                hoverMessage: markdown
              },
              {
                range: new vscode.Range(
                  editor.document.lineAt(note.from - 1).range.start,
                  editor.document.lineAt(note.from - 1).range.start
                ),
                hoverMessage: markdown
              }
            ];
          }
        )
      )
    );

    // recheck editor (because I used 'await'!)
    if (vscode.window.activeTextEditor !== editor) {
      return;
    }

    editor.setDecorations(this.lineDecorator!, lineProps);
    editor.setDecorations(this.gutterDecorator!, gutterProps);
  }
}
