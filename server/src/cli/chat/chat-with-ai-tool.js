import chalk from 'chalk';
import boxen from 'boxen';
import {
  text,
  isCancel,
  cancel,
  intro,
  outro,
  multiselect,
} from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';
import { AIService } from '../ai/anthropic-service.js';
import { ChatService } from '../../service/chat.service.js';
import {
  availableTools,
  getEnabledTools,
  enableTools,
  getEnabledToolNames,
  resetTools,
} from '../../config/tool.config.js';
import {
  getUserFromToken,
  initConversation,
  saveMessage,
} from './chat-with-ai.js';

const aiService = new AIService();
const chatService = new ChatService();

const TOOL_SYSTEM_PROMPT =
  'You are a friendly customer support agent for Bookly, an online bookstore. You have access to tools that can help you look up orders, process refunds, and search FAQs. Use the available tools when the customer asks about orders, refunds, or common questions. Always be helpful and provide clear answers.';

async function selectTools() {
  const toolOptions = availableTools.map((t) => ({
    value: t.id,
    label: t.name,
    hint: t.description,
  }));

  const selectedTools = await multiselect({
    message: chalk.cyan(
      'Select tools to enable (Space to select, Enter to confirm):',
    ),
    options: toolOptions,
    required: false,
  });

  if (isCancel(selectedTools)) {
    cancel(chalk.yellow('Tool selection cancelled'));
    return false;
  }

  enableTools(selectedTools);

  const enabledNames = getEnabledToolNames();
  if (enabledNames.length > 0) {
    const toolBox = boxen(
      enabledNames.map((name) => chalk.green(`  ${name}`)).join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'green',
        title: 'Enabled Tools',
        titleAlignment: 'center',
      },
    );
    console.log(toolBox);
  } else {
    console.log(
      chalk.yellow('No tools selected — running in basic chat mode.'),
    );
  }

  return true;
}

async function getToolAIResponse(conversationId) {
  const spinner = yoctoSpinner({
    text: 'AI is thinking...',
    color: 'cyan',
  }).start();

  const dbMessages = chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);

  const tools = getEnabledTools();
  let isFirstChunk = true;

  try {
    const result = await aiService.sendMessage(
      aiMessages,
      (chunk) => {
        if (isFirstChunk) {
          spinner.stop();
          console.log('\n');
          console.log(chalk.green.bold('Assistant:'));
          console.log(chalk.gray('-'.repeat(60)));
          isFirstChunk = false;
        }
        process.stdout.write(chunk);
      },
      tools,
      (toolCall) => {
        const toolBox = boxen(
          `${chalk.bold('Tool')}: ${chalk.cyan(toolCall.toolName)}\n${chalk.gray('Args')}: ${JSON.stringify(toolCall.args, null, 2)}`,
          {
            padding: 1,
            margin: { left: 2 },
            borderStyle: 'round',
            borderColor: 'yellow',
            title: 'Tool Call',
            titleAlignment: 'left',
          },
        );
        console.log(toolBox);
      },
      TOOL_SYSTEM_PROMPT,
    );

    if (result.toolResults && result.toolResults.length > 0) {
      for (const tr of result.toolResults) {
        const resultBox = boxen(
          chalk.white(JSON.stringify(tr.result, null, 2)),
          {
            padding: 1,
            margin: { left: 2 },
            borderStyle: 'round',
            borderColor: 'magenta',
            title: 'Tool Result',
            titleAlignment: 'left',
          },
        );
        console.log(resultBox);
      }
    }

    console.log('\n');
    console.log(chalk.gray('-'.repeat(60)));
    console.log('\n');

    return result.content;
  } catch (error) {
    spinner.error('Failed to get AI response');
    throw error;
  }
}

async function toolChatLoop(conversation) {
  const helpBox = boxen(
    `${chalk.gray('Type your message and press Enter')}\n${chalk.gray('The AI can use enabled tools to help answer questions')}\n${chalk.gray('Type "exit" to end conversation')}\n${chalk.gray('Press Ctrl+C to quit anytime')}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: 'round',
      borderColor: 'gray',
      dimBorder: true,
    },
  );
  console.log(helpBox);

  let messageCount = 0;

  while (true) {
    const userInput = await text({
      message: chalk.blue('Your message'),
      placeholder: 'Type your message...',
      validate(value) {
        if (!value || value.trim().length === 0)
          return 'Message cannot be empty';
      },
    });

    if (isCancel(userInput)) {
      cancel(chalk.gray('Ending conversation...'));
      break;
    }

    if (userInput.toLowerCase() === 'exit') {
      break;
    }

    messageCount++;
    await saveMessage(conversation.id, 'user', userInput);

    try {
      const aiResponse = await getToolAIResponse(conversation.id);
      await saveMessage(conversation.id, 'assistant', aiResponse);

      if (messageCount === 1) {
        const title =
          userInput.slice(0, 50) + (userInput.length > 50 ? '...' : '');
        chatService.updateTitle(conversation.id, title);
      }
    } catch (error) {
      console.log(chalk.red(`\nFailed to get response: ${error.message}`));
      console.log(chalk.gray('Please try again.\n'));
    }
  }
}

export async function startToolChat(conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.cyan('Bookly'), {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
      }),
    );

    const user = getUserFromToken();
    const didSelect = await selectTools();
    if (!didSelect) return;

    const conversation = initConversation(user.id, conversationId, 'tool');
    await toolChatLoop(conversation);

    resetTools();
    outro(chalk.green('Thanks for using tools!'));
  } catch (error) {
    resetTools();
    console.log(
      boxen(chalk.red(`Error: ${error.message}`), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red',
      }),
    );
  }
}
