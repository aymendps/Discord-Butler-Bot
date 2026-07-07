import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "1.0.0.1"]);

export default async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URI, { dbName: process.env.DB_NAME });
    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
