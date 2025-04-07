import { Client, EmbedBuilder, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import fs = require("fs");
import path = require("path");
import { sanitizePlaylistID } from "./utils";
import { Song, SongQueue } from "../interfaces/song";
import { executePlaySong } from "./playSong";
import { AudioPlayer } from "@discordjs/voice";

const getPlaylist = async (playlistID: string) => {
  try {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    const file = fs.readFileSync(
      path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
      "utf-8"
    );
    const playlist: Song[] = JSON.parse(file);
    console.log(`playlist data was found for ${cleanPlaylistID}`);
    return playlist;
  } catch (error) {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    if (error.code === "ENOENT") {
      console.log(`playlist data does not exist for ${cleanPlaylistID}`);
    } else {
      console.log(error);
    }
    return null;
  }
};

export const executePlayPlaylist = async (
  client: Client,
  member: GuildMember,
  playlistID: string,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (!playlistID) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Playlist ID is missing!")
            .setDescription("Please provide a valid playlist ID and try again.")
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
            .setTitle("Playlist not found!")
            .setDescription(
              "The playlist with the given ID was not found. View all created playlists using `playlist-view-all`."
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
              "The playlist with the given ID is empty. Add songs to the playlist using `playlist-add`."
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    playlist.forEach((song) => {
      songQueue.push(song);
    });

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `Playlist ${sanitizePlaylistID(playlistID)} - ${
              playlist.length
            } Songs`
          )
          .setDescription(
            `Added Playlist ${sanitizePlaylistID(playlistID)} - ${
              playlist.length
            } Songs to the queue: #${songQueue.length()}`
          )
          .setColor("DarkGreen"),
      ],
    });

    executePlaySong(
      client,
      member,
      null,
      songQueue,
      audioPlayer,
      sendReplyFunction
    );
  } catch (error) {
    console.log(error);
  }
};
