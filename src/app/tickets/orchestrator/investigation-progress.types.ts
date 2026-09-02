export const INVESTIGATION_STAGES = [
  'context_loaded',
  'classified',
  'recalled',
  'retrieved',
  'diagnosed',
  'proposed',
] as const;
export type InvestigationStage = (typeof INVESTIGATION_STAGES)[number];
