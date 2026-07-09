const consumer = require("./consumer");

consumer.start().catch((err) => {
  console.error("Fatal error in consumer worker:", err);
  process.exit(1);
});
