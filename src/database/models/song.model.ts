import { Schema } from "mongoose";

export const SongSchema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  thumbnail_url: { type: String, required: true },
  duration: { type: Number, required: true },
  seek: { type: Number, required: true },
  isYoutubeBased: { type: Boolean, default: true },
  isFile: { type: Boolean, default: false },
  isLive: { type: Boolean, default: false },
});
