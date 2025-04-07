import { APIEmbedField, EmbedBuilder } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import * as fs from "node:fs/promises";
import path = require("path");

const viewAllPlaylists = async (): Promise<string[]> => {
  try {
    const dataFolder = await fs.readdir(path.join(__dirname, "../../.data"));
    const playlistIDs = dataFolder
      .filter(
        (file) => file.startsWith("playlistID-") && file.endsWith(".data")
      )
      .map((file) => file.replace("playlistID-", "").replace(".data", ""));
    return playlistIDs;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const executeViewPlaylistAll = async (
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const playlistIDs = await viewAllPlaylists();

    if (playlistIDs.length === 0) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Playlists Found!")
            .setDescription(
              "There are no playlists created yet. Create one with the `playlist-add` command."
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    const playlistFields: APIEmbedField[] = playlistIDs.map((id, index) => {
      return {
        name: `Playlist #${index + 1}:`,
        value: `${id}`,
        inline: false,
      };
    });

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("All Playlists")
          .setDescription("The playlists are sorted in alphabetical order.")
          .addFields(...playlistFields)
          .setColor("DarkBlue"),
      ],
    });
  } catch (error) {
    console.log(error);
  }
};
