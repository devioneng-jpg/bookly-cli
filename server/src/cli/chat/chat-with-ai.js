import chalk from 'chalk';
import boxen from 'boxen';
import { text, isCancel, cancel, intro, outro } from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';
import { AIService } from '../ai/anthropic-service.js';
import { ChatService } from '../../service/chat.service.js';
import memory from '../../memory.js';

const aiService = new AIService();
const chatService = new ChatService();

const HONESTY_CONSTRAINT =
  'IMPORTANT: You do NOT have access to any real customer data, order systems, or account information. Never make up order statuses, tracking numbers, refund confirmations, or any specific account details. If the customer asks you to look up an order, check a status, or process a refund, let them know you cannot access those systems directly and direct them to support@bookly.com or call 1-800-BOOKLY for account-specific help. You CAN answer general policy questions (shipping times, return policy, gift cards, password resets) since those apply to all customers.';

const SCOPE_BOUNDARY =
  'You can ONLY help with Bookly-related topics: orders, refunds, shipping, account issues, gift cards, and our product catalog. If the customer asks about anything unrelated to Bookly (e.g. general knowledge, coding, weather, other companies), politely let them know you can only assist with Bookly matters and ask how you can help them with their Bookly experience.';

const SYSTEM_PROMPTS = {
  'order-check':
    `You are a friendly customer support agent for Bookly. The customer wants to check on their order status. You already asked whether they have an account or checked out as a guest — their answer is included as the first message. Based on their answer, guide them accordingly: if they have an account, ask for their email or order number; if they are a guest, ask for the order number and email used at checkout. Be helpful and provide clear updates. ${HONESTY_CONSTRAINT} ${SCOPE_BOUNDARY}`,
  refund:
    `You are a friendly customer support agent for Bookly. The customer wants a refund. You already asked what is prompting their refund — their answer is included as the first message. Be empathetic and acknowledge their reason. Then ask for their order number so you can look into it. Explain the refund policy (30-day return window, original condition, digital purchases non-refundable) and walk them through the process. ${HONESTY_CONSTRAINT} ${SCOPE_BOUNDARY}`,
  general:
    `You are a friendly customer support agent for Bookly. The customer has a general question. You already asked about the nature of their question — their answer is included as the first message. Address their question directly and thoroughly. You can help with shipping policies, password resets, account issues, gift cards, and more. ${HONESTY_CONSTRAINT} ${SCOPE_BOUNDARY}`,
  chat: `You are a friendly customer support agent for Bookly. Help the customer with whatever they need. ${HONESTY_CONSTRAINT} ${SCOPE_BOUNDARY}`,
};

export function getUserFromToken() {
  const sessions = memory.findByRole('auth');
  const session = sessions.length
    ? JSON.parse(sessions[sessions.length - 1].content)
    : null;

  if (session?.access_token) {
    return {
      id: session.userId,
      token: session.access_token,
      authenticatedAt: session.timestamp,
    };
  }

  const guest = {
    userId: `guest_${Date.now()}`,
    access_token: 'guest',
    timestamp: Date.now(),
  };
  memory.add('auth', JSON.stringify(guest));

  return {
    id: guest.userId,
    token: guest.access_token,
    authenticatedAt: guest.timestamp,
  };
}

export function initConversation(userId, conversationId = null, mode = 'chat') {
  const spinner = yoctoSpinner({ text: 'Loading conversation...' }).start();

  const conversation = chatService.getOrCreateConversation(
    userId,
    conversationId,
    mode,
  );

  spinner.success('Conversation loaded');
  const conversationInfo = boxen(
    `${chalk.bold('Conversation')}: ${conversation.title}\n${chalk.gray('ID: ' + conversation.id)}\n${chalk.gray('Mode: ' + conversation.mode)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      title: 'Chat Session',
      titleAlignment: 'center',
    },
  );

  console.log(conversationInfo);
  return conversation;
}

export async function saveMessage(conversationId, role, content) {
  return chatService.addMessage(conversationId, role, content);
}

async function getAIResponse(conversationId, systemPrompt) {
  const spinner = yoctoSpinner({
    text: 'AI is thinking...',
    color: 'cyan',
  }).start();

  const dbMessages = chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);

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
      undefined,
      null,
      systemPrompt,
    );

    console.log('\n');
    console.log(chalk.gray('-'.repeat(60)));
    console.log('\n');

    return result.content;
  } catch (error) {
    spinner.error('Failed to get AI response');
    throw error;
  }
}

async function updateConversationTitle(
  conversationId,
  userInput,
  messageCount,
) {
  if (messageCount === 1) {
    const title = userInput.slice(0, 50) + (userInput.length > 50 ? '...' : '');
    chatService.updateTitle(conversationId, title);
  }
}

async function chatLoop(conversation) {
  const systemPrompt =
    SYSTEM_PROMPTS[conversation.mode] || SYSTEM_PROMPTS['chat'];

  const helpBox = boxen(
    `${chalk.gray('Type your message and press Enter')}\n${chalk.gray('Markdown formatting is supported in responses')}\n${chalk.gray('Type "exit" to end conversation')}\n${chalk.gray('Press Ctrl+C to quit anytime')}`,
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

    const lower = userInput.toLowerCase().trim();
    if (['exit', 'bye', 'goodbye', 'quit'].includes(lower)) {
      break;
    }

    messageCount++;
    await saveMessage(conversation.id, 'user', userInput);

    try {
      const aiResponse = await getAIResponse(conversation.id, systemPrompt);
      await saveMessage(conversation.id, 'assistant', aiResponse);
      await updateConversationTitle(conversation.id, userInput, messageCount);
    } catch (error) {
      console.log(chalk.red(`\nFailed to get response: ${error.message}`));
      console.log(chalk.gray('Please try again.\n'));
    }
  }
}

export async function startChat(
  mode = 'chat',
  conversationId = null,
  initialAnswer = null,
) {
  try {
    intro(
      boxen(chalk.bold.cyan('Bookly CLI Agent'), {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
      }),
    );

    const user = getUserFromToken();
    const conversation = initConversation(user.id, conversationId, mode);

    if (initialAnswer) {
      await saveMessage(conversation.id, 'user', initialAnswer);
      const systemPrompt =
        SYSTEM_PROMPTS[conversation.mode] || SYSTEM_PROMPTS['chat'];
      const aiResponse = await getAIResponse(conversation.id, systemPrompt);
      await saveMessage(conversation.id, 'assistant', aiResponse);
    }

    await chatLoop(conversation);

    outro(chalk.green('Thanks for chatting!'));
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
