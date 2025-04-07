import {
  CommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executePlayFavorites } from "../functions/playFavorites";
import { AudioPlayer } from "@discordjs/voice";

export const PlayFavoritesCommand: Command = {
  name: "play-faves",
  description: "Play the songs that were added to your favorites",
  options: [
    {
      name: "number",
      description: "Number of the song in the faves collection",
      type: ApplicationCommandOptionType.String,
    },
    {
      name: "member",
      description:
        "Tag another member to play from their faves. If empty by default, it plays from your faves",
      type: ApplicationCommandOptionType.String,
    },
  ],
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executePlayFavorites(
      client,
      interaction.member as GuildMember,
      interaction.options.get("number")?.value?.toString()?.trim(),
      interaction.options.get("member")?.value?.toString()?.trim(),
      songQueue,
      audioPlayer,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
