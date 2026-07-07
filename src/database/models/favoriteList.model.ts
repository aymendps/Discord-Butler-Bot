import { model, Schema, type InferSchemaType } from "mongoose";
import { SongSchema } from "./song.model";

const FavoriteListSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    songs: { type: [SongSchema], default: [] },
  },
  { timestamps: true }
);

export type DbFavoriteList = InferSchemaType<typeof FavoriteListSchema>;

export const FavoriteListModel = model("FavoriteList", FavoriteListSchema);
