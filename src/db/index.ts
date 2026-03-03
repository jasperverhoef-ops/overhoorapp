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

// v2: add Jasper + 5 Spanish word lists
db.version(2).stores({
  children: 'id, name',
  wordLists: 'id, childId, name, createdAt',
  words: 'id, listId',
  sessions: 'id, childId, listId, status, startedAt',
}).upgrade(async (tx) => {
  const { child, lists, words } = createJasperSeed();
  await tx.table('children').add(child);
  await tx.table('wordLists').bulkAdd(lists);
  await tx.table('words').bulkAdd(words);
});

// Seed all children on first launch (new installs skip upgrades)
db.on('populate', (tx) => {
  tx.table('children').bulkAdd([
    {
      id: crypto.randomUUID(),
      name: 'Jo\u00ebl',
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

  const { child, lists, words } = createJasperSeed();
  tx.table('children').add(child);
  tx.table('wordLists').bulkAdd(lists);
  tx.table('words').bulkAdd(words);
});

// ---------------------------------------------------------------------------
// Jasper seed data: 5 Spanish word lists
// ---------------------------------------------------------------------------
function createJasperSeed() {
  const jasperId = crypto.randomUUID();
  const now = Date.now();

  const child: Child = {
    id: jasperId,
    name: 'Jasper',
    avatarColor: '#10b981',
    createdAt: now,
  };

  const list1 = crypto.randomUUID();
  const list2 = crypto.randomUUID();
  const list3 = crypto.randomUUID();
  const list4 = crypto.randomUUID();
  const list5 = crypto.randomUUID();

  const lists: WordList[] = [
    { id: list1, childId: jasperId, name: 'Basiswoorden', sourceLanguage: 'es', createdAt: now, updatedAt: now },
    { id: list2, childId: jasperId, name: 'Eten & Drinken', sourceLanguage: 'es', createdAt: now - 1, updatedAt: now - 1 },
    { id: list3, childId: jasperId, name: 'Familie', sourceLanguage: 'es', createdAt: now - 2, updatedAt: now - 2 },
    { id: list4, childId: jasperId, name: 'Kleuren & Getallen', sourceLanguage: 'es', createdAt: now - 3, updatedAt: now - 3 },
    { id: list5, childId: jasperId, name: 'Op school', sourceLanguage: 'es', createdAt: now - 4, updatedAt: now - 4 },
  ];

  const w = (listId: string, sourceWord: string, dutchWord: string): Word => ({
    id: crypto.randomUUID(),
    listId,
    sourceWord,
    dutchWord,
  });

  const words: Word[] = [
    // Basiswoorden
    w(list1, 'hola', 'hallo'),
    w(list1, 'adiós', 'dag'),
    w(list1, 'gracias', 'dank je'),
    w(list1, 'por favor', 'alsjeblieft'),
    w(list1, 'sí', 'ja'),
    w(list1, 'no', 'nee'),
    w(list1, 'bueno', 'goed'),
    w(list1, 'malo', 'slecht'),
    w(list1, 'grande', 'groot'),
    w(list1, 'pequeño', 'klein'),
    w(list1, 'el agua', 'het water'),
    w(list1, 'la casa', 'het huis'),

    // Eten & Drinken
    w(list2, 'la manzana', 'de appel'),
    w(list2, 'el pan', 'het brood'),
    w(list2, 'la leche', 'de melk'),
    w(list2, 'el queso', 'de kaas'),
    w(list2, 'el pollo', 'de kip'),
    w(list2, 'el arroz', 'de rijst'),
    w(list2, 'la fruta', 'het fruit'),
    w(list2, 'el pescado', 'de vis'),
    w(list2, 'la ensalada', 'de salade'),
    w(list2, 'el helado', 'het ijs'),
    w(list2, 'el café', 'de koffie'),
    w(list2, 'la sopa', 'de soep'),

    // Familie
    w(list3, 'la madre', 'de moeder'),
    w(list3, 'el padre', 'de vader'),
    w(list3, 'el hermano', 'de broer'),
    w(list3, 'la hermana', 'de zus'),
    w(list3, 'el abuelo', 'de opa'),
    w(list3, 'la abuela', 'de oma'),
    w(list3, 'el tío', 'de oom'),
    w(list3, 'la tía', 'de tante'),
    w(list3, 'el primo', 'de neef'),
    w(list3, 'la prima', 'de nicht'),
    w(list3, 'el hijo', 'de zoon'),
    w(list3, 'la hija', 'de dochter'),

    // Kleuren & Getallen
    w(list4, 'rojo', 'rood'),
    w(list4, 'azul', 'blauw'),
    w(list4, 'verde', 'groen'),
    w(list4, 'amarillo', 'geel'),
    w(list4, 'blanco', 'wit'),
    w(list4, 'negro', 'zwart'),
    w(list4, 'uno', 'een'),
    w(list4, 'dos', 'twee'),
    w(list4, 'tres', 'drie'),
    w(list4, 'cuatro', 'vier'),
    w(list4, 'cinco', 'vijf'),
    w(list4, 'diez', 'tien'),

    // Op school
    w(list5, 'el libro', 'het boek'),
    w(list5, 'el lápiz', 'het potlood'),
    w(list5, 'la mesa', 'de tafel'),
    w(list5, 'la silla', 'de stoel'),
    w(list5, 'el profesor', 'de leraar'),
    w(list5, 'la clase', 'de klas'),
    w(list5, 'el examen', 'het examen'),
    w(list5, 'la tarea', 'het huiswerk'),
    w(list5, 'el cuaderno', 'het schrift'),
    w(list5, 'la mochila', 'de rugzak'),
    w(list5, 'la pizarra', 'het schoolbord'),
    w(list5, 'el alumno', 'de leerling'),
  ];

  return { child, lists, words };
}

export { db };
