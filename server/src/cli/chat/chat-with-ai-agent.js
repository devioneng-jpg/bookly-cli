import chalk from 'chalk';
import boxen from 'boxen';
import { text, isCancel, cancel, intro, outro, confirm } from '@clack/prompts';
import { AIService } from '../ai/anthropic-service.js';
import { ChatService } from '../../service/chat.service.js';
import { generateApplication } from '../../config/agent.config.js';
import { getUserFromToken, initConversation, saveMessage } from './chat-with-ai.js';

const aiService = new AIService();
const chatService = new ChatService();

async function agentLoop(conversation) {
  const helpBox = boxen(
    `${chalk.bold('Describe the application you want to build:')}\n\n` +
      `${chalk.gray('Examples:')}\n` +
      `${chalk.cyan('  "Build a todo app with React and Tailwind"')}\n` +
      `${chalk.cyan('  "Create a REST API with Express and MongoDB"')}\n` +
      `${chalk.cyan('  "Make a CLI tool that converts CSV to JSON"')}\n\n` +
      `${chalk.gray('Type "exit" to end session')}\n` +
      `${chalk.gray('Press Ctrl+C to quit anytime')}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: 'round',
      borderColor: 'magenta',
      title: 'Agent Mode',
      titleAlignment: 'center',
    },
  );
  console.log(helpBox);

  while (true) {
    const userInput = await text({
      message: chalk.magenta('What would you like to build?'),
      placeholder: 'Describe your application...',
      validate(value) {
        if (!value || value.trim().length === 0)
          return 'Description cannot be empty';
        if (value.trim().length < 10)
          return 'Please provide more details (at least 10 characters)';
      },
    });

    if (isCancel(userInput)) {
      cancel(chalk.gray('Ending session...'));
      break;
    }

    if (userInput.toLowerCase() === 'exit') {
      break;
    }

    await saveMessage(conversation.id, 'user', userInput);

    const result = await generateApplication(
      userInput,
      aiService,
      process.cwd(),
    );

    if (result && result.success) {
      const responseMessage =
        `Generated application: ${result.folderName}\n` +
        `Files created: ${result.files.length}\n` +
        `Location: ${result.appDir}\n\n` +
        `Setup commands:\n${result.commands.join('\n')}`;
      await saveMessage(conversation.id, 'assistant', responseMessage);

      const continuePrompt = await confirm({
        message: chalk.cyan(
          'Would you like to generate another application?',
        ),
        initialValue: false,
      });

      if (isCancel(continuePrompt) || !continuePrompt) {
        break;
      }
    } else {
      await saveMessage(
        conversation.id,
        'assistant',
        `Failed to generate: ${result?.error || 'Unknown error'}`,
      );

      const retryPrompt = await confirm({
        message: chalk.cyan('Would you like to try again?'),
        initialValue: true,
      });

      if (isCancel(retryPrompt) || !retryPrompt) {
        break;
      }
    }
  }
}

export async function startAgentChat(conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.magenta('Orbit AI - Agent Mode'), {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'magenta',
      }),
    );

    const warningBox = boxen(
      chalk.yellow(
        'This mode will generate files on your filesystem.\nGenerated projects are created in the current working directory.',
      ),
      {
        padding: 1,
        margin: { bottom: 1 },
        borderStyle: 'round',
        borderColor: 'yellow',
        title: 'Notice',
        titleAlignment: 'center',
      },
    );
    console.log(warningBox);

    const user = getUserFromToken();
    const conversation = initConversation(user.id, conversationId, 'agent');
    await agentLoop(conversation);

    outro(chalk.green('Thanks for building!'));
  } catch (error) {
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
