import mongoose from "mongoose";
import dns from "node:dns";
import { config } from "../config/index.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectMongo() {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () =>
    console.log("[mongo] connected to Atlas"),
  );
  mongoose.connection.on("error", (err) =>
    console.error("[mongo] connection error:", err.message),
  );
  mongoose.connection.on("disconnected", () =>
    console.warn("[mongo] disconnected"),
  );

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export default mongoose;
