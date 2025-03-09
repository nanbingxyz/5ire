const { execSync } = require('child_process');

exports.default = async function signArtifacts(context) {
  console.info('afterAllArtifactBuild hook triggered');
  const { artifactPaths } = context;

  console.info(`Artifact Paths: ${JSON.stringify(artifactPaths)}`);

  // Check if this is a Linux build by looking for any AppImage
  const isLinux = artifactPaths.some((artifact) =>
    artifact.endsWith('.AppImage'),
  );
  if (!isLinux) {
    console.info('No AppImage found, skipping signing');
    return;
  }

  if (!process.env.GPG_KEY_ID) {
    throw new Error(
      'GPG_KEY_ID environment variable must be set to a valid GPG key ID (e.g., F51DE3D45EEFC1387B4469E788BBA7820E939D09)',
    );
  }

  // Filter all AppImages from artifactPaths
  const appImages = artifactPaths.filter((artifact) =>
    artifact.endsWith('.AppImage'),
  );

  if (!appImages.length) {
    throw new Error('No AppImages found in artifact paths');
  }

  // Sign each AppImage using forEach
  appImages.forEach((appImagePath) => {
    console.info(
      `Signing AppImage with key ${process.env.GPG_KEY_ID}: ${appImagePath}`,
    );
    try {
      execSync(
        `gpg --detach-sign --armor --yes --default-key ${process.env.GPG_KEY_ID} "${appImagePath}"`,
        { stdio: 'inherit' },
      );
      console.info(`AppImage signed successfully: ${appImagePath}.asc`);
    } catch (error) {
      console.error(`Failed to sign AppImage: ${error.message}`);
      throw error; // This will stop the build and report the error
    }
  });
};
