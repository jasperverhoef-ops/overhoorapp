import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, Play, ClipboardPaste, Share2, Pencil, Check, Undo2 } from 'lucide-react';
import { db } from '../../db';
import { Header } from '../layout/Header';
import { WordEditor } from './WordEditor';
import { PasteDialog } from './PasteDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import type { Word } from '../../models/types';

export function ListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [showPaste, setShowPaste] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'list' } | { type: 'word'; wordId: string } | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState('');
  const [editDutch, setEditDutch] = useState('');
  const [shared, setShared] = useState(false);
  const [deletedWord, setDeletedWord] = useState<Word | null>(null);

  const list = useLiveQuery(() =>
    listId ? db.wordLists.get(listId) : undefined, [listId]
  );
  const words = useLiveQuery(() =>
    listId ? db.words.where('listId').equals(listId).toArray() : [], [listId]
  );

  if (!list || !words) {
    return <div className="p-4 text-center text-gray-500">Laden...</div>;
  }

  const deleteWord = async (wordId: string) => {
    // Save word for undo before deleting
    const word = words.find((w) => w.id === wordId);
    if (word) {
      setDeletedWord(word);
      setTimeout(() => setDeletedWord((prev) => prev?.id === word.id ? null : prev), 5000);
    }
    await db.words.delete(wordId);
    setConfirmDelete(null);
  };

  const undoDelete = useCallback(async () => {
    if (!deletedWord) return;
    await db.words.add(deletedWord);
    setDeletedWord(null);
  }, [deletedWord]);

  const deleteList = async () => {
    if (!listId) return;
    await db.words.where('listId').equals(listId).delete();
    await db.wordLists.delete(listId);
    navigate('/lists');
  };

  const startEdit = (wordId: string, sourceWord: string, dutchWord: string) => {
    setEditingWordId(wordId);
    setEditSource(sourceWord);
    setEditDutch(dutchWord);
  };

  const saveEdit = async () => {
    if (!editingWordId || !editSource.trim() || !editDutch.trim()) return;
    await db.words.update(editingWordId, {
      sourceWord: editSource.trim(),
      dutchWord: editDutch.trim(),
    });
    setEditingWordId(null);
  };

  const handleExport = async () => {
    const text = words.map(w => `${w.sourceWord} = ${w.dutchWord}`).join('\n');
    const shareData = { title: list.name, text };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <Header
        title={list.name}
        right={
          <div className="flex items-center gap-1">
            {words.length > 0 && (
              <button
                onClick={handleExport}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 touch-manipulation"
                aria-label="Deel lijst"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setConfirmDelete({ type: 'list' })}
              className="p-2 rounded-lg hover:bg-red-50 text-red-500 touch-manipulation"
              aria-label="Verwijder lijst"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {shared && (
        <div className="mx-4 mt-2 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-xl text-center">
          Gekopieerd naar klembord!
        </div>
      )}

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
            <span>{LANGUAGE_LABELS[list.sourceLanguage]}</span>
            <span>·</span>
            <span>{words.length} woorden</span>
          </div>
          {words.length >= 2 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/play/${listId}`)}
            >
              <span className="flex items-center gap-1.5">
                <Play className="w-4 h-4" />
                Start
              </span>
            </Button>
          )}
        </div>

        <WordEditor listId={list.id} sourceLanguage={list.sourceLanguage} />

        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => setShowPaste(true)}
        >
          <span className="flex items-center justify-center gap-2">
            <ClipboardPaste className="w-4 h-4" />
            Plak meerdere woorden
          </span>
        </Button>

        {words.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Woorden ({words.length})
            </h3>
            {words.map((word) => (
              <div
                key={word.id}
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100"
              >
                {editingWordId === word.id ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <input
                      type="text"
                      value={editSource}
                      onChange={e => setEditSource(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDutch}
                      onChange={e => setEditDutch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={saveEdit}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 touch-manipulation"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => startEdit(word.id, word.sourceWord, word.dutchWord)}
                    >
                      <span className="font-medium text-gray-900">{word.sourceWord}</span>
                      <span className="text-gray-400 mx-2">=</span>
                      <span className="text-gray-600">{word.dutchWord}</span>
                    </div>
                    <div className="flex items-center gap-0.5 ml-2">
                      <button
                        onClick={() => startEdit(word.id, word.sourceWord, word.dutchWord)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 touch-manipulation"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ type: 'word', wordId: word.id })}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 touch-manipulation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Undo toast */}
      {deletedWord && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50">
          <div className="flex items-center justify-between bg-gray-800 text-white rounded-xl px-4 py-3 shadow-lg">
            <span className="text-sm">
              "{deletedWord.sourceWord}" verwijderd
            </span>
            <button
              onClick={undoDelete}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-blue-200 ml-4"
            >
              <Undo2 className="w-4 h-4" />
              Ongedaan maken
            </button>
          </div>
        </div>
      )}

      {showPaste && (
        <PasteDialog
          listId={list.id}
          onClose={() => setShowPaste(false)}
        />
      )}

      {confirmDelete?.type === 'list' && (
        <ConfirmDialog
          title="Lijst verwijderen?"
          description={`"${list.name}" en alle ${words.length} woorden worden permanent verwijderd.`}
          onConfirm={deleteList}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmDelete?.type === 'word' && (
        <ConfirmDialog
          title="Woord verwijderen?"
          description="Dit woord wordt permanent verwijderd."
          onConfirm={() => deleteWord(confirmDelete.wordId)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
