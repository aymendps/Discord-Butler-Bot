import { Client, EmbedBuilder, GuildMember } from "discord.js";
import { Song, SongQueue } from "../interfaces/song";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import fs = require("fs");
import path = require("path");

export const addToFavorites = async (
  client: Client,
  member: GuildMember,
  song: Song
) => {
  try {
    const file = fs.readFileSync(
      path.join(__dirname, `../../.data/${member.user.username}.data`),
      "utf-8"
    );
    const faves: Song[] = JSON.parse(file);
    console.log(
      `faves data was found for ${member.user.username}\nadding song to faves..`
    );
    if (faves.find((s) => s.url === song.url)) {
      console.log("song is already in faves!");
    } else {
      faves.push(song);
      fs.writeFileSync(
        path.join(__dirname, `../../.data/${member.user.username}.data`),
        JSON.stringify(faves, null, 2),
        "utf-8"
      );
      console.log("song was added to faves successfully!");
    }
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        `faves data does not exist for ${member.user.username}\ncreating new data..`
      );
      const faves: Song[] = [song];
      fs.writeFileSync(
        path.join(__dirname, `../../.data/${member.user.username}.data`),
        JSON.stringify(faves, null, 2),
        "utf-8"
      );
      console.log("faves data was created successfully!");
      return true;
    } else {
      console.log("Error reading JSON file:", error.message);
      return false;
    }
  }
};

export const executeAddToFavorites = async (
  client: Client,
  member: GuildMember,
  songQueue: SongQueue,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const currentSong = songQueue.getCurrent();
    if (currentSong) {
      const added = await addToFavorites(client, member, currentSong);
      if (!added) {
        throw "Song was not added to favorites";
      } else {
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${currentSong.title} was added to your faves!`)
              .setDescription(
                `Successfully added the song to ${member.nickname}'s faves! Use the command 'faves' to see more!`
              )
              .setThumbnail(currentSong.thumbnail_url)
              .setColor("DarkGreen"),
          ],
        });
      }
    } else {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("There is no song that's playing currently!")
            .setDescription(
              "Play a song first, then use this command to add it to your faves!"
            )
            .setColor("DarkGold"),
        ],
      });
    }
  } catch (error) {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Something went wrong")
          .setDescription("Could not add or play the request song...")
          .setColor("DarkRed"),
      ],
    });
  }
};

export const executeAddSpecificToFavorites = async (
  client: Client,
  member: GuildMember,
  song: Song,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const added = await addToFavorites(client, member, song);
    if (!added) {
      throw "Song was not added to favorites";
    } else {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${song.title} was added to your faves!`)
            .setDescription(
              `Successfully added the song to ${member.nickname}'s faves! Use the command 'faves' to see more!`
            )
            .setThumbnail(song.thumbnail_url)
            .setColor("DarkGreen"),
        ],
      });
    }
  } catch (error) {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Something went wrong")
          .setDescription("Could not add or play the request song...")
          .setColor("DarkRed"),
      ],
    });
  }
};
