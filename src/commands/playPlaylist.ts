import {
  CommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
  GuildMember,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { executePlayPlaylist } from "../functions/playPlaylist";
import { SongQueue } from "../interfaces/song";
import { AudioPlayer } from "@discordjs/voice";

export const PlayPlaylistCommand: Command = {
  name: "playlist",
  description: "Plays the songs in the playlist with the given ID",
  options: [
    {
      name: "id",
      description: "ID of the playlist",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executePlayPlaylist(
      client,
      interaction.member as GuildMember,
      interaction.options.get("id", true).value as string,
      songQueue,
      audioPlayer,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
