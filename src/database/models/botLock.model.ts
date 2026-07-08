import { model, Schema, type InferSchemaType } from "mongoose";

const BotLockSchema = new Schema(
  {
    lockId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    instanceId: {
      type: String,
      required: true,
      trim: true,
    },
    lastHeartbeat: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

export type DbBotLock = InferSchemaType<typeof BotLockSchema>;

export const BotLockModel = model("BotLock", BotLockSchema);
