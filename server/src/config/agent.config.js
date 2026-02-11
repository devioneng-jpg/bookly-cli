import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { z } from 'zod';
import yoctoSpinner from 'yocto-spinner';
import boxen from 'boxen';

const ApplicationSchema = z.object({
  folderName: z.string().describe('Kebab-case folder name for the application'),
  description: z
    .string()
    .describe('Brief description of what was created'),
  files: z
    .array(
      z.object({
        path: z.string().describe('Relative file path (e.g., src/App.jsx)'),
        content: z.string().describe('Complete file content'),
      }),
    )
    .describe('All files needed for the application'),
  setupCommands: z
    .array(z.string())
    .describe('Bash commands to setup and run the project'),
});

export async function generateApplication(
  description,
  aiService,
  cwd = process.cwd(),
) {
  const spinner = yoctoSpinner({
    text: 'Generating application...',
    color: 'cyan',
  }).start();

  try {
    const prompt = `Generate a complete application based on this description: "${description}".
Include all necessary files with complete content (package.json, source files, config files, etc).
Make sure the code is production-ready with proper error handling.
Use modern best practices and include a README.md with setup instructions.`;

    const result = await aiService.generateStructured(
      ApplicationSchema,
      prompt,
    );

    spinner.success('Application generated!');

    const appDir = path.join(cwd, result.folderName);
    await fs.mkdir(appDir, { recursive: true });

    const fileSpinner = yoctoSpinner({
      text: 'Writing files...',
    }).start();

    for (const file of result.files) {
      const filePath = path.join(appDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    fileSpinner.success(`${result.files.length} files created`);

    const summaryBox = boxen(
      `${chalk.bold('Project')}: ${result.folderName}\n` +
        `${chalk.gray('Description')}: ${result.description}\n` +
        `${chalk.gray('Location')}: ${appDir}\n` +
        `${chalk.gray('Files')}: ${result.files.length}\n\n` +
        `${chalk.bold('Setup commands:')}\n` +
        result.setupCommands.map((cmd) => chalk.cyan(`  $ ${cmd}`)).join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'green',
        title: 'Generated Application',
        titleAlignment: 'center',
      },
    );
    console.log(summaryBox);

    const fileList = result.files
      .map((f) => chalk.gray(`  ${f.path}`))
      .join('\n');
    console.log(chalk.bold('\nFiles created:'));
    console.log(fileList + '\n');

    return {
      folderName: result.folderName,
      appDir,
      files: result.files,
      commands: result.setupCommands,
      description: result.description,
      success: true,
    };
  } catch (error) {
    spinner.error('Failed to generate application');
    console.error(chalk.red('Error:'), error.message);
    return { success: false, error: error.message };
  }
}
