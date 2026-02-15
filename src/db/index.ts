import Dexie, { type EntityTable } from 'dexie';
import type { Child, WordList, Word, Session } from '../models/types';

const db = new Dexie('TaalTrainerDB') as Dexie & {
  children: EntityTable<Child, 'id'>;
  wordLists: EntityTable<WordList, 'id'>;
  words: EntityTable<Word, 'id'>;
  sessions: EntityTable<Session, 'id'>;
};

db.version(1).stores({
  children: 'id, name',
  wordLists: 'id, childId, name, createdAt',
  words: 'id, listId',
  sessions: 'id, childId, listId, status, startedAt',
});

// Seed Joel and Luuk on first launch
db.on('populate', (tx) => {
  tx.table('children').bulkAdd([
    {
      id: crypto.randomUUID(),
      name: 'Joel',
      avatarColor: '#3b82f6',
      createdAt: Date.now(),
    },
    {
      id: crypto.randomUUID(),
      name: 'Luuk',
      avatarColor: '#f59e0b',
      createdAt: Date.now(),
    },
  ]);
});

export { db };
