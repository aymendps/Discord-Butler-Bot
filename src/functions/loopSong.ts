import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { Song, SongQueue } from "../interfaces/song";
import { EmbedBuilder } from "discord.js";

export const executeLoopSong = async (
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  const status = songQueue.nextLoopingMode();

  const getLoopingDescription = (
    isLooping: "None" | "One" | "All",
    loopedSong: Song
  ) => {
    if (isLooping === "None") {
      return "Playing the songs in the queue with the normal behaviour";
    }

    if (isLooping === "One") {
      return loopedSong
        ? `Playing the song "${loopedSong.title}" as long as loop mode is set to 'One'`
        : "Add a song to the queue to play it as long as loop mode is set to 'One'";
    }

    if (isLooping === "All") {
      return "Playing all the songs in the queue repeatedly as long as loop mode is set to 'All'";
    }
  };

  await sendReplyFunction({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Loop Mode is ${status.isLooping.toString()}`)
        .setDescription(
          getLoopingDescription(status.isLooping, status.loopedSong)
        )
        .setColor("DarkBlue"),
    ],
  });
};
