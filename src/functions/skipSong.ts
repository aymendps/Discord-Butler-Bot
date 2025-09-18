import { AudioPlayer } from "@discordjs/voice";
import { ChannelType, Client, EmbedBuilder, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { SongQueue } from "../interfaces/song";
import { executeStopSong } from "./stopSong";

export const skipSong = (audioPlayer: AudioPlayer, songQueue: SongQueue) => {
  songQueue.justSkipped = true;
  songQueue.justSeeked = false;
  const status = audioPlayer.stop(true);
  return status;
};

export const executeSkipSong = async (
  client: Client,
  member: GuildMember,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (
      !member.guild.channels.cache.some(
        (channel) =>
          channel.type === ChannelType.GuildVoice &&
          channel.members.has(client.user.id)
      )
    ) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("I am not in a voice channel!")
            .setDescription("I was not requested to start playing music yet")
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    if (songQueue.isEmpty() && !songQueue.isLoopingEnabled) {
      executeStopSong(
        client,
        member,
        songQueue,
        audioPlayer,
        sendReplyFunction
      );
      return;
    }

    const song = songQueue.getCurrent();

    await sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Skipping " + song.title)
          .setURL(song.url)
          .setDescription(
            "This song was skipped by " +
              (member.nickname || member.user.username)
          )
          .setThumbnail(song.thumbnail_url)
          .setColor("DarkBlue"),
      ],
    });

    skipSong(audioPlayer, songQueue);
  } catch (error) {
    console.log(error);
  }
};
