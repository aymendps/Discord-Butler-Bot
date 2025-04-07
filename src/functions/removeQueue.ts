import { EmbedBuilder } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { SongQueue } from "../interfaces/song";

export const executeRemoveQueue = async (
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (songQueue.isEmpty()) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("The queue is already empty!")
            .setDescription(
              "Add some songs to the queue using the `play` or `add` command"
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    songQueue.removeAll();

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("The queue has been cleared!")
          .setDescription(
            "Add new songs to the queue using the `play` or `add` command"
          )
          .setColor("DarkBlue"),
      ],
    });
  } catch (error) {
    console.log(error);
  }
};
