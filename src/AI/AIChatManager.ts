import { OLLAMA_API } from "../config";
import {
  AIChatConversationResponse,
  AIChatMessage,
  AIChatModel,
  AIChatRequest,
  AIChatResponse,
} from "../interfaces/AIChat";
import axios, { AxiosResponse } from "axios";

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
    "You are Butler Bot, a discord music bot that acts as if it were human and can chat with users about anything. Be informal and concise. Don't repeat yourself. Finally, users can play music through discord commands like /play",
  ],
]);

export class AIChatManager {
  private chatModel: AIChatModel;
  private systemInstructions: string;
  private conversationHistory: Map<string, Array<AIChatMessage>>;
  private conversationHistoryTimeouts: Map<string, NodeJS.Timeout>;
  private userConversations: Map<string, string>;
  private readonly CHAT_HISTORY_TIMEOUT_MS: number = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.chatModel = "hf.co/Orenguteng/Llama-3-8B-Lexi-Uncensored-GGUF:Q4_K_M";
    this.systemInstructions = systemInstructionsPerModel.get(this.chatModel);
    this.conversationHistory = new Map<string, Array<AIChatMessage>>();
    this.conversationHistoryTimeouts = new Map<string, NodeJS.Timeout>();
    this.userConversations = new Map<string, string>();
    console.log(`Initialized AIChatManager with model ${this.chatModel}`);
  }

  private generateConversationID(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private createChatHistoryTimeout(conversationID: string) {
    var timeoutID = setTimeout(() => {
      this.conversationHistory.delete(conversationID);
      this.conversationHistoryTimeouts.delete(conversationID);
      console.log(
        `${Number(
          this.CHAT_HISTORY_TIMEOUT_MS / (1000 * 60)
        )} minutes have passed since last message, deleted history for conversation ${conversationID}`
      );
    }, this.CHAT_HISTORY_TIMEOUT_MS);
    this.conversationHistoryTimeouts.set(conversationID, timeoutID);
  }

  private addToChatHistory(
    conversationID: string,
    message: AIChatMessage
  ): Array<AIChatMessage> {
    if (this.conversationHistory.has(conversationID)) {
      this.conversationHistory.get(conversationID).push(message);

      clearTimeout(this.conversationHistoryTimeouts.get(conversationID));
      this.createChatHistoryTimeout(conversationID);
    } else {
      this.conversationHistory.set(conversationID, [
        { role: "system", content: this.systemInstructions },
        message,
      ]);

      this.createChatHistoryTimeout(conversationID);
    }

    return this.conversationHistory.get(conversationID);
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
    prompt: string
  ): Promise<AIChatConversationResponse> {
    if (!memberUsername) {
      throw new Error(`Member username is missing: ${memberUsername}`);
    }

    var conversationID = this.userConversations.get(memberUsername);

    // If the user doesn't have an active conversation or the conversation has timed out, create a new one
    if (
      conversationID === undefined ||
      !this.conversationHistory.has(conversationID)
    ) {
      conversationID = this.generateConversationID();
      this.userConversations.set(memberUsername, conversationID);
    }

    const currentChatHistory = this.addToChatHistory(conversationID, {
      role: "user",
      content: `${memberUsername}: ${prompt}`,
    });

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

    // console.log("Received AI Chat Response:\n", chatResponseData.message);

    if (chatResponseData) {
      this.addToChatHistory(conversationID, chatResponseData.message);
      return {
        conversationID: conversationID,
        message: chatResponseData.message.content,
      };
    } else {
      throw new Error(`Invalid Response Data: ${chatResponseData}`);
    }
  }
}
