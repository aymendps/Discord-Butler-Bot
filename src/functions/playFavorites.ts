import { Client, EmbedBuilder, GuildMember } from "discord.js";
import { Song, SongQueue } from "../interfaces/song";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import fs = require("fs");
import path = require("path");
import { executePlaySong } from "./playSong";
import { AudioPlayer } from "@discordjs/voice";

export const executePlayFavorites = async (
  client: Client,
  member: GuildMember,
  numberArgs: string,
  memberTagArgs: string,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    let username = member.user.username;
    let nickname = member.nickname;
    let avatarURL = member.avatarURL();

    if (memberTagArgs) {
      const taggedMember = await member.guild.members.fetch(
        memberTagArgs.slice(0, -1).substring(2)
      );
      if (taggedMember) {
        username = taggedMember.user.username;
        nickname = taggedMember.nickname;
        avatarURL = taggedMember.avatarURL();
      }
    }

    const file = fs.readFileSync(
      path.join(__dirname, `../../.data/${username}.data`),
      "utf-8"
    );
    const faves: Song[] = JSON.parse(file);

    if (!isNaN(Number(numberArgs))) {
      if (Number(numberArgs) < faves.length) {
        const songToAdd = faves[Number(numberArgs)];
        songQueue.push(songToAdd);
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle(songToAdd.title)
              .setURL(songToAdd.url)
              .setDescription(
                "Added " +
                  songToAdd.title +
                  " to the queue: #" +
                  songQueue.length()
              )
              .setThumbnail(songToAdd.thumbnail_url)
              .setColor("DarkGreen"),
          ],
        });
        if (!songQueue.getCurrent()) {
          await executePlaySong(
            client,
            member,
            null,
            songQueue,
            audioPlayer,
            sendReplyFunction
          );
        }
      } else {
        sendReplyFunction({
          embeds: [
            new EmbedBuilder()
              .setTitle("No Song That Matches..?")
              .setDescription(
                "You don't have any song that matches that number. Use '/faves' to see them!"
              )
              .setColor("DarkGold"),
          ],
        });
      }
    } else {
      faves.forEach((song) => {
        songQueue.push(song);
      });
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${nickname}'s Faves - ${faves.length} Songs`)
            .setDescription(
              "Added " +
                nickname +
                " favorite songs to the queue: #" +
                songQueue.length()
            )
            .setThumbnail(avatarURL)
            .setColor("DarkGreen"),
        ],
      });
      if (!songQueue.getCurrent()) {
        await executePlaySong(
          client,
          member,
          null,
          songQueue,
          audioPlayer,
          sendReplyFunction
        );
      }
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Favorites..?")
            .setDescription(
              "You don't have any songs that were added to your favorites!"
            )
            .setColor("DarkGold"),
        ],
      });
    } else if (error.code == "50035") {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Invalid Format Or Member Tag!")
            .setDescription(
              "Make sure that your request is written like so: <play-faves number @member"
            )
            .setColor("DarkGold"),
        ],
      });
    } else {
      console.log(error);
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Something went wrong")
            .setDescription("Could not find your faves...")
            .setColor("DarkRed"),
        ],
      });
    }
  }
};
