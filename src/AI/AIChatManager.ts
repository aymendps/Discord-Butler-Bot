import { OLLAMA_API } from "../config";
import {
  AIChatConversationResponse,
  AIChatMessage,
  AIChatModel,
  AIChatRequest,
  AIChatResponse,
} from "../interfaces/AIChat";
import axios, { AxiosResponse } from "axios";
import { decode } from "he";
import { bold, Message, MessageCreateOptions, userMention } from "discord.js";

const systemInstructionsPerModel: Map<AIChatModel, string> = new Map([
  [
    "llama3.2:3b",
    "You are Butler Bot, a discord music bot that acts like a human and can chat with users about anything. Be informal and concise. Don't repeat yourself! Finally, users can play music through discord commands like /play",
  ],
  [
    "mistral:7b",
    "You are Butler Bot, a discord music bot that acts like a human and can chat with users about anything. Be informal and concise. Don't repeat yourself! Finally, users can play music through discord commands like /play",
  ],
  [
    "llama3.1:8b",
    "You are Butler Bot, a discord music bot that acts as if it were human and can chat with users about anything. Be informal and concise, but don't overdo slangs. Don't repeat yourself! Finally, users can play music through discord commands like /play",
  ],
  [
    "hf.co/Orenguteng/Llama-3-8B-Lexi-Uncensored-GGUF:Q4_K_M",
    "You are Butler Bot, a discord music bot that acts as if it were human and can chat with users about anything. Be informal and concise. To play music write <bot-play 'search_words'> for each song separately.",
  ],
]);

export class AIChatManager {
  private chatModel: AIChatModel;
  private systemInstructions: string;
  private conversationHistory: Map<string, Array<AIChatMessage>>;
  private conversationHistoryTimeouts: Map<string, NodeJS.Timeout>;
  private userConversations: Map<string, string>;
  private userIDs: Map<string, string>;
  private readonly CHAT_HISTORY_TIMEOUT_MS: number = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.chatModel = "hf.co/Orenguteng/Llama-3-8B-Lexi-Uncensored-GGUF:Q4_K_M";
    this.systemInstructions = systemInstructionsPerModel.get(this.chatModel);
    this.conversationHistory = new Map<string, Array<AIChatMessage>>();
    this.conversationHistoryTimeouts = new Map<string, NodeJS.Timeout>();
    this.userConversations = new Map<string, string>();
    this.userIDs = new Map<string, string>();
    console.log(`Initialized AIChatManager with model ${this.chatModel}`);
  }

  private generateConversationID(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private generateUserMentionsByConversation(conversationID: string): string {
    var mentions = "";
    this.userConversations.forEach((convID, username) => {
      if (convID === conversationID) {
        mentions += userMention(this.userIDs.get(username)) + " ";
      }
    });
    return mentions;
  }

  private createChatHistoryTimeout(
    conversationID: string,
    sendReply: (options: MessageCreateOptions) => Promise<Message<true>>
  ) {
    var timeoutID = setTimeout(() => {
      this.conversationHistory.delete(conversationID);
      this.conversationHistoryTimeouts.delete(conversationID);
      console.log(
        `${Number(
          this.CHAT_HISTORY_TIMEOUT_MS / (1000 * 60)
        )} minutes have passed since last message, deleted history for conversation ${conversationID}`
      );
      sendReply({
        content: `${this.generateUserMentionsByConversation(
          conversationID
        )} Thanks for chatting with me! Our conversation ${bold(
          conversationID
        )} has ended. Feel free to start a new one anytime!`,
      });
    }, this.CHAT_HISTORY_TIMEOUT_MS);
    this.conversationHistoryTimeouts.set(conversationID, timeoutID);
  }

  private addToChatHistory(
    conversationID: string,
    message: AIChatMessage,
    sendReply: (options: MessageCreateOptions) => Promise<Message<true>>
  ): Array<AIChatMessage> {
    if (this.conversationHistory.has(conversationID)) {
      this.conversationHistory.get(conversationID).push(message);

      clearTimeout(this.conversationHistoryTimeouts.get(conversationID));
      this.createChatHistoryTimeout(conversationID, sendReply);
    } else {
      this.conversationHistory.set(conversationID, [
        { role: "system", content: this.systemInstructions },
        message,
      ]);

      this.createChatHistoryTimeout(conversationID, sendReply);
    }

    return this.conversationHistory.get(conversationID);
  }

  private cleanUpMessageContent(content: string): string {
    var cleanChatMessage = content.replace(/<\|im.*$/s, "").trim();
    cleanChatMessage = cleanChatMessage.replace(/<bot-play\s+([^>]+)>/g, "$1");
    cleanChatMessage = decode(cleanChatMessage);
    return cleanChatMessage;
  }

  private extractSongsToPlay(response: string): string[] {
    const matches = [...response.matchAll(/<bot-play\s+([^>]+)>/g)].map(
      (m) => m[1]
    );
    return matches;
  }

  public joinConversation(memberUsername: string, conversationID: string) {
    if (!memberUsername) {
      throw new Error(`Member username is missing: ${memberUsername}`);
    }

    if (!conversationID || !this.conversationHistory.has(conversationID)) {
      throw new Error(`Invalid conversation ID: ${conversationID}`);
    }

    this.userConversations.set(memberUsername, conversationID);
  }

  public leaveConversation(memberUsername: string): [boolean, string] {
    if (!memberUsername) {
      throw new Error(`Member username is missing: ${memberUsername}`);
    }

    const conversationID = this.userConversations.get(memberUsername);
    const result = this.userConversations.delete(memberUsername);

    return [result, conversationID];
  }

  public async generateChatResponse(
    memberUsername: string,
    memberID: string,
    prompt: string,
    sendReply: (options: MessageCreateOptions) => Promise<Message<true>>
  ): Promise<AIChatConversationResponse> {
    if (!memberUsername) {
      throw new Error(`Member username is missing: ${memberUsername}`);
    }

    if (!memberID) {
      throw new Error(`Member ID is missing: ${memberID}`);
    }

    this.userIDs.set(memberUsername, memberID);

    var conversationID = this.userConversations.get(memberUsername);

    // If the user doesn't have an active conversation or the conversation has timed out, create a new one
    if (
      conversationID === undefined ||
      !this.conversationHistory.has(conversationID)
    ) {
      conversationID = this.generateConversationID();
      this.userConversations.set(memberUsername, conversationID);
    }

    const currentChatHistory = this.addToChatHistory(
      conversationID,
      {
        role: "user",
        content: `${memberUsername}: ${prompt}`,
      },
      sendReply
    );

    const chatRequest: AIChatRequest = {
      model: this.chatModel,
      messages: currentChatHistory,
      stream: false,
      keep_alive: "2m",
    };

    // console.log("Requesting AI Chat Response based on:\n", chatRequest);

    const chatResponseJson: AxiosResponse<AIChatResponse> = await axios.post(
      OLLAMA_API,
      chatRequest
    );

    const chatResponseData = chatResponseJson.data;

    console.log("Received AI Chat Response:\n", chatResponseData.message);

    if (chatResponseData) {
      this.addToChatHistory(
        conversationID,
        chatResponseData.message,
        sendReply
      );
      return {
        conversationID: conversationID,
        message: this.cleanUpMessageContent(chatResponseData.message.content),
        songsToPlay: this.extractSongsToPlay(chatResponseData.message.content),
      };
    } else {
      throw new Error(`Invalid Response Data: ${chatResponseData}`);
    }
  }
}
