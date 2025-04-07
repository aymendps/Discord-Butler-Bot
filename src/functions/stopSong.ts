import { AudioPlayer } from "@discordjs/voice";
import { ChannelType, Client, EmbedBuilder, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { SongQueue } from "../interfaces/song";
import { skipSong } from "./skipSong";

export const executeStopSong = async (
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

    await sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Taking a break..")
          .setDescription("Playing music was stopped by " + member.nickname)
          .setColor("DarkBlue"),
      ],
    });

    songQueue.reset();
    skipSong(audioPlayer, songQueue);
  } catch (error) {
    console.log(error);
  }
};
