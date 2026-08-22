

export class TextSanitizerUtil {
  private static readonly HIDDEN_CHARACTERS_PATTERN = new RegExp(
    '[' +
    '\\u200B-\\u200F' + // Zero-width spaces, joiners, directionality marks
    '\\u202A-\\u202E' + // BiDi control characters
    '\\u2060-\\u206F' + // Word joiners, invisible operators, BiDi isolates
    '\\uFEFF' +         // Zero-width no-break space / BOM
    '\\u00AD' +         // Soft hyphen
    '\\uFE00-\\uFE0F' + // Variation selectors
    '\\u0000-\\u0008' + // C0 control codes (preserves \t, \n, \r)
    '\\u000B\\u000C' + // Vertical tab, form feed
    '\\u000E-\\u001F' + // C0 controls
    '\\u007F-\\u009F' + // DEL and C1 control codes
    '\\u{E0000}-\\u{E007F}' + // Invisible Unicode Tags (critical for ASCII tag smuggling)
    ']',
    'gu', // 'u' flag required for 32-bit codepoint ranges like \u{E0000}
  );

  static stripHiddenCharacters(text: string): string {
    if (!text) return '';
    return text.replace(this.HIDDEN_CHARACTERS_PATTERN, '');
  }
}