import { Reflector } from '@nestjs/core';

import { Traced, TRACED_KEY } from '../../src/tracing/traced.decorator';

const mapArgs = (id: string) => ({ 'ticket.id': id });
const mapResult = (result: { status: string }) => ({ status: result.status });

class Dummy {
  @Traced('custom_span_name')
  tagged() {
    return 'ok';
  }

  @Traced()
  taggedWithNoName() {
    return 'ok';
  }

  @Traced('with_mappers', mapArgs, mapResult)
  taggedWithMappers() {
    return 'ok';
  }

  untagged() {
    return 'ok';
  }
}

describe('Traced Unit Test', () => {
  const reflector = new Reflector();

  describe('Given a method decorated with @Traced and an explicit span name', () => {
    describe('When metadata is read via Reflector', () => {
      test('Then it stores the span name as retrievable metadata', () => {
        const meta = reflector.get(TRACED_KEY, Dummy.prototype.tagged);
        expect(meta).toEqual({ spanName: 'custom_span_name', mapArgs: undefined, mapResult: undefined });
      });
    });
  });

  describe('Given a method decorated with @Traced and no span name', () => {
    describe('When metadata is read via Reflector', () => {
      test('Then the span name is undefined, left for the discovery service to default', () => {
        const meta = reflector.get(TRACED_KEY, Dummy.prototype.taggedWithNoName);
        expect(meta).toEqual({ spanName: undefined, mapArgs: undefined, mapResult: undefined });
      });
    });
  });

  describe('Given a method decorated with @Traced, mapArgs, and mapResult', () => {
    describe('When metadata is read via Reflector', () => {
      test('Then the mapper functions are stored as retrievable metadata', () => {
        const meta = reflector.get(TRACED_KEY, Dummy.prototype.taggedWithMappers);
        expect(meta).toEqual({ spanName: 'with_mappers', mapArgs, mapResult });
      });
    });
  });

  describe('Given a method without the decorator', () => {
    describe('When metadata is read via Reflector', () => {
      test('Then no metadata is present', () => {
        const meta = reflector.get(TRACED_KEY, Dummy.prototype.untagged);
        expect(meta).toBeUndefined();
      });
    });
  });
});
