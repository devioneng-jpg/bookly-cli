import dotenv from 'dotenv';
dotenv.config();

export const config = {
  claudeApiKey: process.env.CLAUDE_ANTHROPIC_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
};
