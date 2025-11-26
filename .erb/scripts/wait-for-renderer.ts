import detectPort from 'detect-port';
import chalk from 'chalk';

const port = 1212;

async function waitForRenderer() {
  console.log(chalk.blueBright('Waiting for renderer to be available...'));
  
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds max wait
  
  while (attempts < maxAttempts) {
    try {
      const availablePort = await detectPort(port);
      if (availablePort !== port) {
        // Port is in use, renderer is running
        console.log(chalk.greenBright('✓ Renderer is ready!'));
        return;
      }
    } catch (err) {
      // Ignore errors
    }
    
    // Wait 1 second before trying again
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    if (attempts % 5 === 0) {
      console.log(chalk.yellow(`Still waiting... (${attempts}s)`));
    }
  }
  
  console.log(chalk.red('✗ Renderer did not start within 60 seconds.'));
  console.log(chalk.yellow('Please start the renderer manually with: npm run start:renderer'));
  process.exit(1);
}

waitForRenderer().catch(err => {
  console.error(chalk.red('Error waiting for renderer:'), err);
  process.exit(1);
});
