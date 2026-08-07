#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { createGenerator, general, properNouns } from '../src/index.js';

const HELP = `lorem-gibson — cyberpunk placeholder text on demand

Usage:
  lorem-gibson [command] [options]

Commands:
  word         one word (default 1)
  words        alias for "word -n N"
  sentence     one or more sentences
  paragraph    one or more paragraphs (default command if none given)
  title        Title Case phrase — good for UI mock headings
  slug         kebab-case phrase — good for URLs/filenames
  dictionary   dump the merged word list

Options:
  -n, --count <N>     how many to generate (default: 1)
  --seed <value>      deterministic output — same seed, same result
  --json              wrap output as a JSON array/string
  --tier <tier>       dictionary only: general | proper | all (default: all)
  --format <fmt>      dictionary only: json | csv | txt (default: json)
  --out <file>        dictionary only: write to file instead of stdout
  -h, --help          show this help

Examples:
  npx lorem-gibson paragraph -n 3
  npx lorem-gibson sentence --seed demo-page
  npx lorem-gibson title -n 4
  npx lorem-gibson dictionary --format csv --out gibson-words.csv
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '-n' || arg === '--count') args.count = Number(argv[++i]);
    else if (arg === '--seed') args.seed = argv[++i];
    else if (arg === '--tier') args.tier = argv[++i];
    else if (arg === '--format') args.format = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else args._.push(arg);
  }
  return args;
}

function toCsv(rows) {
  return rows.map((w) => `"${w.replace(/"/g, '""')}"`).join('\n');
}

function runDictionary(args) {
  const tier = args.tier ?? 'all';
  const format = args.format ?? 'json';
  const list = tier === 'general' ? general : tier === 'proper' ? properNouns : [...general, ...properNouns];

  let output;
  if (format === 'csv') output = toCsv(list);
  else if (format === 'txt') output = list.join('\n');
  else output = JSON.stringify(list, null, 2);

  if (args.out) {
    writeFileSync(args.out, output + '\n', 'utf-8');
    console.error(`Wrote ${list.length} words (${tier}, ${format}) to ${args.out}`);
  } else {
    console.log(output);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const command = args._[0] ?? 'paragraph';
  const count = Number.isFinite(args.count) ? args.count : 1;
  const gen = createGenerator({ seed: args.seed });

  if (command === 'dictionary') {
    runDictionary(args);
    return;
  }

  const producers = {
    word: () => Array.from({ length: count }, gen.word),
    words: () => Array.from({ length: count }, gen.word),
    sentence: () => gen.sentences(count),
    paragraph: () => gen.paragraphs(count),
    title: () => Array.from({ length: count }, () => gen.title()),
    slug: () => Array.from({ length: count }, () => gen.slug()),
  };

  const produce = producers[command];
  if (!produce) {
    console.error(`Unknown command "${command}".\n`);
    console.log(HELP);
    process.exitCode = 1;
    return;
  }

  const results = produce();

  if (args.json) {
    console.log(JSON.stringify(count === 1 ? results[0] : results, null, 2));
  } else if (command === 'paragraph') {
    console.log(results.join('\n\n'));
  } else {
    console.log(results.join('\n'));
  }
}

main();
