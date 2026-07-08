import { Song, SongQueue } from "../interfaces/song";
import fs = require("fs");
import path = require("path");
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import play from "play-dl";
import { EmbedBuilder } from "discord.js";
import { sanitizePlaylistID } from "./utils";
import * as ytdl from "@distube/ytdl-core";
import { getInnertubeAgent, ytdlAgent } from "../main";
import { YTNodes } from "youtubei.js";
import { PlaylistModel } from "../database/models";

const addToPlaylist = async (playlistID: string, song: Song) => {
  try {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    const playlist = await PlaylistModel.findOne({
      playlistName: cleanPlaylistID,
    });
    if (!playlist) {
      console.log(
        `Playlist data does not exist for ${cleanPlaylistID}. Creating new data..`
      );
      const newPlaylist = new PlaylistModel({
        playlistName: cleanPlaylistID,
        songs: [song],
      });
      await newPlaylist.save();
      console.log(
        `Added ${song.title} to playlist ${cleanPlaylistID} successfully.`
      );
      return true;
    } else {
      const isSongAlreadyInPlaylist = playlist.songs.some(
        (playlistSong) => playlistSong.url === song.url
      );
      if (!isSongAlreadyInPlaylist) {
        playlist.songs.push(song);
        await playlist.save();
        console.log(
          `Added ${song.title} to playlist ${cleanPlaylistID} successfully.`
        );
        return true;
      } else {
        console.log(
          `Song ${song.title} is already in playlist ${cleanPlaylistID}.`
        );
        return true;
      }
    }
  } catch (error) {
    console.log(error);
    return false;
  }
};

const addManyToPlaylist = async (playlistID: string, songs: Song[]) => {
  try {
    const cleanPlaylistID = sanitizePlaylistID(playlistID);
    const playlist = await PlaylistModel.findOne({
      playlistName: cleanPlaylistID,
    });
    if (!playlist) {
      console.log(
        `Playlist data does not exist for ${cleanPlaylistID}. Creating new data..`
      );
      const newPlaylist = new PlaylistModel({
        playlistName: cleanPlaylistID,
        songs: songs,
      });
      await newPlaylist.save();
      console.log(
        `Added ${songs.length} songs to playlist ${cleanPlaylistID} successfully.`
      );
      return true;
    } else {
      const newSongsToAdd = songs.filter(
        (song) =>
          !playlist.songs.some((playlistSong) => playlistSong.url === song.url)
      );
      if (newSongsToAdd.length > 0) {
        playlist.songs.push(...newSongsToAdd);
        await playlist.save();
        console.log(
          `Added ${newSongsToAdd.length} songs to playlist ${cleanPlaylistID} successfully.`
        );
        return true;
      } else {
        console.log(`All songs are already in playlist ${cleanPlaylistID}.`);
        return true;
      }
    }
  } catch (error: any) {
    console.log(error);
    return false;
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
        const ytAgent = await getInnertubeAgent();
        const search = await ytAgent.search(songID, { type: "video" });
        const songInfo = search.results
          .filter((r) => r.is(YTNodes.Video))[0]
          .as(YTNodes.Video);

        const toAdd: Song = {
          title: songInfo.title.toString(),
          url: `https://www.youtube.com/watch?v=${songInfo.video_id}`,
          thumbnail_url: songInfo.thumbnails[0].url,
          duration: songInfo.duration.seconds,
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
