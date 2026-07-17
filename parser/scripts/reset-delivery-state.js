import 'dotenv/config';
import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI must be set to reset parser delivery state');
}

const databaseName = process.env.MONGO_DB || new URL(mongoUri).pathname.replace(/^\/+/, '') || 'future_in_action_scraper';
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const collection = client.db(databaseName).collection('scraped_items');
  const result = await collection.deleteMany({});
  console.log(`Cleared parser delivery state: ${databaseName}.scraped_items (${result.deletedCount} item(s))`);
} finally {
  await client.close();
}
