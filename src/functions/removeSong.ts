import { EmbedBuilder, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { Song, SongQueue } from "../interfaces/song";

export const executeRemoveSong = async (
  member: GuildMember,
  songQueue: SongQueue,
  songIndex: string,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (songQueue.isEmpty()) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("The queue is already empty!")
            .setDescription(
              "There is no song that I could remove, " + member.nickname
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    let removedSong: Song;

    if (songIndex && !isNaN(parseInt(songIndex))) {
      removedSong = songQueue.removeAt(parseInt(songIndex) - 1);
    } else {
      removedSong = songQueue.removeLast();
    }

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Removed ${removedSong.title} from the queue`)
          .setDescription(
            `There are ${songQueue.length()} other songs remaining in the queue`
          )
          .setThumbnail(removedSong.thumbnail_url)
          .setColor("DarkBlue"),
      ],
    });
  } catch (error) {
    console.log(error);
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Something went wrong")
          .setDescription("Could not remove songs from the queue...")
          .setColor("DarkRed"),
      ],
    });
  }
};
