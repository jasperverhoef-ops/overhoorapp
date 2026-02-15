import { useState, useRef } from 'react';
import { X, Trash2, Plus, Camera, AlertCircle } from 'lucide-react';
import { db } from '../../db';
import { Button } from '../ui/Button';
import type { Language } from '../../models/types';
import { getTesseractLangs, parseWordPairs, type ParsedWordPair } from '../../lib/ocrParser';

interface ScanDialogProps {
  listId: string;
  sourceLanguage: Language;
  onClose: () => void;
}

type Phase = 'idle' | 'processing' | 'review' | 'saving' | 'error';

export function ScanDialog({ listId, sourceLanguage, onClose }: ScanDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [wordPairs, setWordPairs] = useState<ParsedWordPair[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file input on mount or retry
  const triggerCapture = () => {
    setError('');
    setPhase('idle');
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // User cancelled
    // Reset for next use
    e.target.value = '';
    await runOcr(file);
  };

  const runOcr = async (imageFile: File) => {
    setPhase('processing');
    setProgress(0);
    setStatusText('OCR-model laden...');

    try {
      const Tesseract = await import('tesseract.js');
      const langs = getTesseractLangs(sourceLanguage);

      const worker = await Tesseract.createWorker(langs, undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
            setStatusText('Tekst herkennen...');
          } else if (m.status === 'loading language traineddata') {
            setStatusText('Taaldata laden...');
          }
        },
      });

      const result = await worker.recognize(imageFile);
      await worker.terminate();

      // Extract all words from nested structure: blocks > paragraphs > lines > words
      const allWords: { text: string; bbox: { x0: number; x1: number; y0: number; y1: number }; confidence: number }[] = [];
      for (const block of result.data.blocks || []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              allWords.push({ text: word.text, bbox: word.bbox, confidence: word.confidence });
            }
          }
        }
      }
      const words = allWords;

      // Use image dimensions for parsing
      const img = new Image();
      const imageWidth = await new Promise<number>((resolve) => {
        img.onload = () => resolve(img.naturalWidth);
        img.onerror = () => resolve(1000); // fallback
        img.src = URL.createObjectURL(imageFile);
      });
      URL.revokeObjectURL(img.src);

      const pairs = parseWordPairs(words, imageWidth);

      if (pairs.length === 0) {
        if (words.length === 0) {
          setError('Geen tekst gevonden. Probeer een duidelijkere foto met goede belichting.');
        } else {
          setError('Kon geen woordparen herkennen. Zorg dat de foto twee kolommen met woorden bevat.');
        }
        setPhase('error');
        return;
      }

      setWordPairs(pairs);
      setPhase('review');
    } catch {
      setError('Kon de tekstherkenning niet laden. Controleer je internetverbinding en probeer opnieuw.');
      setPhase('error');
    }
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

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Foto scannen</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Idle: prompt to take photo */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
              <Camera className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">Maak een foto van je woordenlijst</p>
              <p className="text-sm text-gray-500 mt-1">Zorg dat beide kolommen goed zichtbaar zijn</p>
            </div>
            <Button variant="primary" size="lg" onClick={triggerCapture}>
              <span className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Maak foto
              </span>
            </Button>
          </div>
        )}

        {/* Processing: show progress */}
        {phase === 'processing' && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-full max-w-xs space-y-4">
              <p className="text-center text-gray-600 font-medium">{statusText}</p>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-400">
                {progress > 0 ? `${progress}%` : 'Even geduld...'}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-gray-700 max-w-xs">{error}</p>
            <Button variant="primary" size="md" onClick={triggerCapture}>
              Probeer opnieuw
            </Button>
          </div>
        )}

        {/* Review: editable word pairs */}
        {(phase === 'review' || phase === 'saving') && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Gevonden woorden ({wordPairs.length})
            </h3>

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

      {/* Footer: save/cancel buttons (only in review phase) */}
      {(phase === 'review' || phase === 'saving') && (
        <div className="shrink-0 border-t border-gray-100 p-4 flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleSave}
            disabled={validCount === 0 || phase === 'saving'}
          >
            {phase === 'saving' ? 'Opslaan...' : `${validCount} woorden opslaan`}
          </Button>
        </div>
      )}
    </div>
  );
}
