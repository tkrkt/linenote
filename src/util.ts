const rejected = Symbol("rejected");

type Result<T> = T | typeof rejected;

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

  return (await Promise.all(results)).filter((r): r is T => r !== rejected);
};

// convert from "array of tuple" to "tuple of array"
export const splitArr = <S, T>(arr: Array<[S, T]>): [S[], T[]] => {
  const sList: S[] = [];
  const tList: T[] = [];
  arr.forEach(([s, t]) => {
    sList.push(s);
    tList.push(t);
  });
  return [sList, tList];
};
