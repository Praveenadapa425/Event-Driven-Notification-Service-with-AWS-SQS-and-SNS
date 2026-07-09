const { processMessage } = require("../consumer_service/app/consumer");

describe("Consumer Service Logic Tests", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("should successfully process and log a valid SQS message containing an SNS wrapped payload", async () => {
    const payload = {
      eventType: "USER_REGISTERED",
      recipient: "user@example.com",
      data: { name: "Alice" }
    };

    const mockSqsMessage = {
      Body: JSON.stringify({
        Type: "Notification",
        MessageId: "mock-message-id",
        Message: JSON.stringify(payload)
      }),
      ReceiptHandle: "mock-receipt-handle"
    };

    await expect(processMessage(mockSqsMessage)).resolves.not.toThrow();
    expect(logSpy).toHaveBeenCalledWith(
      "Processing event 'USER_REGISTERED' for 'user@example.com' with data: {\"name\":\"Alice\"}"
    );
  });

  it("should successfully process and log a valid SQS message with direct body (no SNS wrapping)", async () => {
    const payload = {
      eventType: "ORDER_PLACED",
      recipient: "customer@example.com",
      data: { orderId: "12345" }
    };

    const mockSqsMessage = {
      Body: JSON.stringify(payload),
      ReceiptHandle: "mock-receipt-handle"
    };

    await expect(processMessage(mockSqsMessage)).resolves.not.toThrow();
    expect(logSpy).toHaveBeenCalledWith(
      "Processing event 'ORDER_PLACED' for 'customer@example.com' with data: {\"orderId\":\"12345\"}"
    );
  });

  it("should throw an error and fail to process if required fields are missing", async () => {
    const invalidPayload = {
      eventType: "USER_REGISTERED",
      // recipient is missing
      data: { name: "Alice" }
    };

    const mockSqsMessage = {
      Body: JSON.stringify(invalidPayload),
      ReceiptHandle: "mock-receipt-handle"
    };

    await expect(processMessage(mockSqsMessage)).rejects.toThrow(
      "Missing required event fields in message payload"
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should throw an error if JSON body is malformed", async () => {
    const mockSqsMessage = {
      Body: "invalid-json",
      ReceiptHandle: "mock-receipt-handle"
    };

    await expect(processMessage(mockSqsMessage)).rejects.toThrow(SyntaxError);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
