import chalk from 'chalk';
import { Command } from 'commander';
import { select, isCancel } from '@clack/prompts';
import { startChat } from '../../chat/chat-with-ai.js';
import { startToolChat } from '../../chat/chat-with-ai-tool.js';
import { startAgentChat } from '../../chat/chat-with-ai-agent.js';

const wakeUpAction = async () => {
  const choice = await select({
    message: 'Select a mode:',
    options: [
      {
        value: 'chat',
        label: 'Chat',
        hint: 'Simple chat with AI (order check, refund, general)',
      },
      {
        value: 'tool',
        label: 'Tool Calling',
        hint: 'Chat with tools (Order Lookup, Refund, FAQ Search)',
      },
      {
        value: 'agent',
        label: 'Agent Mode',
        hint: 'Generate full applications from a description',
      },
    ],
  });

  if (isCancel(choice)) {
    console.log(chalk.gray('Goodbye!'));
    return;
  }

  if (choice === 'chat') {
    const chatMode = await select({
      message: 'How can I help you today?',
      options: [
        {
          value: 'order-check',
          label: 'Check on your Order Status!',
        },
        {
          value: 'refund',
          label: 'Request a refund!',
        },
        {
          value: 'general',
          label: 'General questions (Shipping policy, password reset)',
        },
      ],
    });

    if (isCancel(chatMode)) {
      console.log(chalk.gray('Goodbye!'));
      return;
    }

    await startChat(chatMode);
  } else if (choice === 'tool') {
    await startToolChat();
  } else if (choice === 'agent') {
    await startAgentChat();
  }
};

export const wakeUp = new Command('wakeup')
  .description('Wake up the AI')
  .action(wakeUpAction);
