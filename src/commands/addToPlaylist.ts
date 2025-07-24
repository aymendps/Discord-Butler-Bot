import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeAddToPlaylist } from "../functions/addToPlaylist";

export const AddToPlaylistCommand: Command = {
  name: "playlist-add",
  description:
    "Add a song to a playlist. If no song is specified, it adds the current song instead.",
  options: [
    {
      name: "playlist",
      description: "ID of the playlist",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "song",
      description:
        "Tag another member to play from their faves. If empty by default, it plays from your faves",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue
  ) => {
    executeAddToPlaylist(
      interaction.options.get("playlist", true).value as string,
      interaction.options.get("song", false)?.value as string,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
