/**
 * GET /api/openapi.json
 *
 * Serves a minimal OpenAPI 3.1 specification for the Atlas engine API.
 * This is the machine-readable contract for tool integrations and agent
 * clients that need to call the engine endpoints.
 */

export const onRequestGet: PagesFunction = async () => {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Atlas Engine API',
      version: '1.0.0',
      description:
        'Authenticated API for the Atlas heating recommendation engine. ' +
        'Submit a normalised survey payload and receive a full engine result ' +
        'including red flags, hydraulic analysis, lifestyle simulation, and ' +
        'system recommendations.',
    },
    paths: {
      '/api/run-engine': {
        post: {
          summary: 'Run the Atlas engine for a normalised survey payload',
          operationId: 'runEngine',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EngineInput',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Full engine result',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/EngineResult',
                  },
                },
              },
            },
            '400': {
              description: 'Invalid JSON body',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: { error: 'invalid_json' },
                },
              },
            },
            '401': {
              description: 'Missing or invalid bearer token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: { error: 'unauthorized' },
                },
              },
            },
            '500': {
              description: 'Engine threw an exception',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/EngineErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/run-engine-debug': {
        post: {
          summary: 'Run the Atlas engine and return a structured debug view',
          operationId: 'runEngineDebug',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EngineInput',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Debug view: key module summary plus full result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      summary: {
                        type: 'object',
                        description:
                          'Decision-relevant module outputs for quick inspection',
                        properties: {
                          redFlags: { type: 'object' },
                          hydraulic: { type: 'object' },
                          lifestyle: { type: 'object' },
                        },
                      },
                      full: { $ref: '#/components/schemas/EngineResult' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid JSON body',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '401': {
              description: 'Missing or invalid bearer token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '500': {
              description: 'Engine threw an exception',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/EngineErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Set ATLAS_AGENT_TOKEN as a Cloudflare secret. Pass it as: Authorization: Bearer <token>',
        },
      },
      schemas: {
        EngineInput: {
          type: 'object',
          description: 'EngineInputV2_3 survey payload',
          required: ['postcode', 'dynamicMainsPressure'],
          properties: {
            postcode: {
              type: 'string',
              description: 'UK postcode for the property',
              example: 'SW1A 1AA',
            },
            dynamicMainsPressure: {
              type: 'number',
              description: 'Mains dynamic pressure in bar',
              example: 2.5,
            },
          },
          additionalProperties: true,
        },
        EngineResult: {
          type: 'object',
          description: 'Full FullEngineResult from the Atlas engine',
          additionalProperties: true,
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        EngineErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'engine_failed' },
            message: { type: 'string' },
          },
        },
      },
    },
  };

  return new Response(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
