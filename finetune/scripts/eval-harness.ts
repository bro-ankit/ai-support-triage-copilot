import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GoogleGenerativeAI, type Schema, SchemaType } from '@google/generative-ai';
import * as dotenv from 'dotenv';

import { PromptBoundaryUtil } from '../../src/ai/prompt-boundary.util';
import { CLASSIFY_TICKET_SYSTEM_PROMPT } from '../../src/app/tickets/agents/ticket-classification.contract';

dotenv.config();

const TEST_FILE = join(__dirname, '..', 'data', 'test.jsonl');
const RESULTS_FILE = join(__dirname, '..', 'data', 'eval-results.json');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'ticket-classifier';

const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    category: { type: SchemaType.STRING },
    priority: { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
  },
  required: ['category', 'priority', 'confidence'],
};

interface TestExample {
  id: string;
  text: string;
  category: string;
  priority: string;
}

interface ModelPrediction {
  category: string | null;
  priority: string | null;
  confidence: number | null;
  latencyMs: number;
  rawOutput: string;
  parseError: boolean;
  costUsd: number;
}

interface EvalRow {
  id: string;
  text: string;
  expectedCategory: string;
  expectedPriority: string;
  gemini: ModelPrediction;
  fineTuned: ModelPrediction;
}

function loadTestSet(): TestExample[] {
  return readFileSync(TEST_FILE, 'utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as TestExample);
}

function buildUserContent(text: string): string {
  return PromptBoundaryUtil.wrap('untrusted_ticket_content', `Subject: (none)\nDescription: ${text}\nAttachment text: (none)`);
}

function parsePrediction(rawText: string): Omit<ModelPrediction, 'latencyMs' | 'rawOutput' | 'costUsd'> {
  try {
    const parsed = JSON.parse(rawText) as { category?: string; priority?: string; confidence?: number };
    return {
      category: parsed.category ?? null,
      priority: parsed.priority ?? null,
      confidence: parsed.confidence ?? null,
      parseError: false,
    };
  } catch {
    return { category: null, priority: null, confidence: null, parseError: true };
  }
}

const GEMINI_COST_INPUT_PER_MILLION = Number(process.env.GEMINI_COST_INPUT_PER_MILLION ?? 0.3);
const GEMINI_COST_OUTPUT_PER_MILLION = Number(process.env.GEMINI_COST_OUTPUT_PER_MILLION ?? 1.0);

async function callGemini(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  text: string,
): Promise<ModelPrediction> {
  const start = Date.now();
  const result = await model.generateContent(buildUserContent(text));
  const latencyMs = Date.now() - start;
  const rawOutput = result.response.text();
  const usage = result.response.usageMetadata;
  const costUsd = usage
    ? ((usage.promptTokenCount ?? 0) * GEMINI_COST_INPUT_PER_MILLION +
      (usage.candidatesTokenCount ?? 0) * GEMINI_COST_OUTPUT_PER_MILLION) /
    1_000_000
    : 0;
  return { ...parsePrediction(rawOutput), latencyMs, rawOutput, costUsd };
}

async function callFineTuned(text: string): Promise<ModelPrediction> {
  const start = Date.now();
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `${CLASSIFY_TICKET_SYSTEM_PROMPT}\n\n${buildUserContent(text)}`,
      stream: false,
    }),
  });
  const latencyMs = Date.now() - start;
  const body = (await res.json()) as { response: string };
  // self-hosted, no per-call API cost, only local compute/electricity, not comparable to a metered API bill
  return { ...parsePrediction(body.response), latencyMs, rawOutput: body.response, costUsd: 0 };
}

function accuracy(rows: EvalRow[], model: 'gemini' | 'fineTuned', field: 'category' | 'priority'): number {
  const correct = rows.filter((r) => r[model][field] === r[`expected${field === 'category' ? 'Category' : 'Priority'}`]).length;
  return correct / rows.length;
}

function bothCorrect(rows: EvalRow[], model: 'gemini' | 'fineTuned'): number {
  const correct = rows.filter((r) => r[model].category === r.expectedCategory && r[model].priority === r.expectedPriority).length;
  return correct / rows.length;
}

function avgLatency(rows: EvalRow[], model: 'gemini' | 'fineTuned'): number {
  return rows.reduce((sum, r) => sum + r[model].latencyMs, 0) / rows.length;
}

function totalCost(rows: EvalRow[], model: 'gemini' | 'fineTuned'): number {
  return rows.reduce((sum, r) => sum + r[model].costUsd, 0);
}

function parseErrorCount(rows: EvalRow[], model: 'gemini' | 'fineTuned'): number {
  return rows.filter((r) => r[model].parseError).length;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const client = new GoogleGenerativeAI(apiKey);
  const geminiModel = client.getGenerativeModel({
    model: process.env.GEMINI_GENERATION_MODEL ?? 'gemini-3.5-flash',
    systemInstruction: CLASSIFY_TICKET_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_RESPONSE_SCHEMA },
  });

  const testSet = loadTestSet();
  const rows: EvalRow[] = [];

  for (const [i, example] of testSet.entries()) {
    const [gemini, fineTuned] = await Promise.all([callGemini(geminiModel, example.text), callFineTuned(example.text)]);
    rows.push({
      id: example.id,
      text: example.text,
      expectedCategory: example.category,
      expectedPriority: example.priority,
      gemini,
      fineTuned,
    });
    console.log(
      `[${i + 1}/${testSet.length}] expected=${example.category}/${example.priority} ` +
      `gemini=${gemini.category}/${gemini.priority} (${gemini.latencyMs}ms) ` +
      `fineTuned=${fineTuned.category}/${fineTuned.priority} (${fineTuned.latencyMs}ms)`,
    );
  }

  const summary = {
    testSetSize: rows.length,
    gemini: {
      categoryAccuracy: accuracy(rows, 'gemini', 'category'),
      priorityAccuracy: accuracy(rows, 'gemini', 'priority'),
      bothCorrectAccuracy: bothCorrect(rows, 'gemini'),
      avgLatencyMs: avgLatency(rows, 'gemini'),
      parseErrors: parseErrorCount(rows, 'gemini'),
      totalCostUsd: totalCost(rows, 'gemini'),
    },
    fineTuned: {
      categoryAccuracy: accuracy(rows, 'fineTuned', 'category'),
      priorityAccuracy: accuracy(rows, 'fineTuned', 'priority'),
      bothCorrectAccuracy: bothCorrect(rows, 'fineTuned'),
      avgLatencyMs: avgLatency(rows, 'fineTuned'),
      parseErrors: parseErrorCount(rows, 'fineTuned'),
      totalCostUsd: totalCost(rows, 'fineTuned'),
    },
  };

  writeFileSync(RESULTS_FILE, JSON.stringify({ summary, rows }, null, 2), 'utf-8');

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nFull results written to ${RESULTS_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
