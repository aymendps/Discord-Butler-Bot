import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { Song, SongQueue, SongQueueAutoPlaySource } from "../interfaces/song";
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
    const source: SongQueueAutoPlaySource =
      songQueue.getAutoPlayMode() === "Youtube Music"
        ? "Youtube Music"
        : "Youtube Normal";

    const suggestedSongs = await suggestSong(
      source === "Youtube Music" ? currentSong.title : currentSong.url,
      source,
      songQueue
    );

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
  const enabled = songQueue.nextAutoPlayMode();

  switch (enabled) {
    case "None":
      await sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Autoplay Mode Disabled")
            .setDescription(
              "Butler Bot will no longer automatically add songs to the queue when it's almost empty."
            )
            .setColor("DarkBlue"),
        ],
      });
      break;
    case "Youtube Music":
      await sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Autoplay Mode Enabled | Youtube Music")
            .setDescription(
              "Butler Bot will now automatically find and play the next song when the queue is almost empty."
            )
            .setColor("DarkBlue"),
        ],
      });
      break;
    case "Youtube Normal":
      await sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Autoplay Mode Enabled | Youtube Normal")
            .setDescription(
              "Butler Bot will now automatically find and play the next song when the queue is almost empty."
            )
            .setColor("DarkBlue"),
        ],
      });
      break;
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
