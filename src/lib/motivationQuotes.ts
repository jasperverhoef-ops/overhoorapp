const QUOTES = [
  'Je doet het super! Ga zo door!',
  'Wow, wat goed! Je wordt steeds beter!',
  'Knap hoor, je leert snel!',
  'Lekker bezig! Je hersenen worden sterker!',
  'Top! Elke fout is een kans om te leren!',
  'Je bent een echte taalheld!',
  'Geweldig! Je woordenschat groeit!',
  'Doorzetten! Je bent al zo ver gekomen!',
  'Wat ben jij slim bezig!',
  'Fantastisch! Nog even en je kent ze allemaal!',
  'Je mag trots op jezelf zijn!',
  'Goed bezig, kei! Blijf zo doorgaan!',
  'Indrukwekkend! Je maakt het verschil!',
  'Yes! Je bent op de goede weg!',
  'Sterk! Je geeft niet op en dat loont!',
  'Wauw, je bent een echte doorzetter!',
  'Respect! Je oefent als een kampioen!',
  'Elke vraag maakt je slimmer!',
  'Daar word je goed in, merk je het?',
  'Je bent een woordenwonder!',
  'Niet opgeven, je kan dit!',
  'Wat knap dat je zo hard oefent!',
  'Je bent bijna een taalexpert!',
  'Nog een paar en je hebt ze allemaal!',
];

let lastQuoteIndex = -1;

/**
 * Check if a motivational quote should be shown based on the total answer count.
 * Shows a quote every 6–12 answers (randomized interval).
 */
export function shouldShowQuote(totalAnswers: number, nextQuoteAt: number): boolean {
  return totalAnswers >= nextQuoteAt;
}

/** Pick the next answer count at which to show a quote (6–12 from now). */
export function getNextQuoteThreshold(currentAnswers: number): number {
  const interval = 6 + Math.floor(Math.random() * 7); // 6 to 12
  return currentAnswers + interval;
}

/** Get a random motivational quote (avoids repeating the last one). */
export function getRandomQuote(): string {
  let index: number;
  do {
    index = Math.floor(Math.random() * QUOTES.length);
  } while (index === lastQuoteIndex && QUOTES.length > 1);
  lastQuoteIndex = index;
  return QUOTES[index];
}
