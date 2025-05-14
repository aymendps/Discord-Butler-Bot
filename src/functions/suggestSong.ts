import { ButtonStyle, EmbedBuilder } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { Song, SongQueue } from "../interfaces/song";
import play, { InfoData } from "play-dl";
import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageActionRowComponentBuilder,
} from "@discordjs/builders";
import * as ytdl from "@distube/ytdl-core";
import { ytdlAgent } from "../main";

const SUGGEST_MAX_SONGS = 5;

const suggestSong = async (
  nameArg: string,
  songQueue: SongQueue
): Promise<Song[]> => {
  try {
    let songInfo: ytdl.videoInfo;

    if (!nameArg) {
      const current = songQueue.getCurrent();
      if (!current) {
        return new Array<Song>();
      }
      // songInfo = await play.video_basic_info(current.url);
      songInfo = await ytdl.getBasicInfo(current.url, { agent: ytdlAgent });
    } else {
      const results = await play.search(nameArg, { limit: 1 });
      // songInfo = await play.video_basic_info(results[0].url);
      songInfo = await ytdl.getBasicInfo(results[0].url, { agent: ytdlAgent });
    }

    if (songInfo.related_videos.length > SUGGEST_MAX_SONGS) {
      songInfo.related_videos = songInfo.related_videos.slice(
        0,
        SUGGEST_MAX_SONGS
      );
    }

    const suggestedSongs = new Array<Song>();

    for (let index = 0; index < songInfo.related_videos.length; index++) {
      const relatedSong = songInfo.related_videos[index];
      // const info = await play.video_basic_info(songUrl);
      // const info = await ytdl.getBasicInfo(
      //   `https://www.youtube.com/watch?v=${songUrl.id}`,
      //   { agent: ytdlAgent }
      // );
      suggestedSongs.push({
        title: relatedSong.title,
        url: `https://www.youtube.com/watch?v=${relatedSong.id}`,
        thumbnail_url: relatedSong.thumbnails[0].url,
        duration: Number(relatedSong.length_seconds),
        seek: 0,
        isYoutubeBased: true,
      });
    }

    return suggestedSongs;
  } catch (error) {
    console.log(error);
    return new Array<Song>();
  }
};

export const executeSuggestSong = async (
  nameArg: string,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const suggestedSongs = await suggestSong(nameArg, songQueue);
    if (suggestedSongs.length === 0) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Couldn't suggest any related songs")
            .setDescription(
              "Check if there is a currently playing song or if the song name you provided is correct"
            )
            .setColor("DarkRed"),
        ],
      });
    } else {
      const resultsEmbed = suggestedSongs.map((song, index) => {
        return new EmbedBuilder()
          .setTitle(`Suggested Result #${index + 1}`)
          .setDescription(`[${song.title}](${song.url})`)
          .setThumbnail(song.thumbnail_url)
          .setColor("DarkGreen");
      });

      const buttons = suggestedSongs.map((song, index) =>
        new ButtonBuilder()
          .setLabel(`Queue #${index + 1}`)
          .setStyle(ButtonStyle.Primary)
          .setCustomId(`queue-song-with-index-${index}`)
      );

      let buttonsActionRow = new Array<
        ActionRowBuilder<MessageActionRowComponentBuilder>
      >();

      // Split the buttons into groups of 5
      for (let i = 0; i < buttons.length; i += 5) {
        buttonsActionRow.push(
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            buttons.slice(i, i + 5)
          )
        );
      }

      const response = await sendReplyFunction({
        embeds: resultsEmbed,
        components: buttonsActionRow,
      });

      const collector = response.createMessageComponentCollector({
        time: 60000,
      });

      collector.on("collect", async (confirmation) => {
        const index = parseInt(
          confirmation.customId.replace("queue-song-with-index-", "")
        );

        const song = suggestedSongs[index];
        songQueue.push(song);

        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(song.title)
              .setURL(song.url)
              .setDescription(
                "Added " + song.title + " to the queue: #" + songQueue.length()
              )
              .setThumbnail(song.thumbnail_url)
              .setColor("DarkGreen"),
          ],
        });

        confirmation.deferUpdate();
      });
    }
  } catch (error) {
    console.log(error);
  }
};
