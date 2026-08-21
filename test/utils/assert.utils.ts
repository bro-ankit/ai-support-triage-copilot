type ParsedSseEvent = { event: string; data: unknown };

export class AssertUtils {
  static assertError = async (callback: () => Promise<any>, message: string, status?: number): Promise<unknown> => {
    const promise = callback();

    await expect(promise).rejects.toThrow();

    const error: unknown = await promise.catch((error: unknown) => {
      expect(error).toHaveProperty('message', message);
      if (status) {
        expect(error).toHaveProperty('status', status);
      }
      return error;
    });

    return error;
  };

  static assertSseEvents = (text: string, expected: ParsedSseEvent[]): void => {
    const events: ParsedSseEvent[] = [];
    for (const line of text.split('\n')) {
      if (line.startsWith('event: ')) {
        events.push({ event: line.slice('event: '.length), data: undefined });
      } else if (line.startsWith('data: ')) {
        const raw = line.slice('data: '.length);
        events[events.length - 1].data = JSON.parse(raw.slice(0, raw.lastIndexOf('}') + 1));
      }
    }
    expect(events).toEqual(expected);
  };
}
