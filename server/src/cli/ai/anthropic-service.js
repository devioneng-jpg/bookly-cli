import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, generateObject } from 'ai';
import { config } from '../../config/anthropic.config.js';
import chalk from 'chalk';

export class AIService {
  constructor() {
    if (!config.claudeApiKey) {
      throw new Error('CLAUDE_ANTHROPIC_API_KEY is not set in env!');
    }

    const provider = createAnthropic({ apiKey: config.claudeApiKey });
    this.model = provider(config.model);
  }

  /**
   * Send a message and get streaming response
   * @param {Array} messages
   * @param {Function} onChunk
   * @param {Object} tools
   * @param {Function} onToolCall
   * @returns {Promise<Object>}
   */
  async sendMessage(messages, onChunk, tools = undefined, onToolCall = null, system = undefined) {
    try {
      const streamConfig = {
        model: this.model,
        messages: messages,
      };

      if (system) {
        streamConfig.system = system;
      }

      if (tools && Object.keys(tools).length > 0) {
        streamConfig.tools = tools;
        streamConfig.maxSteps = 5;
      }

      const result = streamText(streamConfig);

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const fullResult = await result;
      const toolCalls = [];
      const toolResults = [];

      if (fullResult.steps && Array.isArray(fullResult.steps)) {
        for (const step of fullResult.steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              toolCalls.push(toolCall);
              if (onToolCall) {
                onToolCall(toolCall);
              }
            }
          }
          if (step.toolResults && step.toolResults.length > 0) {
            toolResults.push(...step.toolResults);
          }
        }
      }

      return {
        content: fullResponse,
        finishReason: fullResult.finishReason,
        usage: fullResult.usage,
        toolCalls,
        toolResults,
        steps: fullResult.steps,
      };
    } catch (error) {
      console.error(chalk.red('AI Service Error:'), error.message);
      throw error;
    }
  }

  /**
   * Get a non-streaming response
   * @param {Array} messages
   * @param {Object} tools
   * @returns {Promise<string>}
   */
  async getMessage(messages, tools = undefined) {
    const result = await this.sendMessage(
      messages,
      (chunk) => {},
      tools,
    );
    return result.content;
  }

  /**
   * Generate structured output using a Zod schema
   * @param {import('zod').ZodSchema} schema
   * @param {string} prompt
   * @returns {Promise<Object>}
   */
  async generateStructured(schema, prompt) {
    try {
      const result = await generateObject({
        model: this.model,
        schema: schema,
        prompt: prompt,
      });
      return result.object;
    } catch (error) {
      console.error(
        chalk.red('AI Structured Generation Error:'),
        error.message,
      );
      throw error;
    }
  }
}
