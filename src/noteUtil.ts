import * as fs from "fs-extra";
import * as path from "path";
import * as chokidar from "chokidar";
import { filterResolved } from "./promiseUtil";
import { noteRoot, Note } from "./note";

export const isNotePath = async (notePath: string): Promise<boolean> => {
  return notePath.startsWith(await noteRoot);
};

const getAllNotes = async (dir?: string): Promise<Note[]> => {
  if (!dir) {
    dir = await noteRoot;
  }
  let files;
  try {
    files = await fs.readdir(dir);
  } catch (e) {
    // if linenote dir does not exist
    return [];
  }
  const notes: Note[] = [];
  await Promise.all(
    files.map(async f => {
      const p = path.join(dir!, f);
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        // recursive
        notes.push(...(await getAllNotes(p)));
      } else if (stat.isFile()) {
        try {
          notes.push(await Note.fromNotePath(p));
        } catch (e) {
          // ignore file except notes (but what?)
        }
      }
    })
  );
  return notes;
};

export const removeNotCorrespondingNotes = async () => {
  await Promise.all(
    (await getAllNotes()).map(async note => {
      if (!(await note.fsExists())) {
        await note.remove();
      }
    })
  );
};

export const getCorrespondingNotes = async (
  fsPath: string
): Promise<Note[]> => {
  const tmpNote = await Note.fromFsPath(fsPath);
  const dir = path.dirname(tmpNote.notePath);
  let files;
  try {
    files = await fs.readdir(dir);
  } catch (e) {
    // if linenote dir does not exist
    return [];
  }
  const notes = await filterResolved(
    files.map(f => path.join(dir, f)).map(f => Note.fromNotePath(f))
  );
  return notes.filter(p => p.fsPath === fsPath);
};

export const watchCorrespondingNotes = async (
  fsPath: string,
  onChange: () => void
): Promise<() => void> => {
  const tmpNote = await Note.fromFsPath(fsPath);
  const watcher = chokidar.watch(path.dirname(tmpNote.notePath), {
    persistent: false,
    ignoreInitial: true
  });
  watcher
    .on("add", async (notePath: string) => {
      const stat = await fs.stat(notePath);
      if (stat.isFile()) {
        const note = await Note.fromNotePath(notePath);
        if (note.fsPath === fsPath) {
          onChange();
        }
      }
    })
    .on("unlink", async (notePath: string) => {
      // we cannnot use fs.stat because note no longer exists
      try {
        const note = await Note.fromNotePath(notePath);
        if (note.fsPath === fsPath) {
          onChange();
        }
      } catch (e) {
        // ignore
      }
    });

  return () => {
    watcher.close();
  };
};
