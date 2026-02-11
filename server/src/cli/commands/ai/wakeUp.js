import chalk from 'chalk';
import { Command } from 'commander';
import { select, text, isCancel } from '@clack/prompts';
import { startChat } from '../../chat/chat-with-ai.js';

const FOLLOW_UP_QUESTIONS = {
  'order-check': {
    message: 'Did you create an account or check out as a guest?',
    placeholder: 'e.g. "I have an account" or "I checked out as a guest"',
  },
  refund: {
    message: 'What is prompting your refund?',
    placeholder: 'e.g. "The book arrived damaged"',
  },
  general: {
    message: 'What is the nature of your question?',
    placeholder: 'e.g. "How long does shipping take?"',
  },
};

const wakeUpAction = async () => {
  const choice = await select({
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

  if (isCancel(choice)) {
    console.log(chalk.gray('Goodbye!'));
    return;
  }

  const followUp = FOLLOW_UP_QUESTIONS[choice];
  const answer = await text({
    message: followUp.message,
    placeholder: followUp.placeholder,
    validate(value) {
      if (!value || value.trim().length === 0) return 'Please provide an answer';
    },
  });

  if (isCancel(answer)) {
    console.log(chalk.gray('Goodbye!'));
    return;
  }

  await startChat(choice, null, answer);
};

export const wakeUp = new Command('wakeup')
  .description('Wake up the agent')
  .action(wakeUpAction);
