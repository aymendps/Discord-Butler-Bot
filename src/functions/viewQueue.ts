import { APIEmbedField, EmbedBuilder } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { SongQueue } from "../interfaces/song";

export const executeViewQueue = async (
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (songQueue.isEmpty()) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("The queue is currently empty!")
            .setDescription(
              "Add some songs to the queue using the `play` or `add` command"
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    let songFields: APIEmbedField[] = new Array<APIEmbedField>();

    if (songQueue.length() > 20) {
      const firstTenSongs = songQueue.getAllSongs().slice(0, 10);
      const lastTenSongs = songQueue.getAllSongs().slice(-10);
      songFields.push(
        ...firstTenSongs.map((song, index) => {
          return {
            name: `Song #${index + 1}:`,
            value: `[${song.title}](${song.url})`,
            inline: false,
          };
        })
      );
      songFields.push({
        name: "...",
        value: "...",
        inline: false,
      });
      songFields.push(
        ...lastTenSongs.map((song, index) => {
          return {
            name: `Song #${songQueue.length() - 10 + index + 1}:`,
            value: `[${song.title}](${song.url})`,
            inline: false,
          };
        })
      );
    } else {
      songFields = songQueue.getAllSongs().map((song, index) => {
        return {
          name: `Song #${index + 1}:`,
          value: `[${song.title}](${song.url})`,
          inline: false,
        };
      });
    }

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Current Queue:")
          .setDescription("The songs are listed in order of play")
          .addFields(...songFields)
          .setColor("DarkBlue"),
      ],
    });
  } catch (error) {
    console.log(error);
  }
};
