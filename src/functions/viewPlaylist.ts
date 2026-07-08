import { APIEmbedField, EmbedBuilder } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { sanitizePlaylistID } from "./utils";
import fs = require("fs");
import path = require("path");
import { Song } from "../interfaces/song";
import { PlaylistModel } from "../database/models";

export const getPlaylist = async (playlistID: string): Promise<Song[]> => {
  try {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    const playlist = await PlaylistModel.findOne({
      playlistName: cleanPlaylistID,
    });
    if (!playlist) {
      console.log(`Playlist data does not exist for ${cleanPlaylistID}`);
      return null;
    }
    console.log(`Successfully retrieved playlist data for ${cleanPlaylistID}`);
    return playlist.songs;
  } catch (error: any) {
    console.log(error);
    return null;
  }
};

export const executeViewPlaylist = async (
  playlistID: string,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (!playlistID) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Playlist ID is missing!")
            .setDescription(
              "Please provide a playlist ID to view the playlist."
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    const playlist = await getPlaylist(playlistID);

    if (!playlist) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Playlist was not found!")
            .setDescription(
              "The provided playlist ID does not exist. View all playlists with `playlist-view-all`"
            )
            .setColor("DarkRed"),
        ],
      });
      return;
    }

    if (playlist.length === 0) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Playlist is empty!")
            .setDescription(
              "There are no songs in the playlist. Add some songs with `playlist-add`"
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    let songFields: APIEmbedField[] = new Array<APIEmbedField>();

    if (playlist.length > 20) {
      const firstTenSongs = playlist.slice(0, 10);
      const lastTenSongs = playlist.slice(-10);
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
            name: `Song #${playlist.length - 10 + index + 1}:`,
            value: `[${song.title}](${song.url})`,
            inline: false,
          };
        })
      );
    } else {
      songFields = playlist.map((song, index) => {
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
          .setTitle(
            `Playlist: ${sanitizePlaylistID(playlistID)} - ${
              playlist.length
            } Songs`
          )
          .setDescription("The songs are listed in order of play")
          .addFields(...songFields)
          .setColor("DarkBlue"),
      ],
    });
  } catch (error) {
    console.log(error);
  }
};
