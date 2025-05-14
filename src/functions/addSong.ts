import { EmbedBuilder } from "discord.js";
import { Song, SongQueue } from "../interfaces/song";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import play, { SpotifyAlbum, SpotifyPlaylist, SpotifyTrack } from "play-dl";
import * as ytdl from "@distube/ytdl-core";
import { ytdlAgent } from "../main";

const checkForTimeStamp = (url: string, songDuration: number) => {
  const index = url.indexOf("t=");

  if (index === -1) return Number(0);

  const seconds = Number(url.substring(index, url.length).replace(/\D/g, ""));

  if (seconds > Number(songDuration)) {
    return Number(0);
  }

  return seconds;
};

const SUPPORTED_ALT_PLATFORMS = [
  {
    prefix: "x.com",
    title: "Twitter Video",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/b/b7/X_logo.jpg",
  },
  {
    prefix: "twitter.com",
    title: "Twitter Video",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/b/b7/X_logo.jpg",
  },
  {
    prefix: "reddit.com",
    title: "Reddit Video",
    thumbnail:
      "https://upload.wikimedia.org/wikipedia/en/thumb/b/bd/Reddit_Logo_Icon.svg/316px-Reddit_Logo_Icon.svg.png",
  },
  {
    prefix: "facebook.com",
    title: "Facebook Video",
    thumbnail:
      "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/Facebook_f_logo_%282021%29.svg/512px-Facebook_f_logo_%282021%29.svg.png",
  },
  {
    prefix: "fb.watch",
    title: "Facebook Video",
    thumbnail:
      "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/Facebook_f_logo_%282021%29.svg/512px-Facebook_f_logo_%282021%29.svg.png",
  },
  {
    prefix: "twitch.tv",
    title: "Twitch Video",
    thumbnail:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Twitch_Glitch_Logo_Purple.svg/1756px-Twitch_Glitch_Logo_Purple.svg.png",
  },
];

export const addSong = async (
  url: string,
  songQueue: SongQueue,
  useThisRawSongInstead: Song = null
): Promise<Song> => {
  try {
    if (url) {
      console.log("requested song: " + url);

      const altPlatform = SUPPORTED_ALT_PLATFORMS.find(
        (platform) =>
          url.startsWith("https://" + platform.prefix) ||
          url.startsWith("https://www." + platform.prefix)
      );

      if (altPlatform) {
        const song: Song = {
          title: altPlatform.title,
          url: url,
          thumbnail_url: altPlatform.thumbnail,
          duration: 0,
          seek: 0,
          isYoutubeBased: false,
          isFile: false,
        };
        songQueue.push(song);
        return song;
      }

      if (url.startsWith("https") && play.yt_validate(url) === "playlist") {
        const playlist = await play.playlist_info(url);
        const videos = await playlist.all_videos();

        const songs: Song[] = videos.map((v) => {
          return {
            title: v.title,
            url: v.url,
            thumbnail_url: v.thumbnails[0].url,
            duration: v.durationInSec,
            seek: 0,
            isYoutubeBased: true,
          };
        });
        songs.forEach((song) => {
          songQueue.push(song);
        });

        return {
          title: `Playlist - ${playlist.title} - ${songs.length} Songs`,
          url: playlist.url,
          thumbnail_url: playlist.thumbnail
            ? playlist.thumbnail.url
            : songs[0].thumbnail_url,
          duration: songs[0].duration,
          seek: 0,
          isYoutubeBased: true,
        };
      } else if (url.startsWith("https") && play.yt_validate(url) === "video") {
        try {
          // const songInfo = await play.video_info(url);
          const songInfo = await ytdl.getBasicInfo(url, { agent: ytdlAgent });
          const song: Song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            thumbnail_url: songInfo.videoDetails.thumbnails[0].url,
            duration: Number(songInfo.videoDetails.lengthSeconds),
            seek: checkForTimeStamp(
              url,
              Number(songInfo.videoDetails.lengthSeconds)
            ),
            isLive: songInfo.videoDetails.isLive,
            isYoutubeBased: true,
          };
          songQueue.push(song);
          return song;
        } catch (error) {
          const songInfo = await play.search(url, { limit: 1 });
          const song: Song = {
            title: songInfo[0].title,
            url: songInfo[0].url,
            thumbnail_url: songInfo[0].thumbnails[0].url,
            duration: songInfo[0].durationInSec,
            seek: 0,
            isYoutubeBased: true,
          };

          songQueue.push(song);
          return song;
        }
      } else if (url.startsWith("https") && url.includes("spotify")) {
        if (play.is_expired()) {
          await play.refreshToken();
        }

        const songInfo = await play.spotify(url);

        if (songInfo.type === "track") {
          const track = songInfo as SpotifyTrack;
          const song: Song = {
            title: track.artists[0].name + " " + track.name,
            url: track.url,
            thumbnail_url: track.thumbnail.url,
            duration: track.durationInSec,
            seek: 0,
            isYoutubeBased: false,
          };

          songQueue.push(song);
          return {
            title: `Track - ${track.artists[0].name + " | " + track.name}`,
            url: track.url,
            thumbnail_url: track.thumbnail.url,
            duration: track.durationInSec,
            seek: 0,
            isYoutubeBased: false,
          };
        } else if (songInfo.type === "album") {
          const album = songInfo as SpotifyAlbum;
          const albumTracks = await album.all_tracks();

          console.log(albumTracks);

          const songs: Song[] = albumTracks.map((t) => {
            return {
              title: t.artists[0].name + " " + t.name,
              url: t.url,
              thumbnail_url: t.thumbnail
                ? t.thumbnail.url
                : album.thumbnail.url,
              duration: t.durationInSec,
              seek: 0,
              isYoutubeBased: false,
            };
          });

          songs.forEach((song) => {
            songQueue.push(song);
          });
          return {
            title: `Album - ${album.name} - ${songs.length} Tracks`,
            url: album.url,
            thumbnail_url: album.thumbnail.url,
            duration: songs[0].duration,
            seek: 0,
            isYoutubeBased: false,
          };
        } else if (songInfo.type === "playlist") {
          const playlist = songInfo as SpotifyPlaylist;
          const playlistTracks = await playlist.all_tracks();

          const songs: Song[] = playlistTracks.map((t) => {
            return {
              title: t.artists[0].name + " " + t.name,
              url: t.url,
              thumbnail_url: t.thumbnail
                ? t.thumbnail.url
                : playlist.thumbnail.url,
              duration: t.durationInSec,
              seek: 0,
              isYoutubeBased: false,
            };
          });

          songs.forEach((song) => {
            songQueue.push(song);
          });
          return {
            title: `Playlist - ${playlist.name} - ${songs.length} Tracks`,
            url: playlist.url,
            thumbnail_url: playlist.thumbnail.url,
            duration: songs[0].duration,
            seek: 0,
            isYoutubeBased: false,
          };
        }
      } else {
        const songInfo = await play.search(url, { limit: 1 });
        const song: Song = {
          title: songInfo[0].title,
          url: songInfo[0].url,
          thumbnail_url: songInfo[0].thumbnails[0].url,
          duration: songInfo[0].durationInSec,
          seek: 0,
          isYoutubeBased: false,
        };

        songQueue.push(song);
        return song;
      }
    } else if (useThisRawSongInstead) {
      songQueue.push(useThisRawSongInstead);
      return useThisRawSongInstead;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const executeAddSong = async (
  urlArgs: string,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction,
  useThisRawSongInstead: Song = null
) => {
  if (!urlArgs && !useThisRawSongInstead) {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setDescription("Missing song URL. Please try again with a valid URL")
          .setColor("DarkRed"),
      ],
    });
    return;
  }

  let song: Song;

  if (urlArgs) {
    song = await addSong(urlArgs, songQueue);
  } else {
    song = await addSong(null, songQueue, useThisRawSongInstead);
  }

  if (song) {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle(song.title.substring(0, 254))
          .setURL(song.url)
          .setDescription(
            "Added " + song.title + " to the queue: #" + songQueue.length()
          )
          .setThumbnail(song.thumbnail_url)
          .setColor("DarkGreen"),
      ],
    });
  } else {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            "The requested song could not be added / found. Make sure the URL is valid!"
          )
          .setColor("DarkRed"),
      ],
    });
    return;
  }
};
