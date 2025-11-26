import detectPort from 'detect-port';
import chalk from 'chalk';

const port = 1212;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

async function waitForRenderer(attempt = 0): Promise<void> {
  if (attempt === 0) {
    console.log(chalk.blueBright('Waiting for renderer to be available...'));
  }

  const maxAttempts = 60; // 60 seconds max wait
  if (attempt >= maxAttempts) {
    console.log(chalk.red('✗ Renderer did not start within 60 seconds.'));
    console.log(
      chalk.yellow(
        'Please start the renderer manually with: npm run start:renderer',
      ),
    );
    process.exit(1);
    return;
  }

  try {
    const availablePort = await detectPort(port);
    if (availablePort !== port) {
      console.log(chalk.greenBright('✓ Renderer is ready!'));
      return;
    }
  } catch (err) {
    // Ignore errors and retry
  }

  if ((attempt + 1) % 5 === 0) {
    console.log(chalk.yellow(`Still waiting... (${attempt + 1}s)`));
  }

  await delay(1000);
  await waitForRenderer(attempt + 1);
}

waitForRenderer().catch((err) => {
  console.error(chalk.red('Error waiting for renderer:'), err);
  process.exit(1);
});
