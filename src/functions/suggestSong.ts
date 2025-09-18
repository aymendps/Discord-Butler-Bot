import { ButtonStyle, EmbedBuilder } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { Song, SongQueue } from "../interfaces/song";
import play from "play-dl";
import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageActionRowComponentBuilder,
} from "@discordjs/builders";
import * as ytdl from "@distube/ytdl-core";
import { getInnertubeAgent, ytdlAgent } from "../main";
import { YTNodes } from "youtubei.js";

const SUGGEST_MAX_SONGS = 10;

export const suggestSong = async (
  nameArg: string,
  songQueue: SongQueue
): Promise<Song[]> => {
  try {
    const agent = await getInnertubeAgent();

    let searchQuery: string;

    if (!nameArg) {
      const current = songQueue.getCurrent();
      if (!current) {
        return new Array<Song>();
      }
      searchQuery = current.url;
    } else {
      searchQuery = nameArg;
    }

    let songUrl: string;

    if (play.yt_validate(searchQuery) !== "video") {
      const songInfo = await play.search(searchQuery, { limit: 1 });
      songUrl = songInfo[0].url;
    } else {
      songUrl = searchQuery;
    }

    const regex = /(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([^&#]+)/;
    const match = songUrl.match(regex);
    const id = match ? match[1] : null;

    if (!id) {
      return new Array<Song>();
    }

    const video = await agent.getInfo(id);

    const relatedVideos = video.watch_next_feed;

    const suggestedSongs = new Array<Song>();

    for (const video of relatedVideos) {
      if (video.type === "LockupView") {
        const lockup = video.as(YTNodes.LockupView);
        if (lockup) {
          if (lockup.content_id && lockup.content_id.length <= 11) {
            suggestedSongs.push({
              title: lockup.metadata.title.toString(),
              url: `https://www.youtube.com/watch?v=${lockup.content_id}`,
              thumbnail_url: `https://img.youtube.com/vi/${lockup.content_id}/0.jpg`,
              duration: -1,
              seek: 0,
              isYoutubeBased: true,
            });
          }
        }
      }
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
    let suggestedSongs = await suggestSong(nameArg, songQueue);
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
      if (suggestedSongs.length > SUGGEST_MAX_SONGS) {
        suggestedSongs = suggestedSongs.slice(0, SUGGEST_MAX_SONGS);
      }

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

        // search again because cached info might be unreliable depending on executed method, like duration wont be set correctly for example
        const songInfo = await ytdl.getBasicInfo(song.url, {
          agent: ytdlAgent,
        });

        const verifiedSong: Song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          thumbnail_url: songInfo.videoDetails.thumbnails[0].url,
          duration: Number(songInfo.videoDetails.lengthSeconds),
          seek: 0,
          isYoutubeBased: true,
        };

        songQueue.push(verifiedSong);

        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(verifiedSong.title)
              .setURL(verifiedSong.url)
              .setDescription(
                "Added " +
                  verifiedSong.title +
                  " to the queue: #" +
                  songQueue.length()
              )
              .setThumbnail(verifiedSong.thumbnail_url)
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
