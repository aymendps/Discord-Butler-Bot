import {
  CommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeAddSong } from "../functions/addSong";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const AddSongCommand: Command = {
  name: "add",
  description: "Add a song to the queue",
  options: [
    {
      name: "url",
      description: "The URL of the song to be added",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue
  ) => {
    executeAddSong(
      interaction.options.get("url", true).value as string,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
