import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
  GuildMember,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { AudioPlayer } from "@discordjs/voice";
import { AIChatManager } from "../AI/AIChatManager";
import { executeAIChatJoinConversation } from "../AI/AIChatJoinConversation";

export const AIChatJoinConversationCommand: Command = {
  name: "ai-join-convo",
  description: "Join an ongoing conversation with Butler Bot's AI using its id",
  options: [
    {
      name: "convo",
      description: "The ID of the conversation to join",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer,
    AIChatManagerInstance: AIChatManager
  ) => {
    executeAIChatJoinConversation(
      interaction.member as GuildMember,
      interaction.options.get("convo", true).value as string,
      AIChatManagerInstance,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
