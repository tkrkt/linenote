import * as vscode from "vscode";

const rejected = Symbol("rejected");

export const escapeRegex = (regex: string) => {
  return regex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Result<T> = T | typeof rejected;

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