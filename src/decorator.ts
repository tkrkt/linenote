import * as vscode from "vscode";
import { filterResolved, splitArr } from "./util";
import { getCorrespondingNotes, isNotePath } from "./noteUtil";
import { Severity } from './note';

export class Decorator {
  context: vscode.ExtensionContext;
  lineDecorator?: vscode.TextEditorDecorationType;
  gutterDecorator?: vscode.TextEditorDecorationType;
  severity: Severity | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.reload();
  }

  reload() {
    if (this.lineDecorator) {
      this.lineDecorator.dispose();
    }

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

    const lineProp: vscode.DecorationRenderOptions = {};

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


    this.lineDecorator = vscode.window.createTextEditorDecorationType(lineProp);
    this.maybeReloadGutterDecorator(Severity.Default);
  }

  maybeReloadGutterDecorator(newSeverity: Severity) {
    const gutterProp: vscode.DecorationRenderOptions = {};
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

    const showGutterIcon: boolean | undefined = config.get(
      "linenote.showGutterIcon"
    );

    if (this.severity === undefined || this.severity !== newSeverity) {
      // since we're going to switch decorators, dispose if needed
      if (this.gutterDecorator) {
        this.gutterDecorator.dispose();
      }

      switch (newSeverity) {
        case Severity.Low:
          gutterProp.gutterIconSize = "cover";
          gutterProp.gutterIconPath = this.context.asAbsolutePath(
            "images/gutter-low.png"
          );
          break;
        case Severity.Medium:
          gutterProp.gutterIconSize = "cover";
          gutterProp.gutterIconPath = this.context.asAbsolutePath(
            "images/gutter-medium.png"
          );
          break;
        case Severity.High:
          gutterProp.gutterIconSize = "cover";
          gutterProp.gutterIconPath = this.context.asAbsolutePath(
            "images/gutter-high.png"
          );
          break;
        default:
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
      }

      this.gutterDecorator = vscode.window.createTextEditorDecorationType(
        gutterProp
      );
    }
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

    // if any note has severity marked, use the "most severe" for gutter icon color
    let newSeverity = Severity.Default;

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

            // check if the note has a severity tag in its body
            const noteSeverity = await note.readSeverity();
            if (noteSeverity > newSeverity) {
              newSeverity = noteSeverity;
            }

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

    // reset gutter icon, if necessary
    this.maybeReloadGutterDecorator(newSeverity);

    editor.setDecorations(this.lineDecorator!, lineProps);
    editor.setDecorations(this.gutterDecorator!, gutterProps);
  }
}
