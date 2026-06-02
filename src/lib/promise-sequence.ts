type MaybePromise<T> = T | Promise<T>;

export async function promiseSequence<T>(
  tasks: Array<() => MaybePromise<T>>,
): Promise<T[]> {
  const results: T[] = [];

  for (const task of tasks) {
    results.push(await task());
  }

  return results;
}
