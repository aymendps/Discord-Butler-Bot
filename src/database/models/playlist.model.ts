import { model, Schema, type InferSchemaType } from "mongoose";
import { SongSchema } from "./song.model";

const PlaylistSchema = new Schema(
  {
    playlistName: { type: String, required: true, unique: true, trim: true },
    songs: { type: [SongSchema], default: [] },
  },
  { timestamps: true }
);

export type DbPlaylist = InferSchemaType<typeof PlaylistSchema>;

export const PlaylistModel = model("Playlist", PlaylistSchema);
