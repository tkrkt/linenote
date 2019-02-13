import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";

export interface Props {
  fsPath: string;
  from: number;
  to: number;
  notePath: string;
}

export const projectRoot: Promise<string> = (async () => {
  if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  } else {
    throw new Error("workspace not found");
  }
})();

// $PROJECT_ROOT/.vscode/linenote
export const noteRoot: Promise<string> = (async () => {
  return path.join(await projectRoot, ".vscode", "linenote");
})();

export class Note implements Props {
  fsPath: string;
  from: number;
  to: number;
  notePath: string;

  // extract line number from notePath
  // e.g. #L123.md , #L23-L25.md
  // [match, from(, to)]
  static postfixMatcher = /#L(\d+)(?:-L(\d+))?\.md$/;

  // extract file path and line number from note body
  // e.g. foo.js#L123 , #L23-25
  // [match, file, from]
  static lineLinkMatcher = /(\S*)#L(\d+)(?:-L\d+)?/g;

  constructor(props: Props) {
    // e.g. $PROJECT_ROOT/path/to/file.js
    this.fsPath = props.fsPath;

    this.from = props.from;
    this.to = props.to;

    // e.g. $PROJECT_ROOT/.vscode/linenote/path/to/file.js#L5-L10.md
    this.notePath = props.notePath;
  }

  static async fromFsPath(
    fsPath: string,
    from: number = 0,
    to: number = 0
  ): Promise<Note> {
    const relativePath = path.relative(await projectRoot, fsPath);
    if (relativePath.startsWith("..")) {
      throw new Error("invalid file path");
    }

    const noteFile = path.resolve(await noteRoot, relativePath);
    const postfix = from < to ? `L${from}-L${to}` : `L${from}`;

    return new Note({
      fsPath,
      from,
      to,
      notePath: `${noteFile}#${postfix}.md`
    });
  }

  static async fromNotePath(notePath: string): Promise<Note> {
    const projectRootStr = await projectRoot;
    const noteRootStr = await noteRoot;

    const postfixes = notePath.match(Note.postfixMatcher);
    if (notePath.startsWith(noteRootStr) && postfixes) {
      const [postfix, from, to] = postfixes;
      const relativePath = path.relative(
        noteRootStr,
        notePath.slice(0, -postfix.length)
      );
      return new Note({
        fsPath: path.resolve(projectRootStr, relativePath),
        from: +from,
        to: to ? +to : +from,
        notePath
      });
    } else {
      throw new Error(`invalid note path: ${notePath}`);
    }
  }

  async fsExists(): Promise<boolean> {
    try {
      await fs.stat(this.fsPath);
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

  isOverlapped(from: number, to: number): boolean {
    return this.from <= to && from <= this.to;
  }

  async open(): Promise<void> {
    await vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.file(this.notePath),
      {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false
      }
    );
  }

  async write(body: string): Promise<void> {
    return await fs.outputFile(this.notePath, body);
  }

  async read(): Promise<string> {
    const buffer = await fs.readFile(this.notePath);
    return buffer.toString();
  }

  async readAsMarkdown(): Promise<string> {
    // read body with replacing link
    const body = (await this.read()).replace(
      Note.lineLinkMatcher,
      (match: string, file?: string, from?: string) => {
        if (!from) {
          return match;
        }
        let fsPath;
        if (file) {
          fsPath = path.resolve(this.fsPath, file);
          // check file existence
          try {
            fs.stat(fsPath);
          } catch (e) {
            return match;
          }
        } else {
          fsPath = this.fsPath;
        }

        return `[${match}](${vscode.Uri.parse(
          `command:vscode.open?${encodeURIComponent(
            JSON.stringify({
              resource: fsPath,
              columnOrOptions: +from
            })
          )}`
        )})`;
      }
    );

    // create footer
    const edit = `[Edit](${vscode.Uri.parse(
      `command:linenote.openNote?${encodeURIComponent(
        JSON.stringify(this.notePath)
      )}`
    )})`;
    const remove = `[Remove](${vscode.Uri.parse(
      `command:linenote.removeNote?${encodeURIComponent(
        JSON.stringify(this.notePath)
      )}`
    )})`;

    return `${body}\n\n*${path.basename(this.notePath)}* ${edit} ${remove}`;
  }

  // remove empty dir recursively
  private async removeDir(dir: string): Promise<void> {
    if (dir.startsWith(await noteRoot)) {
      const files = await fs.readdir(dir);
      if (!files.length) {
        await fs.rmdir(dir);
        await this.removeDir(path.resolve(dir, ".."));
      }
    }
  }

  async remove(): Promise<void> {
    await fs.unlink(this.notePath);
    await this.removeDir(path.dirname(this.notePath));
  }
}
