import { Song, SongQueue } from "../interfaces/song";
import fs = require("fs");
import path = require("path");
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import play from "play-dl";
import { EmbedBuilder } from "discord.js";
import { sanitizePlaylistID } from "./utils";
import * as ytdl from "@distube/ytdl-core";
import { ytdlAgent } from "../main";

const addToPlaylist = async (playlistID: string, song: Song) => {
  try {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    const file = fs.readFileSync(
      path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
      "utf-8"
    );
    const playlist: Song[] = JSON.parse(file);
    console.log(
      `playlist data was found for ${cleanPlaylistID}\nadding song to playlist..`
    );
    if (playlist.find((s) => s.url === song.url)) {
      console.log("song is already in playlist!");
    } else {
      playlist.push(song);
      fs.writeFileSync(
        path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
        JSON.stringify(playlist, null, 2),
        "utf-8"
      );
      console.log("song was added to playlist successfully!");
    }
    return true;
  } catch (error) {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    if (error.code === "ENOENT") {
      console.log(
        `playlist data does not exist for ${cleanPlaylistID}\ncreating new data..`
      );
      const playlist: Song[] = [song];
      fs.writeFileSync(
        path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
        JSON.stringify(playlist, null, 2),
        "utf-8"
      );
      console.log("playlist data was created successfully!");
      return true;
    } else {
      console.log("Error reading JSON file:", error.message);
      return false;
    }
  }
};

const addManyToPlaylist = async (playlistID: string, songs: Song[]) => {
  try {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    const file = fs.readFileSync(
      path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
      "utf-8"
    );
    const playlist: Song[] = JSON.parse(file);
    console.log(
      `playlist data was found for ${cleanPlaylistID}\nadding yt_playlist to playlist..`
    );

    const existingSongs = new Map<string, boolean>();
    playlist.forEach((song) => existingSongs.set(song.url, true));

    songs.forEach((song) => {
      if (!existingSongs.has(song.url)) {
        playlist.push(song);
        existingSongs.set(song.url, true);
      }
    });

    fs.writeFileSync(
      path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
      JSON.stringify(playlist, null, 2),
      "utf-8"
    );
    console.log("yt_playlist was added to playlist successfully!");
    return true;
  } catch (error) {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    if (error.code === "ENOENT") {
      console.log(
        `playlist data does not exist for ${cleanPlaylistID}\ncreating new data..`
      );
      fs.writeFileSync(
        path.join(__dirname, `../../.data/playlistID-${cleanPlaylistID}.data`),
        JSON.stringify(songs, null, 2),
        "utf-8"
      );
      console.log("playlist data was created successfully!");
      return true;
    } else {
      console.log("Error reading JSON file:", error.message);
      return false;
    }
  }
};

export const executeAddToPlaylist = async (
  playlistID: string,
  songID: string,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (!playlistID) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Playlist ID is missing!")
            .setDescription("Please provide a playlist ID to add the song to.")
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    if (!songID) {
      const currentSong = songQueue.getCurrent();
      if (currentSong) {
        await addToPlaylist(playlistID, currentSong);
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `Added song to playlist ${sanitizePlaylistID(playlistID)}!`
              )
              .setDescription(
                `The song ${
                  currentSong.title
                } was added to the playlist ${sanitizePlaylistID(
                  playlistID
                )} successfully!`
              )
              .setColor("DarkBlue"),
          ],
        });
      } else {
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle("Song ID is missing!")
              .setDescription(
                "Please provide a song name/url to add to the playlist."
              )
              .setColor("DarkGold"),
          ],
        });
      }
    } else {
      let toAdd: Song | Song[];
      const songIDType = play.yt_validate(songID);
      if (songIDType === "video") {
        // const results = await play.video_basic_info(songID);
        const results = await ytdl.getBasicInfo(songID, { agent: ytdlAgent });
        toAdd = {
          title: results.videoDetails.title,
          url: results.videoDetails.video_url,
          thumbnail_url: results.videoDetails.thumbnails[0].url,
          duration: Number(results.videoDetails.lengthSeconds),
          seek: 0,
          isYoutubeBased: true,
        };
        await addToPlaylist(playlistID, toAdd);
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `Added song to playlist ${sanitizePlaylistID(playlistID)}!`
              )
              .setDescription(
                `The song ${
                  toAdd.title
                } was added to the playlist ${sanitizePlaylistID(
                  playlistID
                )} successfully!`
              )
              .setColor("DarkBlue"),
          ],
        });
      } else if (songIDType === "playlist") {
        const result = await play.playlist_info(songID);
        const allSongsInResult = await result.all_videos();
        toAdd = allSongsInResult.map((song) => ({
          title: song.title,
          url: song.url,
          thumbnail_url: song.thumbnails[0].url,
          duration: song.durationInSec,
          seek: 0,
          isYoutubeBased: true,
        }));
        await addManyToPlaylist(playlistID, toAdd);
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `Added ${result.title} to playlist ${sanitizePlaylistID(
                  playlistID
                )}!`
              )
              .setDescription(
                `All the songs in the playlist ${
                  result.title
                } were added to the playlist ${sanitizePlaylistID(
                  playlistID
                )} successfully!`
              )
              .setColor("DarkBlue"),
          ],
        });
      } else {
        const results = await play.search(songID, { limit: 1 });
        toAdd = {
          title: results[0].title,
          url: results[0].url,
          thumbnail_url: results[0].thumbnails[0].url,
          duration: results[0].durationInSec,
          seek: 0,
          isYoutubeBased: true,
        };
        await addToPlaylist(playlistID, toAdd);
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `Added song to playlist ${sanitizePlaylistID(playlistID)}!`
              )
              .setDescription(
                `The song ${
                  toAdd.title
                } was added to the playlist ${sanitizePlaylistID(
                  playlistID
                )} successfully!`
              )
              .setColor("DarkBlue"),
          ],
        });
      }
    }
  } catch (error) {
    console.log(error);
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Could not add the song to the playlist!")
          .setDescription(
            "Something went wrong while adding the song to the playlist."
          )
          .setColor("DarkRed"),
      ],
    });
  }
};
