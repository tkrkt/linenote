import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { getRootFolders } from "./util";

export interface Props {
  fsPath: string;
  from: number;
  to: number;
  notePath: string;
}

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
  // e.g. ../foo.js#L123 , #L23-25
  // "[" or "]" or [match, file, from]
  static lineLinkMatcher = /\[|\]|(?:([^\s#]*)#L?(\d+)(?:-L?(\d+))?)/g;

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
    const [projectRoot, noteRoot] = await getRootFolders(fsPath);
    const relativePath = path.relative(projectRoot, fsPath);
    if (relativePath.startsWith("..")) {
      throw new Error("invalid file path");
    }

    const noteFile = path.resolve(noteRoot, relativePath);
    const postfix = from < to ? `L${from}-L${to}` : `L${from}`;

    return new Note({
      fsPath,
      from,
      to,
      notePath: `${noteFile}#${postfix}.md`
    });
  }

  static async fromNotePath(notePath: string): Promise<Note> {
    const [projectRoot, noteRoot] = await getRootFolders(notePath);

    const postfixes = notePath.match(Note.postfixMatcher);
    if (notePath.startsWith(noteRoot) && postfixes) {
      const [postfix, from, to] = postfixes;
      const relativePath = path.relative(
        noteRoot,
        notePath.slice(0, -postfix.length) // trim postfix: foo.js#L42.md => foo.js
      );
      return new Note({
        fsPath: path.resolve(projectRoot, relativePath),
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
    const [projectRoot] = await getRootFolders(this.fsPath);

    // true if current position is on markdown link like: [issue #123](http://...)
    let isInLink = false;

    // read body with replacing link
    const body = (await this.read()).replace(
      Note.lineLinkMatcher,
      (match: string, file?: string, from?: string, to?: string) => {
        // ignore link if current position is on markdown link
        if (match === "[") {
          isInLink = true;
          return match;
        } else if (match === "]") {
          isInLink = false;
          return match;
        } else if (isInLink) {
          return match;
        }

        if (!from) {
          return match;
        }
        if (!to) {
          to = from;
        }

        let fsPath;
        let preLinkText;
        let linkText;
        if (file) {
          if (
            file.startsWith("/") &&
            fs.existsSync(path.join(projectRoot, file))
          ) {
            fsPath = path.join(projectRoot, file);
            preLinkText = "";
            linkText = match;
          } else if (
            fs.existsSync(path.resolve(path.dirname(this.fsPath), file))
          ) {
            fsPath = path.resolve(path.dirname(this.fsPath), file);
            preLinkText = "";
            linkText = match;
          } else {
            // if text exists but the file does not,
            // "file" string regared as just a string.
            // i.g. "see->#L123" => "see->[#L123]($command)"
            fsPath = this.fsPath;
            preLinkText = file;
            linkText = match.slice(file.length);
          }
        } else {
          fsPath = this.fsPath;
          preLinkText = "";
          linkText = match;
        }

        return `${preLinkText}[${linkText}](${vscode.Uri.parse(
          `command:linenote.revealLine?${encodeURIComponent(
            JSON.stringify({
              fsPath,
              from: +from,
              to: +to
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
      `command:linenote.removeNoteWithConfirmation?${encodeURIComponent(
        JSON.stringify(this.notePath)
      )}`
    )})`;

    return `${body}\n\n*${path.basename(this.notePath)}* | ${edit} | ${remove}`;
  }

  // remove empty dir recursively
  private async removeDir(dir: string): Promise<void> {
    const [, noteRoot] = await getRootFolders(dir);
    if (dir.startsWith(noteRoot)) {
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
