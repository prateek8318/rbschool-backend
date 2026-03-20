"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerUiOptions = exports.specs = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'RBSchool API Gateway',
            version: '1.0.0',
            description: 'API Gateway for RBSchool management system - Single entry point for all microservices',
            contact: {
                name: 'RBSchool Support',
                email: 'support@rbschool.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:8000',
                description: 'Development server'
            },
            {
                url: 'http://127.0.0.1:8000',
                description: 'Local server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                HealthResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Request success status'
                        },
                        message: {
                            type: 'string',
                            description: 'Response message'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Response timestamp'
                        },
                        uptime: {
                            type: 'number',
                            description: 'Gateway uptime in seconds'
                        },
                        services: {
                            type: 'object',
                            properties: {
                                auth: {
                                    type: 'string',
                                    description: 'Auth service status'
                                },
                                user: {
                                    type: 'string',
                                    description: 'User service status'
                                },
                                academic: {
                                    type: 'string',
                                    description: 'Academic service status'
                                },
                                attendance: {
                                    type: 'string',
                                    description: 'Attendance service status'
                                },
                                fee: {
                                    type: 'string',
                                    description: 'Fee service status'
                                },
                                notification: {
                                    type: 'string',
                                    description: 'Notification service status'
                                },
                                school: {
                                    type: 'string',
                                    description: 'School service status'
                                }
                            }
                        }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        message: {
                            type: 'string',
                            description: 'Error message'
                        },
                        error: {
                            type: 'string',
                            description: 'Detailed error information'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Error timestamp'
                        }
                    }
                },
                ServiceResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Request success status'
                        },
                        message: {
                            type: 'string',
                            description: 'Response message'
                        },
                        data: {
                            type: 'object',
                            description: 'Response data'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Response timestamp'
                        }
                    }
                }
            }
        }
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};
exports.specs = (0, swagger_jsdoc_1.default)(options);
exports.swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'RBSchool API Gateway Documentation'
};
