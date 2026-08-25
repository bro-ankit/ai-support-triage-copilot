import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GoogleGenerativeAI, type Schema, SchemaType } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const TICKET_CATEGORIES = ['billing', 'account', 'bug', 'other'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;
type TicketCategory = (typeof TICKET_CATEGORIES)[number];
type TicketPriority = (typeof TICKET_PRIORITIES)[number];

const EXAMPLES_PER_COMBINATION = 15;
const TRAIN_SPLIT = 0.7;
const VAL_SPLIT = 0.15;
// remainder goes to test

const OUTPUT_DIR = join(__dirname, '..', 'data');

const CATEGORY_SCENARIOS: Record<TicketCategory, string> = {
  billing: 'a problem with a charge, invoice, subscription payment, refund request, or pricing confusion',
  account: 'a problem logging in, resetting a password, changing account details, or account access/permissions',
  bug: 'a product defect: a feature crashing, an error dialog, incorrect output, or something not working as documented',
  other: 'a general question, feature request, feedback, or something that does not fit billing/account/bug',
};

const PRIORITY_SCENARIOS: Record<TicketPriority, string> = {
  low: 'minor annoyance, cosmetic issue, or a question with no urgency, the customer is not blocked',
  medium: 'a real problem that inconveniences the customer but they have a workaround or it is not blocking critical work',
  high: 'urgent and blocking: the customer cannot use the product, is losing money, or explicitly says it is urgent/critical',
};

interface DatasetExample {
  id: string;
  text: string;
  category: TicketCategory;
  priority: TicketPriority;
}

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: { ticketText: { type: SchemaType.STRING } },
  required: ['ticketText'],
};

function buildPrompt(category: TicketCategory, priority: TicketPriority, variantSeed: number): string {
  return [
    `Write a single realistic customer support ticket, as the customer would write it (first person, informal, the way real users type, not polished prose).`,
    `The ticket must be about: ${CATEGORY_SCENARIOS[category]}.`,
    `The urgency/severity must read as: ${PRIORITY_SCENARIOS[priority]}.`,
    `Vary the scenario, wording, tone, and length (some 1-2 sentences, some a full paragraph) from other tickets you might generate. Variation seed: ${variantSeed}.`,
    `Do not mention the words "category" or "priority" literally. Do not include a subject line, just the ticket body.`,
    `Return JSON: {"ticketText": "..."}`,
  ].join('\n');
}

async function generateOne(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  category: TicketCategory,
  priority: TicketPriority,
  variantSeed: number,
): Promise<DatasetExample> {
  const result = await model.generateContent(buildPrompt(category, priority, variantSeed));
  const parsed = JSON.parse(result.response.text()) as { ticketText: string };
  return { id: randomUUID(), text: parsed.ticketText.trim(), category, priority };
}

function splitDataset(examples: DatasetExample[]): { train: DatasetExample[]; val: DatasetExample[]; test: DatasetExample[] } {
  const shuffled = [...examples];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const trainEnd = Math.floor(shuffled.length * TRAIN_SPLIT);
  const valEnd = trainEnd + Math.floor(shuffled.length * VAL_SPLIT);
  return { train: shuffled.slice(0, trainEnd), val: shuffled.slice(trainEnd, valEnd), test: shuffled.slice(valEnd) };
}

function writeJsonl(filePath: string, examples: DatasetExample[]): void {
  const lines = examples.map((ex) => JSON.stringify(ex));
  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_GENERATION_MODEL ?? 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const examples: DatasetExample[] = [];
  let variantSeed = 0;
  for (const category of TICKET_CATEGORIES) {
    for (const priority of TICKET_PRIORITIES) {
      for (let i = 0; i < EXAMPLES_PER_COMBINATION; i++) {
        variantSeed++;
        try {
          const example = await generateOne(model, category, priority, variantSeed);
          examples.push(example);
          console.log(`[${examples.length}] ${category}/${priority}: ${example.text.slice(0, 80)}...`);
        } catch (err) {
          console.error(`Failed to generate ${category}/${priority} #${i}:`, err);
        }
      }
    }
  }

  const { train, val, test } = splitDataset(examples);
  writeJsonl(join(OUTPUT_DIR, 'train.jsonl'), train);
  writeJsonl(join(OUTPUT_DIR, 'val.jsonl'), val);
  writeJsonl(join(OUTPUT_DIR, 'test.jsonl'), test);

  console.log(`\nGenerated ${examples.length} examples: ${train.length} train / ${val.length} val / ${test.length} test`);
  console.log(`Written to ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
