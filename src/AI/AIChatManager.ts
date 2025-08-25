import { OLLAMA_API } from "../config";
import {
  AIChatMessage,
  AIChatModel,
  AIChatRequest,
  AIChatResponse,
} from "../interfaces/AIChat";
import axios, { AxiosResponse } from "axios";

const systemInstructionsPerModel: Map<AIChatModel, string> = new Map([
  [
    "llama3.2:3b",
    "You are Butler Bot, a discord music bot that acts like a human and can chat with users about anything. Be informal and concise. Don't repeat yourself! Finally, users can play music through discord commands like /play!",
  ],
  [
    "mistral:7b",
    "You are Butler Bot, a discord music bot that acts like a human and can chat with users about anything. Be informal and concise. Don't repeat yourself! Finally, users can play music through discord commands like /play!",
  ],
  [
    "llama3.1:8b",
    "You are Butler Bot, a discord music bot that acts as if it were human and can chat with users about anything. Be informal and concise, but don't overdo slangs. Don't repeat yourself! Finally, users can play music through discord commands like /play!",
  ],
]);

export class AIChatManager {
  private chatModel: AIChatModel;
  private systemInstructions: string;
  private chatHistory: Map<string, Array<AIChatMessage>>;
  private chatHistoryTimeouts: Map<string, NodeJS.Timeout>;
  private readonly CHAT_HISTORY_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.chatModel = "llama3.1:8b";
    this.systemInstructions = systemInstructionsPerModel.get(this.chatModel);
    this.chatHistory = new Map<string, Array<AIChatMessage>>();
    this.chatHistoryTimeouts = new Map<string, NodeJS.Timeout>();
    console.log(`Initialized AIChatManager with model ${this.chatModel}`);
  }

  private createChatHistoryTimeout(memberUsername: string) {
    var timeoutID = setTimeout(() => {
      this.chatHistory.delete(memberUsername);
      this.chatHistoryTimeouts.delete(memberUsername);
      console.log(
        `${Number(
          this.CHAT_HISTORY_TIMEOUT_MS / (1000 * 60)
        )} minutes have passed since last chat, deleted history for ${memberUsername}`
      );
    }, this.CHAT_HISTORY_TIMEOUT_MS);
    this.chatHistoryTimeouts.set(memberUsername, timeoutID);
  }

  private addToChatHistory(
    memberUsername: string,
    message: AIChatMessage
  ): Array<AIChatMessage> {
    if (this.chatHistory.has(memberUsername)) {
      this.chatHistory.get(memberUsername).push(message);

      clearTimeout(this.chatHistoryTimeouts.get(memberUsername));
      this.createChatHistoryTimeout(memberUsername);
    } else {
      this.chatHistory.set(memberUsername, [
        { role: "system", content: this.systemInstructions },
        message,
      ]);

      this.createChatHistoryTimeout(memberUsername);
    }

    return this.chatHistory.get(memberUsername);
  }

  public clearChatHistory(memberUsername: string): boolean {
    if (this.chatHistory.has(memberUsername)) {
      clearTimeout(this.chatHistoryTimeouts.get(memberUsername));
      this.chatHistory.delete(memberUsername);
      this.chatHistoryTimeouts.delete(memberUsername);
      console.log(`Cleared chat history for ${memberUsername} through command`);
      return true;
    }
    return false;
  }

  public async generateChatResponse(
    memberUsername: string,
    prompt: string
  ): Promise<AIChatResponse> {
    if (!memberUsername) {
      throw new Error(`Member username is missing: ${memberUsername}`);
    }

    const currentChatHistory = this.addToChatHistory(memberUsername, {
      role: "user",
      content: prompt,
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

    // console.log("Received AI Chat Response:\n", chatResponseData);

    if (chatResponseData) {
      this.addToChatHistory(memberUsername, chatResponseData.message);
      return chatResponseData;
    } else {
      throw new Error(`Invalid Response Data: ${chatResponseData}`);
    }
  }
}
