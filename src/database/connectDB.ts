import mongoose from "mongoose";
import dns from "node:dns";
import { BotLockModel } from "./models/botLock.model";

dns.setServers(["1.1.1.1", "1.0.0.1"]);

let heartbeatTimer: NodeJS.Timeout;
let instanceId: string;

export default async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URI, { dbName: process.env.DB_NAME });

    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - parseInt(process.env.DB_BOTLOCK_STALE_MS)
    );

    const botLock = await BotLockModel.findOne({
      lockId: process.env.DB_BOTLOCK_ID,
    });

    if (botLock) {
      console.log(
        `\nBotLock: Time since last heartbeat in seconds: ${(
          (now.getTime() - botLock.lastHeartbeat.getTime()) /
          1000
        ).toFixed(2)} seconds`
      );

      // if bot lock is stale, allow connecting and update the heartbeat, otherwise exit the process
      if (botLock.lastHeartbeat < staleThreshold) {
        console.log(
          "BotLock: lock is stale, updating heartbeat and continuing..."
        );

        instanceId = crypto.randomUUID();
        botLock.instanceId = instanceId;
        botLock.lastHeartbeat = new Date();
        await botLock.save();
        console.log("Connected to MongoDB successfully!");
      } else {
        console.log(
          "BotLock: Another instance of the bot is already running. Exiting..."
        );
        process.exit(1);
      }
    } else {
      console.log(
        "\nBotLock: No existing lock found, creating a new lock and continuing..."
      );

      instanceId = crypto.randomUUID();
      const newBotLock = new BotLockModel({
        lockId: process.env.DB_BOTLOCK_ID,
        instanceId: instanceId,
        lastHeartbeat: new Date(),
      });
      await newBotLock.save();
      console.log("Connected to MongoDB successfully!");
    }
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

export async function startBotLockHeartbeat() {
  const heartbeatInterval = parseInt(process.env.DB_BOTLOCK_HEARTBEAT_MS);

  heartbeatTimer = setInterval(async () => {
    try {
      const botLock = await BotLockModel.findOne({
        lockId: process.env.DB_BOTLOCK_ID,
        instanceId: instanceId,
      });
      if (botLock) {
        botLock.lastHeartbeat = new Date();
        await botLock.save();
      }
    } catch (error) {
      console.error("Error updating bot lock heartbeat:", error);
    }
  }, heartbeatInterval);

  process.on("SIGTERM", async () => {
    await releaseBotLock();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await releaseBotLock();
    process.exit(0);
  });

  process.on("exit", async () => {
    await releaseBotLock();
    process.exit(0);
  });
}

export async function releaseBotLock() {
  try {
    clearInterval(heartbeatTimer);
    const result = await BotLockModel.deleteOne({
      lockId: process.env.DB_BOTLOCK_ID,
      instanceId: instanceId,
    });

    if (result.deletedCount === 1) {
      console.log("BotLock: lock was released successfully.");
    } else {
      console.log("BotLock: no lock found to release.");
    }
  } catch (error) {
    console.error("Error releasing bot lock:", error);
  }
}
