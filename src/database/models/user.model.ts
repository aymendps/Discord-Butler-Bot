import { model, Schema, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export type DbUser = InferSchemaType<typeof UserSchema>;

export const UserModel = model("User", UserSchema);
