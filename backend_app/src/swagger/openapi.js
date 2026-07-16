export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ZhytoMate API",
    version: "1.0.0",
    description: "API docs for auth, users, appeals and surveys.",
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "Auth" },
    { name: "Users" },
    { name: "Appeals" },
    { name: "Surveys" },
    { name: "Contacts" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "6682b15b8c39b424f9adf761" },
          username: { type: "string", example: "nazar_dev" },
          firstName: { type: "string", example: "Nazar" },
          lastName: { type: "string", example: "Dev" },
          email: { type: "string", example: "nazar@example.com" },
          phone: { type: "string", example: "+380 67 123 4567" },
          address: {
            type: "object",
            properties: {
              street: { type: "string", example: "вул. Перемоги" },
              building: { type: "string", example: "10" },
              district: { type: "string", example: "Центр" },
              city: { type: "string", example: "Житомир" },
            },
          },
          preferences: {
            type: "object",
            properties: {
              utilityAlerts: { type: "boolean", example: true },
              cityNews: { type: "boolean", example: true },
            },
          },
          avatarUrl: { type: "string", example: "http://localhost:3000/uploads/avatars/avatar.jpg" },
          role: { type: "string", enum: ["user", "admin"], example: "user" },
        },
      },
      Appeal: {
        type: "object",
        properties: {
          id: { type: "string", example: "6682b15b8c39b424f9adf762" },
          userId: { type: "string", example: "6682b15b8c39b424f9adf761" },
          imageUrl: {
            type: "string",
            example: "https://example.com/images/pothole.jpg",
          },
          description: {
            type: "string",
            example: "Large pothole blocks the right lane.",
          },
          address: { type: "string", example: "Peremohy Square, 4" },
          status: {
            type: "string",
            enum: ["new", "in_progress", "resolved", "rejected"],
            example: "new",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      SurveyOption: {
        type: "object",
        properties: {
          id: { type: "string", example: "6682b15b8c39b424f9adf763" },
          label: { type: "string", example: "Road repairs" },
        },
      },
      Survey: {
        type: "object",
        properties: {
          id: { type: "string", example: "6682b15b8c39b424f9adf764" },
          title: { type: "string", example: "City priority" },
          description: {
            type: "string",
            example: "Choose what the city should improve first.",
          },
          options: {
            type: "array",
            items: { $ref: "#/components/schemas/SurveyOption" },
          },
          startsAt: { type: "string", nullable: true, format: "date-time" },
          endsAt: { type: "string", nullable: true, format: "date-time" },
          isActive: { type: "boolean", example: true },
          isOpen: { type: "boolean", example: true },
          selectedOptionId: {
            type: "string",
            nullable: true,
            example: "6682b15b8c39b424f9adf763",
          },
          completed: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      SurveyProgress: {
        type: "object",
        properties: {
          total: { type: "number", example: 3 },
          answered: { type: "number", example: 2 },
          pending: { type: "number", example: 1 },
          percent: { type: "number", example: 67 },
        },
      },
      SurveyVote: {
        type: "object",
        properties: {
          id: { type: "string", example: "6682b15b8c39b424f9adf765" },
          surveyId: { type: "string", example: "6682b15b8c39b424f9adf764" },
          userId: { type: "string", example: "6682b15b8c39b424f9adf761" },
          optionId: { type: "string", example: "6682b15b8c39b424f9adf763" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "username",
                  "firstName",
                  "lastName",
                  "email",
                  "password",
                ],
                properties: {
                  username: { type: "string", example: "nazar_dev" },
                  firstName: { type: "string", example: "Nazar" },
                  lastName: { type: "string", example: "Dev" },
                  email: { type: "string", example: "nazar@example.com" },
                  password: { type: "string", example: "password123" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Registered (always role: user)" },
          400: { description: "Validation error" },
          409: { description: "Duplicate user" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["login", "password"],
                properties: {
                  login: { type: "string", example: "nazar_dev" },
                  password: { type: "string", example: "password123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "New access token" },
          401: { description: "Invalid refresh token" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Current user" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Current user profile",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Current user profile" } },
      },
    },
    "/users/me/name": {
      patch: {
        tags: ["Users"],
        summary: "Update current user name",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstName", "lastName"],
                properties: {
                  firstName: { type: "string", example: "Nazar" },
                  lastName: { type: "string", example: "Developer" },
                  phone: { type: "string", example: "+380 67 123 4567" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Updated user" } },
      },
    },
    "/users/me/preferences": {
      patch: {
        tags: ["Users"],
        summary: "Update current user notification preferences",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["utilityAlerts", "cityNews"],
                properties: {
                  utilityAlerts: { type: "boolean", example: true },
                  cityNews: { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Updated user" } },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "User by id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "User" },
          404: { description: "User not found" },
        },
      },
    },
    "/appeals": {
      get: {
        tags: ["Appeals"],
        summary: "List all appeals (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["new", "in_progress", "resolved", "rejected"],
            },
          },
          {
            name: "category",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          200: { description: "Paginated appeals { items, total, page, limit }" },
          403: { description: "Admin access is required" },
        },
      },
      post: {
        tags: ["Appeals"],
        summary: "Create appeal",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["imageUrl", "description", "address"],
                properties: {
                  imageUrl: {
                    type: "string",
                    example: "https://example.com/images/pothole.jpg",
                  },
                  description: {
                    type: "string",
                    example: "Large pothole blocks the right lane.",
                  },
                  address: { type: "string", example: "Peremohy Square, 4" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created appeal" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/appeals/me": {
      get: {
        tags: ["Appeals"],
        summary: "My appeal history",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Appeal history" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/appeals/{id}": {
      get: {
        tags: ["Appeals"],
        summary: "Appeal details",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Appeal details" },
          404: { description: "Appeal not found" },
        },
      },
      patch: {
        tags: ["Appeals"],
        summary: "Respond / change status (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  status: {
                    type: "string",
                    enum: ["new", "in_progress", "resolved", "rejected"],
                  },
                  response: {
                    type: "string",
                    example: "Звернення прийнято в роботу.",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated appeal" },
          403: { description: "Admin access is required" },
          404: { description: "Appeal not found" },
        },
      },
    },
    "/surveys": {
      get: {
        tags: ["Surveys"],
        summary: "Survey history",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Survey list with completion state" },
        },
      },
      post: {
        tags: ["Surveys"],
        summary: "Create survey as admin",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "options"],
                properties: {
                  title: { type: "string", example: "City priority" },
                  description: {
                    type: "string",
                    example: "Choose the next improvement area.",
                  },
                  options: {
                    type: "array",
                    minItems: 2,
                    items: { type: "string" },
                    example: ["Road repairs", "Parks", "Public transport"],
                  },
                  startsAt: {
                    type: "string",
                    nullable: true,
                    format: "date-time",
                  },
                  endsAt: {
                    type: "string",
                    nullable: true,
                    format: "date-time",
                  },
                  isActive: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created survey" },
          403: { description: "Admin access is required" },
        },
      },
    },
    "/surveys/progress": {
      get: {
        tags: ["Surveys"],
        summary: "My survey progress",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Survey progress" } },
      },
    },
    "/surveys/{id}": {
      get: {
        tags: ["Surveys"],
        summary: "Survey details",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Survey details" },
          404: { description: "Survey not found" },
        },
      },
      patch: {
        tags: ["Surveys"],
        summary: "Edit / close / reopen survey (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  options: {
                    type: "array",
                    minItems: 2,
                    items: { type: "string" },
                    description: "Only honored while the survey has no votes.",
                  },
                  startsAt: { type: "string", nullable: true, format: "date-time" },
                  endsAt: { type: "string", nullable: true, format: "date-time" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated survey" },
          400: { description: "Cannot change options after votes / invalid window" },
          403: { description: "Admin access is required" },
          404: { description: "Survey not found" },
        },
      },
      delete: {
        tags: ["Surveys"],
        summary: "Delete survey and its votes (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Deleted { id }" },
          403: { description: "Admin access is required" },
          404: { description: "Survey not found" },
        },
      },
    },
    "/surveys/{id}/vote": {
      post: {
        tags: ["Surveys"],
        summary: "Vote in survey",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["optionId"],
                properties: {
                  optionId: {
                    type: "string",
                    example: "6682b15b8c39b424f9adf763",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Vote saved" },
          400: { description: "Invalid option or closed survey" },
          404: { description: "Survey not found" },
        },
      },
    },
    "/users/me/address": {
      patch: {
        tags: ["Users"],
        summary: "Update address (verified + normalized via Nominatim)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string", example: "14, к.1.2,3, вулиця Вільський Шлях, Житомир" },
                  suggestionId: { type: "string", example: "way:1222200052" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "Updated user; address includes verified/lat/lon/formatted",
          },
        },
      },
    },
    "/users/me/address/preview": {
      post: {
        tags: ["Users"],
        summary: "Verify/normalize an address without saving",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string" },
                  suggestionId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "{ address: { street, building, district, city, verified, lat, lon, formatted } }",
          },
        },
      },
    },
    "/contacts": {
      get: {
        tags: ["Contacts"],
        summary: "City contacts grouped for the Contacts tab",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description:
              "{ emergency: [...], groups: [{ group, items: [...] }] }",
          },
        },
      },
      post: {
        tags: ["Contacts"],
        summary: "Create contact (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "phone"],
                properties: {
                  name: { type: "string", example: "Водоканал" },
                  phone: { type: "string", example: "0412 24-08-10" },
                  icon: { type: "string", example: "water_drop" },
                  group: { type: "string", example: "Комунальні служби" },
                  kind: {
                    type: "string",
                    enum: ["emergency", "utility"],
                    example: "utility",
                  },
                  order: { type: "integer", example: 0 },
                  isActive: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created contact" },
          403: { description: "Admin access is required" },
        },
      },
    },
    "/contacts/admin": {
      get: {
        tags: ["Contacts"],
        summary: "Flat list of all contacts (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "{ contacts: [...] }" },
          403: { description: "Admin access is required" },
        },
      },
    },
    "/contacts/{id}": {
      patch: {
        tags: ["Contacts"],
        summary: "Update contact (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  name: { type: "string" },
                  phone: { type: "string" },
                  icon: { type: "string" },
                  group: { type: "string" },
                  kind: { type: "string", enum: ["emergency", "utility"] },
                  order: { type: "integer" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated contact" },
          403: { description: "Admin access is required" },
          404: { description: "Contact not found" },
        },
      },
      delete: {
        tags: ["Contacts"],
        summary: "Delete contact (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Deleted { id }" },
          403: { description: "Admin access is required" },
          404: { description: "Contact not found" },
        },
      },
    },
  },
};

export default openApiSpec;
