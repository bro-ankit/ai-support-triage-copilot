import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import type { ClassifyTicketResponse } from '../../../../src/app/tickets/classification/ticket-classification.contract';
import { TicketClassifierAgent } from '../../../../src/app/tickets/classification/ticket-classifier.agent';
import { TICKET_CLASSIFIER_CHAIN } from '../../../../src/app/tickets/classification/ticket-classifier.constants';
import type { ITicketClassifier } from '../../../../src/app/tickets/classification/ticket-classifier.interface';
import { mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET = mockTicketSelect();
const ATTACHMENT_TEXT = 'attachment text';
const FIRST_RESULT: ClassifyTicketResponse = { category: 'billing', priority: 'high', confidence: 1 };
const ARBITER_RESULT: ClassifyTicketResponse = { category: 'account', priority: 'medium', confidence: 0.8 };

describe('TicketClassifierAgent Unit Test', () => {
  let sut: TicketClassifierAgent;
  let firstClassifier: jest.Mocked<ITicketClassifier>;
  let arbiterClassifier: jest.Mocked<ITicketClassifier>;

  beforeAll(() => {
    firstClassifier = { name: 'first', classify: jest.fn() };
    arbiterClassifier = { name: 'arbiter', classify: jest.fn() };

    const { unit } = TestBed.create(TicketClassifierAgent)
      .mock(TICKET_CLASSIFIER_CHAIN)
      .using([firstClassifier, arbiterClassifier])
      .mock(ConfigService)
      .using({ get: (_key: string, defaultValue?: unknown) => defaultValue })
      .compile();

    sut = unit;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  describe('Given classify', () => {
    describe('When the first classifier in the chain produces a result', () => {
      test('Then it returns that result without calling the next classifier', async () => {
        firstClassifier.classify.mockResolvedValue(FIRST_RESULT);

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);

        expect(result).toEqual(FIRST_RESULT);
        expect(arbiterClassifier.classify).not.toHaveBeenCalled();
      });
    });

    describe('When the first classifier returns null', () => {
      test('Then it falls through to the next classifier and returns its result', async () => {
        firstClassifier.classify.mockResolvedValue(null);
        arbiterClassifier.classify.mockResolvedValue(ARBITER_RESULT);

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);

        expect(result).toEqual(ARBITER_RESULT);
      });
    });

    describe('When no classifier in the chain produces a result', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        firstClassifier.classify.mockResolvedValue(null);
        arbiterClassifier.classify.mockResolvedValue(null);

        await AssertUtils.assertError(
          () => sut.classify(TICKET, ATTACHMENT_TEXT),
          'No classifier in the chain produced a result',
        );
      });
    });

    describe('When the first classifier succeeds and the shadow sample is selected', () => {
      test('Then it also calls the trusted arbiter in the background without affecting the returned result', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.01);
        firstClassifier.classify.mockResolvedValue(FIRST_RESULT);
        arbiterClassifier.classify.mockResolvedValue(ARBITER_RESULT);

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);
        await Promise.resolve();

        expect(result).toEqual(FIRST_RESULT);
        expect(arbiterClassifier.classify).toHaveBeenCalledWith(TICKET, ATTACHMENT_TEXT);
      });
    });
  });
});
