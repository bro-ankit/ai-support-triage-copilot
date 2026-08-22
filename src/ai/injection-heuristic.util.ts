

export class InjectionHeuristicUtil {
  private static readonly SUSPICIOUS_PATTERNS = [
    // Direct Overrides & Disregard Commands
    /\bignore (all|previous|prior) instructions\b/i,
    /\bdisregard (the|all) (above|prior|previous)\b/i,
    /\bforget (your|all) (rules|instructions|directives|constraints)\b/i,
    /\bnew instructions?:/i,
    /\boverride safety protocols\b/i,

    // Roleplay / Jailbreak Personas
    /\byou are now\b/i,
    /\bact as an? (unrestricted|developer mode|jailbroken)\b/i,
    /\bdo anything now\b/i,

    // Prompt Extraction / Leakage
    /\bsystem prompt\b/i,
    /\b(repeat|print|show) (the|your) (system|initial) (prompt|instructions)\b/i,
    /\bwhat (are|were) your instructions\b/i,

    // Special Token / Boundary Delimiter Injection
    /\[\s*system\s*\]/i,
    /<\/?system>/i,
    /<\|?\/?im_start\|?>/i,
    /<\|?\/?im_end\|?>/i,

    // Business Logic Overrides
    /\binternal note\b/i,
    /\bpre-?approved\b/i,
    /\balready (promised|approved)\b/i,
  ];

  static looksLikeInjectionAttempt(text: string): boolean {
    const normalized = text
      .normalize('NFKD')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');

    return this.SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(normalized));
  }
}