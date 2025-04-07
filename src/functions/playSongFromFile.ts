import { Attachment, Client, EmbedBuilder, GuildMember } from "discord.js";
import { Song, SongQueue } from "../interfaces/song";
import { AudioPlayer } from "@discordjs/voice";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import fs = require("fs");
import path = require("path");
import { executePlaySong } from "./playSong";

export const executePlaySongFromFile = async (
  client: Client,
  member: GuildMember,
  attachedFile: Attachment,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    if (!attachedFile) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Audio file is missing!")
            .setDescription(
              "Please attach an audio file to play and try again!"
            )
            .setColor("DarkRed"),
        ],
      });
      return;
    }

    if (attachedFile.contentType !== "audio/mpeg") {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Invalid file type!")
            .setDescription("Please attach an audio file and try again!")
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    const song: Song = {
      title: attachedFile.name,
      url: attachedFile.url,
      duration: attachedFile.duration,
      thumbnail_url: "https://cdn-icons-png.flaticon.com/512/4722/4722923.png",
      seek: 0,
      isFile: true,
    };

    executePlaySong(
      client,
      member,
      null,
      songQueue,
      audioPlayer,
      sendReplyFunction,
      song
    );
  } catch (error) {
    console.log(error);
  }
};
