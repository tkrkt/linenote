const rejected = Symbol("rejected");

type Result<T> = T | typeof rejected;

// convert Promise<T>[] into Promise<T[]> by filtering resolved promises
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
