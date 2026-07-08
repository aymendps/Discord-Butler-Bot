import { Client, EmbedBuilder, GuildMember } from "discord.js";
import { Song, SongQueue } from "../interfaces/song";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import fs = require("fs");
import path = require("path");
import { FavoriteListModel, UserModel } from "../database/models";

export const addToFavorites = async (
  client: Client,
  member: GuildMember,
  song: Song
) => {
  try {
    const user = await UserModel.findOne({
      username: member.user.username,
    });

    if (!user) {
      console.log(
        `User ${member.user.username} not found in the database. Creating a new user entry.`
      );
      const newUser = new UserModel({
        username: member.user.username,
      });
      await newUser.save();

      const newFavoriteList = new FavoriteListModel({
        user: newUser._id,
        songs: [song],
      });
      await newFavoriteList.save();
      console.log(
        `Added ${song.title} to ${member.user.username}'s favorites successfully.`
      );

      return true;
    } else {
      const favoriteList = await FavoriteListModel.findOne({
        user: user._id,
      });

      if (!favoriteList) {
        console.log(
          `Favorite list for user ${member.user.username} not found. Creating a new favorite list entry.`
        );
        const newFavoriteList = new FavoriteListModel({
          user: user._id,
          songs: [song],
        });
        await newFavoriteList.save();
        console.log(
          `Added ${song.title} to ${member.user.username}'s favorites successfully.`
        );
        return true;
      } else {
        const isSongAlreadyInFavorites = favoriteList.songs.some(
          (favoriteSong) => favoriteSong.url === song.url
        );
        if (!isSongAlreadyInFavorites) {
          favoriteList.songs.push(song);
          await favoriteList.save();
          console.log(
            `Added ${song.title} to ${member.user.username}'s favorites successfully.`
          );
          return true;
        } else {
          console.log(
            `${song.title} is already in ${member.user.username}'s favorites.`
          );
          return true;
        }
      }
    }
  } catch (error) {
    console.log(error);
    return false;
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
