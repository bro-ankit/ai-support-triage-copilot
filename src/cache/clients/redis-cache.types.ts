export interface RedisCacheClient {
  incr(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  expire(key: string, seconds: number): Promise<boolean>;
  ft: {
    create(index: string, schema: object, options: { ON: 'JSON'; PREFIX: string }): Promise<unknown>;
    search(
      index: string,
      query: string,
      options: { PARAMS: Record<string, Buffer>; SORTBY: string; DIALECT: number; RETURN: string[] },
    ): Promise<{ documents: Array<{ id: string; value: Record<string, unknown> }> }>;
  };
  json: {
    set(key: string, path: string, value: unknown): Promise<unknown>;
  };
}
