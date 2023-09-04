import * as chokidar from "chokidar";
import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from 'vscode';
import { GlobalActiveNoteMarkers, globalActiveNoteMarkers } from "./extension";
import { Note } from "./note";
import {
  escapeRegex,
  getIncludedFilePaths,
  identityDiffArr,
  keys,
} from "./util";


export const getNotePrefix = () => {
  // note:getNotePrefixNote [Edit] [Remove]
  // TODO make configurable
  return 'note:';
}

export const getUuidFromMatch = (match: string) => {
  return match.split(getNotePrefix())[1].trim();
}

export const getUuidFromNotePath = (notePath: string) => {
  const parts = notePath.split(path.sep);
  const uuid = parts[parts.length - 1].split('.md')[0];
  return uuid;
}

export const getNotesDir = (filePath: string) => {
  const conf = vscode.workspace.getConfiguration();
  const relNotesDir: any = conf.get('linenoteplus.notesDirectory');
  const workspaceFolders = vscode.workspace.workspaceFolders!;
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath
    if (filePath.indexOf(folderPath) != -1) {
      const noteDir = path.join(folderPath, relNotesDir);
      if (!fs.existsSync(noteDir)) {
          fs.mkdirSync(noteDir);
      }
      return noteDir;
    }
  }
  throw new Error(`Unable to find or create note directory "${relNotesDir}".`);
}

export const uuidRegex = /^[A-Za-z0-9]{1,}$/;
export const getNoteMarkerRegex = () => {
  const escapedNotePrefix = escapeRegex(getNotePrefix());
  const regexString = `${escapedNotePrefix}[A-Za-z0-9]{1,}\\s`;
  const regex = new RegExp(regexString, 'g');
  return regex;
}

export const isNotePath = (filePath: string): boolean => {
  const noteDir = getNotesDir(filePath);
  return filePath.startsWith(noteDir);
};

export const cleanUpOrphanedNotes = async () => {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }
  for (const folder of folders) {
    const filePath = folder.uri.fsPath;
    const noteDir = getNotesDir(filePath);
    const files = await fs.readdir(noteDir);
    const uuids = files
      .map(file => path.basename(file, '.md'))
      .filter(uuidish => uuidish.match(uuidRegex))
      ;
    const activeUuids = 
      keys(globalActiveNoteMarkers)
        .map(k => globalActiveNoteMarkers[k].uuid);
    const uuidsToDelete = identityDiffArr(uuids, activeUuids);
    for (const uuid of uuidsToDelete) {
      const note = globalActiveNoteMarkers[uuid as string];
      note.line = -1;
    }
    await Promise.all(uuidsToDelete.map(async uuid => {
      if (uuid) {
        await vscode.commands.executeCommand('linenoteplus.removeNote', uuid);
      }
    }));
  }
};


export const watchCorrespondingNotes = async (
  filePath: string,
  onChange: () => void
): Promise<() => void> => {
  const noteDir = getNotesDir(filePath);
  if (!noteDir) {
    return async () => null;
  }
  const watcher = chokidar.watch(path.dirname(noteDir), {
    persistent: false,
    ignoreInitial: true
  });
  watcher
    .on("add", async (notePath: string) => {
      const stat = await fs.stat(notePath);
      if (stat.isFile()) {
        onChange();
      }
    })
    .on("change", async (notePath: string) => {
      const stat = await fs.stat(notePath);
      if (stat.isFile()) {
        onChange();
      }
    })
    .on("unlink", async (notePath: string) => {
      // we cannnot use fs.stat because the note no longer exists
      try {
        if (fs.existsSync(notePath)) {
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


export interface GetOrphanedNoteMarkersProps {
  /** filepath of current document */
  filePath: string;
  /** uuids in current document */
  uuids: string[];
}
export const getOrphanedUuidsForCurDoc = (
  props: GetOrphanedNoteMarkersProps
): string[] => {
  const { 
    filePath,
    uuids,
   } = props;
  const activeNotesMarkersForCurDuc: Note[] = []
  keys(globalActiveNoteMarkers)
    .filter((uuid: string) => {
      const docFilePath = globalActiveNoteMarkers[uuid].filePath;
      return docFilePath === filePath
    })
    .forEach(uuid => {
      activeNotesMarkersForCurDuc.push(
        globalActiveNoteMarkers[uuid]
      );
    });
  const activeUuidsForCurDoc = activeNotesMarkersForCurDuc.map(n => n.uuid);
  const uuidsToDelete = identityDiffArr(uuids, activeUuidsForCurDoc);
  return uuidsToDelete as string[];
}

export const initializeGlobalActiveNoteMarkers = async (
  globalActiveNoteMarkers: GlobalActiveNoteMarkers,
) => {
  const workspaceFolders = vscode.workspace.workspaceFolders!;
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath
    const noteDir = getNotesDir(folderPath);
    const filePaths = await getIncludedFilePaths();
    for (const filePath of filePaths) {
      const document = await vscode.workspace.openTextDocument(filePath);
      const uuids = Note.matchUuids(document.getText());
      for (const uuid of uuids) {
        const note = new Note({
          filePath,
          noteDir,
          uuid,
          line: Note.getLine(document, uuid),
        });
        globalActiveNoteMarkers[uuid] = note;
      }
    } 
  }
}
