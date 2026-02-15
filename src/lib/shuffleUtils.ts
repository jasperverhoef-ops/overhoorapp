/** Fisher-Yates shuffle (in-place, returns same array) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick a random element from an array */
export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random direction */
export function randomDirection(): 'source-to-dutch' | 'dutch-to-source' {
  return Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
}
