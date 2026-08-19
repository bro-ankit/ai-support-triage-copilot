import { customType } from 'drizzle-orm/pg-core';

import type { VectorColumnConfig } from './vector.types';

export class VectorTypeUtil {
  static parseString(raw: string): number[] {
    const inner = raw.slice(1, -1);
    if (!inner) return [];
    const parts = inner.split(',');
    const result = new Array<number>(parts.length);
    for (let i = 0; i < parts.length; i++) {
      result[i] = +parts[i];
    }
    return result;
  }

  static toDriverString(value: number[]): string {
    return `[${value.join(',')}]`;
  }

  static createVectorType(dimensions: number) {
    return customType<{ data: number[]; driverData: string }>(this.buildConfig(dimensions));
  }

  static buildConfig(dimensions: number): VectorColumnConfig {
    return {
      dataType: () => `vector(${dimensions})`,
      toDriver: this.toDriverString,
      fromDriver: this.parseString,
    };
  }
}
