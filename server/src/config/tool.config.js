import { tool } from 'ai';
import { z } from 'zod';

export const availableTools = [
  {
    id: 'order_lookup',
    name: 'Order Lookup',
    description: 'Look up an order by order number to check its status.',
    enabled: false,
    getTool: () =>
      tool({
        description:
          'Look up a customer order by order number. Returns order status, items, and shipping info.',
        parameters: z.object({
          orderNumber: z
            .string()
            .describe('The order number to look up (e.g. ORD-12345)'),
        }),
        execute: async ({ orderNumber }) => {
          const mockOrders = {
            'ORD-12345': {
              status: 'Shipped',
              items: ['The Great Gatsby', 'To Kill a Mockingbird'],
              tracking: 'TRK-98765',
              estimatedDelivery: '2026-02-15',
            },
            'ORD-67890': {
              status: 'Processing',
              items: ['1984', 'Brave New World', 'Fahrenheit 451'],
              tracking: null,
              estimatedDelivery: '2026-02-20',
            },
            'ORD-11111': {
              status: 'Delivered',
              items: ['Dune'],
              tracking: 'TRK-55555',
              estimatedDelivery: '2026-02-08',
              deliveredAt: '2026-02-07',
            },
          };

          const order = mockOrders[orderNumber];
          if (!order) {
            return { found: false, message: `No order found with number ${orderNumber}` };
          }
          return { found: true, orderNumber, ...order };
        },
      }),
  },
  {
    id: 'process_refund',
    name: 'Process Refund',
    description: 'Submit a refund request for an order.',
    enabled: false,
    getTool: () =>
      tool({
        description:
          'Process a refund request for a given order number with a reason.',
        parameters: z.object({
          orderNumber: z.string().describe('The order number to refund'),
          reason: z.string().describe('Reason for the refund request'),
        }),
        execute: async ({ orderNumber, reason }) => {
          return {
            success: true,
            refundId: `REF-${Date.now()}`,
            orderNumber,
            reason,
            status: 'Pending Review',
            estimatedProcessingDays: 3,
            message: `Refund request submitted for order ${orderNumber}. Expected processing time: 3 business days.`,
          };
        },
      }),
  },
  {
    id: 'search_faq',
    name: 'Search FAQ',
    description: 'Search the Bookly FAQ knowledge base for answers.',
    enabled: false,
    getTool: () =>
      tool({
        description:
          'Search the FAQ knowledge base for answers to common customer questions.',
        parameters: z.object({
          query: z.string().describe('The search query'),
        }),
        execute: async ({ query }) => {
          const faqs = [
            {
              question: 'What is the shipping policy?',
              answer:
                'We offer free standard shipping on orders over $25. Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available for $9.99.',
              keywords: ['shipping', 'delivery', 'free', 'express', 'days'],
            },
            {
              question: 'How do I reset my password?',
              answer:
                'Go to the login page and click "Forgot Password". Enter your email and we will send a reset link. The link expires in 24 hours.',
              keywords: ['password', 'reset', 'forgot', 'login', 'email'],
            },
            {
              question: 'What is the return policy?',
              answer:
                'You can return books within 30 days of delivery for a full refund. Books must be in original condition. Digital purchases are non-refundable.',
              keywords: ['return', 'refund', 'policy', 'days', 'condition'],
            },
            {
              question: 'How do I track my order?',
              answer:
                'Once your order ships, you will receive a tracking number via email. You can also check order status by using the order lookup feature.',
              keywords: ['track', 'order', 'status', 'tracking', 'number'],
            },
            {
              question: 'Do you offer gift cards?',
              answer:
                'Yes! Bookly gift cards are available in denominations of $10, $25, $50, and $100. They never expire and can be used on any purchase.',
              keywords: ['gift', 'card', 'cards', 'buy', 'purchase'],
            },
          ];

          const queryLower = query.toLowerCase();
          const results = faqs
            .filter((faq) =>
              faq.keywords.some((kw) => queryLower.includes(kw)),
            )
            .map(({ question, answer }) => ({ question, answer }));

          if (results.length === 0) {
            return {
              found: false,
              message:
                'No FAQ articles found. Please contact support for further help.',
            };
          }
          return { found: true, results };
        },
      }),
  },
];

export function getEnabledTools() {
  const tools = {};
  for (const t of availableTools) {
    if (t.enabled) {
      tools[t.id] = t.getTool();
    }
  }
  return tools;
}

export function toggleTool(toolId) {
  const t = availableTools.find((t) => t.id === toolId);
  if (t) t.enabled = !t.enabled;
}

export function enableTools(toolIds) {
  for (const t of availableTools) {
    t.enabled = toolIds.includes(t.id);
  }
}

export function getEnabledToolNames() {
  return availableTools.filter((t) => t.enabled).map((t) => t.name);
}

export function resetTools() {
  for (const t of availableTools) {
    t.enabled = false;
  }
}
