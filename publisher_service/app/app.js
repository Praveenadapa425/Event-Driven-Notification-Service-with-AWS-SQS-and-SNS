require("dotenv").config();
const express = require("express");
const Joi = require("joi");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const app = express();
app.use(express.json());

// SNS Client configuration
const snsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "placeholder_key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "placeholder_secret",
  },
};

// Auto-configure custom endpoint if LocalStack url is detected
if (process.env.SQS_QUEUE_URL) {
  try {
    const urlObj = new URL(process.env.SQS_QUEUE_URL);
    if (urlObj.hostname.includes("localhost") || urlObj.hostname.includes("localstack") || urlObj.hostname.includes("127.0.0.1")) {
      snsConfig.endpoint = urlObj.origin;
    }
  } catch (err) {
    // Ignore URL parsing errors during test/initialization if not set
  }
}

const snsClient = new SNSClient(snsConfig);

// Schema validation
const eventSchema = Joi.object({
  eventType: Joi.string().required(),
  recipient: Joi.string().required(),
  data: Joi.object().required(),
});

// GET /health
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// POST /events
app.post("/events", async (req, res) => {
  const { error, value } = eventSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: "Validation Error",
      details: error.details.map((d) => d.message),
    });
  }

  try {
    const messageBody = JSON.stringify(value);
    
    const command = new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: messageBody,
    });

    await snsClient.send(command);

    return res.status(202).json({
      message: "Event accepted for processing",
    });
  } catch (err) {
    console.error("SNS Publish Error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = { app, snsClient };
