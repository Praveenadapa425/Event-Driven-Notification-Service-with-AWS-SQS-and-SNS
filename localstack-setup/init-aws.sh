#!/bin/sh

echo "Initializing LocalStack resources..."

# Create SQS Queue
awslocal sqs create-queue --queue-name notification-queue

# Create SNS Topic
awslocal sns create-topic --name notification-events

# Subscribe SQS Queue to SNS Topic
awslocal sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:000000000000:notification-events \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:notification-queue

echo "LocalStack resources initialized successfully."
