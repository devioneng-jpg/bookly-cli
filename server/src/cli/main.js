#!/usr/bin/env node

import dotenv from 'dotenv';

import chalk from 'chalk';
import figlet from 'figlet';
import { Command } from 'commander';
import { wakeUp } from './commands/ai/wakeUp.js';

dotenv.config();

async function main() {
  // Display banner
  console.log(
    chalk.cyan(
      figlet.textSync('Bookly', {
        font: 'Standard',
        horizontalLayout: 'default',
      }),
    ),
  );
  console.log(chalk.gray('Shop with Bookly! \n'));

  const program = new Command('bookly');

  // Add commands
  program.addCommand(wakeUp);

  // Default action shows help
  program.action(() => {
    program.help();
  });

  program.parse();
}

main().catch((error) => {
  console.error(chalk.red('Error running Bookly:'), error);
  process.exit(1);
});
