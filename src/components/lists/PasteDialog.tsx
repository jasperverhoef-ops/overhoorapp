import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { db } from '../../db';
import { Button } from '../ui/Button';

interface PasteDialogProps {
  listId: string;
  onClose: () => void;
}

interface WordPair {
  sourceWord: string;
  dutchWord: string;
}

function parseTextToWordPairs(text: string): WordPair[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Split on first separator: tab, =, – (en-dash), — (em-dash), or spaced hyphen ( - )
      const match = line.match(/^(.+?)(?:\t|=|–|—|\s-\s)(.+)$/);
      if (!match) return null;
      const source = match[1].trim();
      const dutch = match[2].trim();
      if (!source || !dutch) return null;
      return { sourceWord: source, dutchWord: dutch };
    })
    .filter((pair): pair is WordPair => pair !== null);
}

export function PasteDialog({ listId, onClose }: PasteDialogProps) {
  const [text, setText] = useState('');
  const [wordPairs, setWordPairs] = useState<WordPair[]>([]);
  const [phase, setPhase] = useState<'input' | 'review' | 'saving'>('input');

  const handleProcess = () => {
    const pairs = parseTextToWordPairs(text);
    if (pairs.length === 0) return;
    setWordPairs(pairs);
    setPhase('review');
  };

  const updatePair = (index: number, field: 'sourceWord' | 'dutchWord', value: string) => {
    setWordPairs(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const deletePair = (index: number) => {
    setWordPairs(prev => prev.filter((_, i) => i !== index));
  };

  const addEmptyPair = () => {
    setWordPairs(prev => [...prev, { sourceWord: '', dutchWord: '' }]);
  };

  const handleSave = async () => {
    setPhase('saving');
    const validPairs = wordPairs.filter(p => p.sourceWord.trim() && p.dutchWord.trim());

    const newWords = validPairs.map(pair => ({
      id: crypto.randomUUID(),
      listId,
      sourceWord: pair.sourceWord.trim(),
      dutchWord: pair.dutchWord.trim(),
    }));

    await db.words.bulkAdd(newWords);
    await db.wordLists.update(listId, { updatedAt: Date.now() });
    onClose();
  };

  const validCount = wordPairs.filter(p => p.sourceWord.trim() && p.dutchWord.trim()).length;
  const previewCount = parseTextToWordPairs(text).length;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Lijst plakken</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Input phase */}
        {phase === 'input' && (
          <div className="space-y-3 h-full flex flex-col">
            <p className="text-sm text-gray-500">
              Plak je woordenlijst hieronder. Eén woordpaar per regel, gescheiden door = - : of tab.
            </p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"house = huis\ndog = hond\ncat = kat"}
              className="flex-1 min-h-[200px] w-full px-4 py-3 border border-gray-300 rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              autoFocus
            />
            {previewCount > 0 && (
              <p className="text-sm text-gray-500">
                {previewCount} woordparen herkend
              </p>
            )}
          </div>
        )}

        {/* Review phase */}
        {(phase === 'review' || phase === 'saving') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Woordparen ({wordPairs.length})
              </h3>
              <button
                onClick={() => setPhase('input')}
                className="text-sm text-blue-600 hover:text-blue-700 touch-manipulation"
              >
                Terug naar tekst
              </button>
            </div>

            {wordPairs.map((pair, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pair.sourceWord}
                  onChange={e => updatePair(index, 'sourceWord', e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Woord"
                />
                <input
                  type="text"
                  value={pair.dutchWord}
                  onChange={e => updatePair(index, 'dutchWord', e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nederlands"
                />
                <button
                  onClick={() => deletePair(index)}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 touch-manipulation shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={addEmptyPair}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-2 touch-manipulation"
            >
              <Plus className="w-4 h-4" />
              Rij toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100 p-4 flex gap-3">
        <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
          Annuleren
        </Button>
        {phase === 'input' ? (
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleProcess}
            disabled={previewCount === 0}
          >
            {previewCount > 0 ? `${previewCount} woorden verwerken` : 'Verwerken'}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleSave}
            disabled={validCount === 0 || phase === 'saving'}
          >
            {phase === 'saving' ? 'Opslaan...' : `${validCount} woorden opslaan`}
          </Button>
        )}
      </div>
    </div>
  );
}
