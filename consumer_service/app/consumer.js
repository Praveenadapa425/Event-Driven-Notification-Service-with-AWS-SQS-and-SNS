require("dotenv").config();
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");

const sqsConfig = {
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
      sqsConfig.endpoint = urlObj.origin;
    }
  } catch (err) {
    // Ignore URL parsing errors
  }
}

const sqsClient = new SQSClient(sqsConfig);

async function processMessage(message) {
  const sqsBody = JSON.parse(message.Body);
  let payload;
  if (sqsBody.Message) {
    payload = JSON.parse(sqsBody.Message);
  } else {
    payload = sqsBody;
  }

  const { eventType, recipient, data } = payload;
  if (!eventType || !recipient || data === undefined) {
    throw new Error("Missing required event fields in message payload");
  }

  console.log(`Processing event '${eventType}' for '${recipient}' with data: ${JSON.stringify(data)}`);
}

async function pollMessages() {
  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    console.error("SQS_QUEUE_URL environment variable is not defined");
    return;
  }

  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Enables Long Polling
    });

    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      for (const message of response.Messages) {
        try {
          await processMessage(message);

          // Explicit Deletion ON SUCCESS ONLY
          const deleteCommand = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          });
          await sqsClient.send(deleteCommand);
        } catch (err) {
          // If processing fails, DO NOT DELETE.
          console.error(`Failed to process message: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Error receiving messages from SQS:", err.message);
    // Delay to avoid hammering CPU on continuous network/auth failures
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

let polling = false;
async function start() {
  polling = true;
  console.log("Consumer worker started, polling SQS queue...");
  while (polling) {
    await pollMessages();
  }
}

function stop() {
  polling = false;
}

module.exports = {
  sqsClient,
  processMessage,
  pollMessages,
  start,
  stop,
};
