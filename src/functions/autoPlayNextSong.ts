import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { Song, SongQueue } from "../interfaces/song";
import { EmbedBuilder, GuildMember } from "discord.js";
import { suggestSong } from "./suggestSong";
import { executeAddSong } from "./addSong";
import { getVoiceConnection } from "@discordjs/voice";

export const addSongIfShouldAutoPlayNext = async (
  currentSong: Song,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  if (songQueue.shouldAutoPlayNext()) {
    const suggestedSongs = await suggestSong(currentSong.url, songQueue);

    let lastResortSong: Song = null;

    for (const song of suggestedSongs) {
      if (!song || songQueue.isInMostRecentSongsCache(song)) continue;
      if (
        song.title.toLowerCase().includes("extended") ||
        song.title.toLowerCase().includes("live") ||
        Number(song.duration) >= 5400
      ) {
        if (!lastResortSong) lastResortSong = song;
        continue;
      }
      executeAddSong(song.url, songQueue, sendReplyFunction, null, true);
      return;
    }

    if (lastResortSong) {
      executeAddSong(
        lastResortSong.url,
        songQueue,
        sendReplyFunction,
        null,
        true
      );
      return;
    }
  }
};

export const executeAutoPlayNextSong = async (
  member: GuildMember,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  const enabled = songQueue.toggleAutoPlay();

  if (enabled) {
    await sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Autoplay Mode Enabled")
          .setDescription(
            "Butler Bot will now automatically find and play the next song when the queue is almost empty."
          )
          .setColor("DarkBlue"),
      ],
    });
  } else {
    await sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Autoplay Mode Disabled")
          .setDescription(
            "Butler Bot will no longer automatically find and play the next song."
          )
          .setColor("DarkBlue"),
      ],
    });
  }

  if (songQueue.isEmpty() && songQueue.getCurrent()) {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return;

    const connection = getVoiceConnection(voiceChannel.guild.id);
    if (!connection) return;

    await addSongIfShouldAutoPlayNext(
      songQueue.getCurrent(),
      songQueue,
      sendReplyFunction
    );
  }
};
