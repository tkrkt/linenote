import * as path from "path";
import * as fs from "fs-extra";
import * as vscode from "vscode";

const rejected = Symbol("rejected");

type Result<T> = T | typeof rejected;

export const getNotePrefix = () => {
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

export const relNotesDir = '.vscode/linenoteplus';
export const getNotesDir = (filePath: string) => {
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

export const getWorkspaceRoot = (notePath: string) => {
  const workspaceFolders = vscode.workspace.workspaceFolders!;
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath
    if (notePath.indexOf(folderPath) != -1) {
      const noteDir = path.join(folderPath, relNotesDir);
      if (!fs.existsSync(noteDir)) {
          fs.mkdirSync(noteDir);
      }
      return noteDir;
    }
  }
  return null;
}

export const getIncludedFilePaths = async (): Promise<string[]> => {
  const fNames: string[] = [];
  const includePaths = vscode.workspace
    .getConfiguration()
    .get<string[]>('linenoteplus.includePaths')!;
  for (const pattern of includePaths) {
    const files = await vscode.workspace.findFiles(pattern, '');
    for (const file of files) {
      fNames.push(file.path);
    }
  }
  return fNames;
};

// convert from $PROJECT_ROOT to $PROJECT_ROOT/.vscode/linenoteplus
export const fromProjectRootToNoteRoot = (projectRoot: string): string => {
  return path.join(projectRoot, ".vscode", "linenoteplus");
};

// get [projectRoot, noteRoot(=projectRot/.vscode/linenoteplus)] from file path.
export const getRootFolders = async (
  fsPath: string
): Promise<[string, string]> => {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(fsPath)
  );
  if (workspaceFolder) {
    const projectRoot = workspaceFolder.uri.fsPath;
    return [projectRoot, fromProjectRootToNoteRoot(projectRoot)];
  } else {
    throw new Error("workspace not found");
  }
};

// convert from Promise<T>[] to Promise<T[]> by filtering resolved promises
export const filterResolved = async <T>(
  promises: Promise<T>[]
): Promise<T[]> => {
  const results: Promise<Result<T>>[] = promises.map(async p => {
    try {
      return await p;
    } catch (e) {
      return rejected;
    }
  });

  return (await Promise.all(results)).filter((r): r is any => r !== rejected);
};

// convert from "array of tuple" to "tuple of array"
export const splitArr = <S, T, C>(arr: Array<[S, T, C]>): [S[], T[], C[]] => {
  const sList: S[] = [];
  const tList: T[] = [];
  const cList: C[] = [];
  arr.forEach(([s, t, c]) => {
    sList.push(s);
    tList.push(t);
    cList.push(c);
  });
  return [sList, tList, cList];
};

export const keys = 
  <T extends object>(o: T) => 
    Object.keys(o) as Array<keyof T>;

export type DiffArrProps<T> = (a: T[], b: T[]) => boolean;
/** curry with a comparator to return a function 
 * that diffs arrays */
export const diffArr = 
  <T>(comparator: (a: T, b: T) => boolean) => (arr1: T[], arr2: T[]) => {
  const diffArr1 = arr1.filter(a => !arr2.some(b => comparator(a, b)));
  const diffArr2 = arr2.filter(b => !arr1.some(a => comparator(a, b)));
  const difference = [...diffArr1, ...diffArr2];
  return difference;
}

/** diff array on obj equality */
export const identityDiffArr = diffArr(<T>(a: T, b: T) => a === b);