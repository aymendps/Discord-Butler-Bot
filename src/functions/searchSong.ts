import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import play from "play-dl";
import { Song, SongQueue } from "../interfaces/song";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";

export const SEARCH_DEFAULT_NUMBER_OF_RESULTS = 5;

const searchSong = async (
  name: string,
  numberOfResults: number
): Promise<Song[]> => {
  try {
    const searchResults = await play.search(name, {
      limit: numberOfResults
        ? numberOfResults
        : SEARCH_DEFAULT_NUMBER_OF_RESULTS,
    });

    if (searchResults) {
      const songs: Song[] = searchResults.map((song) => {
        return {
          title: song.title,
          url: song.url,
          thumbnail_url: song.thumbnails[0].url,
          duration: song.durationInSec,
          seek: 0,
        };
      });

      return songs;
    }

    return new Array<Song>();
  } catch (error) {
    console.log(error);
    return new Array<Song>();
  }
};

export const executeSearchSong = async (
  nameArg: string,
  numberOfResultsArg: number,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const searchResults = await searchSong(nameArg, numberOfResultsArg);

    if (searchResults.length === 0) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("No songs found")
            .setDescription("No songs were found with the given name")
            .setColor("DarkRed"),
        ],
      });
    } else {
      const resultsEmbed = searchResults.map((song, index) => {
        const hours = Math.floor(song.duration / 3600);
        const minutes = Math.floor((song.duration % 3600) / 60);
        const seconds = song.duration % 60;

        return new EmbedBuilder()
          .setTitle(`Search Result #${index + 1}`)
          .setDescription(
            `[${song.title}](${song.url})\nDuration of ${String(hours).padStart(
              2,
              "0"
            )}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
              2,
              "0"
            )}`
          )
          .setThumbnail(song.thumbnail_url)
          .setColor("DarkGreen");
      });

      const buttons = searchResults.map((song, index) =>
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

        const song = searchResults[index];
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
