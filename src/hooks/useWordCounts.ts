import { useLiveQuery } from 'dexie-react-hooks';
import type { WordList } from '../models/types';
import { db } from '../db';

/** Fetches word counts for a list of WordLists in parallel. */
export function useWordCounts(lists: WordList[] | undefined): Record<string, number> | undefined {
  return useLiveQuery(
    async () => {
      if (!lists) return {};
      const pairs = await Promise.all(
        lists.map(async (list) => [list.id, await db.words.where('listId').equals(list.id).count()] as const)
      );
      return Object.fromEntries(pairs);
    },
    [lists]
  );
}
