
export class RedisTagEscapeUtil {
  // RediSearch TAG queries require escaping special characters, hyphens included: an unescaped
  // UUID like `@tenant_id:{11111111-1111-1111-1111-111111111111}` 
  private static readonly TAG_SPECIAL_CHARS_PATTERN = /[,.<>{}[\]"':;!@#$%^&*()\-+=~\s]/g;

  static escape(value: string): string {
    return value.replace(this.TAG_SPECIAL_CHARS_PATTERN, '\\$&');
  }
}
