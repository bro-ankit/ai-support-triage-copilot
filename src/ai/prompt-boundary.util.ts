export class PromptBoundaryUtil {
  static wrap(tag: string, content: string): string {
    return `<${tag}>\n${content}\n</${tag}>`;
  }
}
