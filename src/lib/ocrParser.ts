import type { Language } from '../models/types';

export interface OcrWordBox {
  text: string;
  bbox: { x0: number; x1: number; y0: number; y1: number };
  confidence: number;
}

export interface ParsedWordPair {
  sourceWord: string;
  dutchWord: string;
}

/**
 * Maps app Language type to Tesseract language codes.
 * Always includes Dutch (nld) since the right column is Dutch.
 */
export function getTesseractLangs(sourceLanguage: Language): string {
  const map: Record<Language, string> = {
    en: 'eng+nld',
    fr: 'fra+nld',
    de: 'deu+nld',
    es: 'spa+nld',
    la: 'lat+nld',
    el: 'grc+nld',
    other: 'nld',
  };
  return map[sourceLanguage];
}

/**
 * Main entry: takes Tesseract word-level results and returns word pairs.
 */
export function parseWordPairs(words: OcrWordBox[], imageWidth: number): ParsedWordPair[] {
  const filtered = words.filter(w => w.confidence > 30 && w.text.trim().length > 0);
  if (filtered.length === 0) return [];

  const lines = groupWordsIntoLines(filtered, imageWidth);
  if (lines.length === 0) return [];

  // Try column-based splitting first
  const splitX = findColumnSplit(filtered, imageWidth);
  const pairs = lines
    .map(line => splitLineIntoColumns(line, splitX))
    .filter(({ left, right }) => left.length > 0 && right.length > 0)
    .map(({ left, right }) => ({ sourceWord: left, dutchWord: right }));

  if (pairs.length > 0) return pairs;

  // Fallback: try splitting on separator characters (=, -, :, –)
  return tryParseBySeparator(lines);
}

function avgY(box: OcrWordBox): number {
  return (box.bbox.y0 + box.bbox.y1) / 2;
}

/**
 * Group words into lines by y-coordinate proximity.
 */
function groupWordsIntoLines(words: OcrWordBox[], imageHeight: number): OcrWordBox[][] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => avgY(a) - avgY(b));
  // Threshold: ~1.5% of image height, minimum 10px
  const threshold = Math.max(10, imageHeight * 0.015);

  const lines: OcrWordBox[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const prevYCenter = avgY(lines[lines.length - 1][0]);
    const currYCenter = avgY(sorted[i]);

    if (Math.abs(currYCenter - prevYCenter) < threshold) {
      lines[lines.length - 1].push(sorted[i]);
    } else {
      lines.push([sorted[i]]);
    }
  }

  // Sort words within each line left-to-right
  for (const line of lines) {
    line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  return lines;
}

/**
 * Find the column split point by looking for the largest horizontal gap
 * between words across all lines.
 */
function findColumnSplit(words: OcrWordBox[], imageWidth: number): number {
  const lines = groupWordsIntoLines(words, imageWidth);
  const gaps: { x: number; size: number }[] = [];

  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const gapStart = line[i].bbox.x1;
      const gapEnd = line[i + 1].bbox.x0;
      const gapSize = gapEnd - gapStart;
      const gapCenter = (gapStart + gapEnd) / 2;

      // Only consider gaps in the middle 60% of the image
      if (gapCenter > imageWidth * 0.2 && gapCenter < imageWidth * 0.8 && gapSize > 0) {
        gaps.push({ x: gapCenter, size: gapSize });
      }
    }
  }

  if (gaps.length === 0) return imageWidth / 2;

  // Find the largest gap
  gaps.sort((a, b) => b.size - a.size);
  return gaps[0].x;
}

/**
 * Split a line of words into left and right columns based on split point.
 */
function splitLineIntoColumns(
  lineWords: OcrWordBox[],
  splitX: number,
): { left: string; right: string } {
  const leftWords = lineWords.filter(w => (w.bbox.x0 + w.bbox.x1) / 2 < splitX);
  const rightWords = lineWords.filter(w => (w.bbox.x0 + w.bbox.x1) / 2 >= splitX);

  return {
    left: leftWords.map(w => w.text).join(' ').trim(),
    right: rightWords.map(w => w.text).join(' ').trim(),
  };
}

/**
 * Fallback: try splitting lines on separator characters (=, -, –, :).
 */
function tryParseBySeparator(lines: OcrWordBox[][]): ParsedWordPair[] {
  const separators = /\s+[=\-–:]\s+/;
  const pairs: ParsedWordPair[] = [];

  for (const line of lines) {
    const fullText = line.map(w => w.text).join(' ').trim();
    const parts = fullText.split(separators);
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      pairs.push({ sourceWord: parts[0].trim(), dutchWord: parts[1].trim() });
    }
  }

  return pairs;
}
