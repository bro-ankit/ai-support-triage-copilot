import { randomUUID } from 'node:crypto';

import { AuthorizedUserRepository } from '../../src/auth/authorized-user.repository';
import { authorizedUsersTable } from '../../src/schema/authorized-users.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

describe('AuthorizedUserRepository IT', () => {
  let sut: AuthorizedUserRepository;
  const env = new DrizzleTestEnvironment();

  beforeAll(async () => {
    await env.start([AuthorizedUserRepository]);
    sut = env.module.get(AuthorizedUserRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(authorizedUsersTable);
  });

  describe('Given an authorized user', () => {
    describe('When findBySub is called with their sub', () => {
      test('Then it returns the row with its mapped tenantId and scopes', async () => {
        const tenantId = randomUUID();
        const [seeded] = await env.db
          .insert(authorizedUsersTable)
          .values({ id: randomUUID(), sub: 'auth0|abc123', tenantId, scopes: ['mcp'] })
          .returning();

        const result = await sut.findBySub('auth0|abc123');

        expect(result).toEqual(seeded);
      });
    });
  });

  describe('Given no authorized user is registered for a given sub', () => {
    describe('When findBySub is called', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findBySub('unregistered-sub');

        expect(result).toBeUndefined();
      });
    });
  });
});
