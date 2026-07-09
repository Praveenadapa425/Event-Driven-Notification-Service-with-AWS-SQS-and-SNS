const request = require("supertest");
const { mockClient } = require("aws-sdk-client-mock");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { app, snsClient } = require("../publisher_service/app/app");

const snsMock = mockClient(snsClient);

describe("Publisher Service API Tests", () => {
  beforeEach(() => {
    snsMock.reset();
  });

  describe("POST /events validation", () => {
    it("should return 400 Bad Request when eventType is missing", async () => {
      const res = await request(app)
        .post("/events")
        .send({
          recipient: "user@example.com",
          data: { name: "Alice" }
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.details).toContain('"eventType" is required');
    });

    it("should return 400 Bad Request when recipient is missing", async () => {
      const res = await request(app)
        .post("/events")
        .send({
          eventType: "USER_REGISTERED",
          data: { name: "Alice" }
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.details).toContain('"recipient" is required');
    });

    it("should return 400 Bad Request when data is missing", async () => {
      const res = await request(app)
        .post("/events")
        .send({
          eventType: "USER_REGISTERED",
          recipient: "user@example.com"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.details).toContain('"data" is required');
    });

    it("should return 400 Bad Request when data is not an object", async () => {
      const res = await request(app)
        .post("/events")
        .send({
          eventType: "USER_REGISTERED",
          recipient: "user@example.com",
          data: "invalid_data"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.details).toContain('"data" must be of type object');
    });
  });

  describe("POST /events publishing", () => {
    it("should return 202 Accepted and publish to SNS on valid payload", async () => {
      snsMock.on(PublishCommand).resolves({ MessageId: "mock-message-id" });

      const payload = {
        eventType: "USER_REGISTERED",
        recipient: "user@example.com",
        data: { name: "Alice" }
      };

      const res = await request(app)
        .post("/events")
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.message).toBe("Event accepted for processing");
      
      const snsCalls = snsMock.calls();
      expect(snsCalls.length).toBe(1);
      expect(snsCalls[0].args[0].input).toEqual({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: JSON.stringify(payload)
      });
    });

    it("should return 500 Internal Server Error when SNS publish fails", async () => {
      snsMock.on(PublishCommand).rejects(new Error("SNS publish failed"));

      const payload = {
        eventType: "USER_REGISTERED",
        recipient: "user@example.com",
        data: { name: "Alice" }
      };

      const res = await request(app)
        .post("/events")
        .send(payload);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal server error");
    });
  });

  describe("GET /health", () => {
    it("should return 200 OK", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "OK" });
    });
  });
});
