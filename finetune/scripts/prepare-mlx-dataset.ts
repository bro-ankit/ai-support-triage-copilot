import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PromptBoundaryUtil } from '../../src/ai/prompt-boundary.util';
import { CLASSIFY_TICKET_SYSTEM_PROMPT } from '../../src/app/tickets/agents/ticket-classification.contract';

const DATA_DIR = join(__dirname, '..', 'data');
const MLX_DIR = join(DATA_DIR, 'mlx');

interface DatasetExample {
  id: string;
  text: string;
  category: string;
  priority: string;
}

const SPLITS: { source: string; target: string }[] = [
  { source: 'train.jsonl', target: 'train.jsonl' },
  { source: 'val.jsonl', target: 'valid.jsonl' },
  { source: 'test.jsonl', target: 'test.jsonl' },
];

function toChatExample(example: DatasetExample): { messages: { role: string; content: string }[] } {
  return {
    messages: [
      { role: 'system', content: CLASSIFY_TICKET_SYSTEM_PROMPT },
      {
        role: 'user',
        content: PromptBoundaryUtil.wrap(
          'untrusted_ticket_content',
          `Subject: (none)\nDescription: ${example.text}\nAttachment text: (none)`,
        ),
      },
      {
        role: 'assistant',
        content: JSON.stringify({ category: example.category, priority: example.priority, confidence: 1 }),
      },
    ],
  };
}

function convertSplit(source: string, target: string): number {
  const lines = readFileSync(join(DATA_DIR, source), 'utf-8').trim().split('\n');
  const converted = lines.map((line) => JSON.stringify(toChatExample(JSON.parse(line) as DatasetExample)));
  writeFileSync(join(MLX_DIR, target), converted.join('\n') + '\n', 'utf-8');
  return converted.length;
}

function main(): void {
  mkdirSync(MLX_DIR, { recursive: true });
  console.log(`System prompt in use (must match ClassifyTicketAgent):\n${CLASSIFY_TICKET_SYSTEM_PROMPT}\n`);
  for (const { source, target } of SPLITS) {
    const count = convertSplit(source, target);
    console.log(`${source} -> mlx/${target}: ${count} examples`);
  }
}

main();
