import { UUID } from "crypto";

export type RerankCandidate = { id: UUID; text: string };
export type RerankResult = { id: UUID; score: number };
