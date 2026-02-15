import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, Play, Camera, ClipboardPaste } from 'lucide-react';
import { db } from '../../db';
import { Header } from '../layout/Header';
import { WordEditor } from './WordEditor';
import { ScanDialog } from './ScanDialog';
import { PasteDialog } from './PasteDialog';
import { Button } from '../ui/Button';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';

export function ListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [showScan, setShowScan] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

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
    await db.words.delete(wordId);
  };

  const deleteList = async () => {
    if (!listId) return;
    await db.words.where('listId').equals(listId).delete();
    await db.wordLists.delete(listId);
    navigate('/lists');
  };

  return (
    <div className="min-h-full bg-gray-50">
      <Header
        title={list.name}
        right={
          <button
            onClick={deleteList}
            className="p-2 rounded-lg hover:bg-red-50 text-red-500 touch-manipulation"
            aria-label="Verwijder lijst"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        }
      />

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

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={() => setShowPaste(true)}
          >
            <span className="flex items-center justify-center gap-2">
              <ClipboardPaste className="w-4 h-4" />
              Plak lijst
            </span>
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={() => setShowScan(true)}
          >
            <span className="flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />
              Scan foto
            </span>
          </Button>
        </div>

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
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{word.sourceWord}</span>
                  <span className="text-gray-400 mx-2">=</span>
                  <span className="text-gray-600">{word.dutchWord}</span>
                </div>
                <button
                  onClick={() => deleteWord(word.id)}
                  className="ml-2 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 touch-manipulation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPaste && (
        <PasteDialog
          listId={list.id}
          onClose={() => setShowPaste(false)}
        />
      )}

      {showScan && (
        <ScanDialog
          listId={list.id}
          sourceLanguage={list.sourceLanguage}
          onClose={() => setShowScan(false)}
        />
      )}
    </div>
  );
}
