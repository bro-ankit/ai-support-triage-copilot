import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MCP_SERVER } from '../../src/mcp/mcp.constants';
import { McpController } from '../../src/mcp/mcp.controller';

const mockTransport = { handleRequest: jest.fn() };
const mockTransportConstructor = jest.fn((_options: unknown) => mockTransport);

jest.mock('@modelcontextprotocol/node', () => ({
  // Must be a real (non-arrow) function: the controller calls this with `new`, and arrow
  // functions can never be used as constructors. Explicitly returning mockTransport makes
  // JS's `new` semantics yield that object regardless of the implicit `this`.
  NodeStreamableHTTPServerTransport: function (options: unknown) {
    return mockTransportConstructor(options);
  },
}));

describe('McpController Test', () => {
  let app: INestApplication;
  const mockMcpServer = { connect: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [{ provide: MCP_SERVER, useValue: mockMcpServer }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransportConstructor.mockReturnValue(mockTransport);
  });

  describe('Given POST /mcp endpoint', () => {
    describe('When called with a JSON-RPC body', () => {
      test('Then it builds a stateless transport, connects the shared McpServer to it, forwards the request body, and returns what the transport writes', async () => {
        const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
        mockTransport.handleRequest.mockImplementation((_req, res) => {
          res.status(200).json({ jsonrpc: '2.0', id: 1, result: { tools: [] } });
        });

        const response = await request(app.getHttpServer()).post('/mcp').send(body).expect(200);

        expect(mockTransportConstructor).toHaveBeenCalledWith({ sessionIdGenerator: undefined });
        expect(mockMcpServer.connect).toHaveBeenCalledWith(mockTransport);
        const [forwardedReq, , forwardedBody] = mockTransport.handleRequest.mock.calls[0];
        expect(forwardedReq.body).toEqual(body);
        expect(forwardedBody).toEqual(body);
        expect(response.body).toEqual({ jsonrpc: '2.0', id: 1, result: { tools: [] } });
      });
    });
  });

  describe('Given two separate POST /mcp requests', () => {
    describe('When each is handled', () => {
      test('Then a fresh transport is built per request, not shared across requests', async () => {
        mockTransport.handleRequest.mockImplementation((_req, res) => res.status(200).json({}));

        await request(app.getHttpServer()).post('/mcp').send({ jsonrpc: '2.0', method: 'tools/list' });
        await request(app.getHttpServer()).post('/mcp').send({ jsonrpc: '2.0', method: 'tools/list' });

        expect(mockTransportConstructor).toHaveBeenCalledTimes(2);
      });
    });
  });
});
