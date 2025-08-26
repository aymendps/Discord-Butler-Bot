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
import { executeAIChatLeaveConversation } from "../AI/AIChatLeaveConversation";

export const AIChatLeaveConversationCommand: Command = {
  name: "ai-leave-convo",
  description: "Leave the current conversation with Butler Bot's AI",
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer,
    AIChatManagerInstance: AIChatManager
  ) => {
    executeAIChatLeaveConversation(
      interaction.member as GuildMember,
      AIChatManagerInstance,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
