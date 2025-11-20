import { execSync } from "node:child_process";
import { join } from "node:path";
import { notarize } from "@electron/notarize";
import { build } from "electron-builder";
import { existsSync, readdirSync, rmSync } from "fs-extra";

build({
  config: {
    productName: "5ire",
    appId: "app.5ire.desktop",
    compression: "maximum",
    asar: false,
    asarUnpack: ["**/node_modules/**/*"],
    protocols: [
      {
        name: "5ire-deep-linking",
        schemes: ["app.5ire"],
      },
    ],
    electronLanguages: ["zh_CN", "en"],
    files: [
      "!**/node_modules/**/*.map",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme,LICENSE,test.js,license}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/node_modules/.bin",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj,md,txt}",
      "!**/._*",
      "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
      "!**/{__pycache__,docs, thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
      "!**/{appveyor.yml,.travis.yml,circle.yml}",
      "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}",
    ],
    // afterPack: ".erb/scripts/remove-useless.js",
    afterPack: async (ctx) => {
      if (process.platform === "darwin") {
        const resources = join(
          ctx.appOutDir,
          `${ctx.packager.appInfo.productName}.app`,
          "Contents",
          "Frameworks",
          "Electron Framework.framework",
          "Resources",
        );

        if (existsSync(resources)) {
          const items = readdirSync(resources);

          for (const item of items) {
            if (item.endsWith(".lproj") && item !== `en.lproj` && item !== `zh_CN.lproj`) {
              rmSync(join(resources, item), { force: true, recursive: true });
            }
          }
        }
      }
    },
    // afterSign: ".erb/scripts/notarize.js",
    afterSign: async (ctx) => {
      if (ctx.electronPlatformName !== "darwin") {
        return;
      }

      const appleId = process.env.APPLE_ID;
      const appleIdPass = process.env.APPLE_ID_PASS;
      const appleTeamId = process.env.APPLE_TEAM_ID;

      if (!appleId || !appleIdPass || !appleTeamId) {
        return console.warn(
          "Skipping notarization. APPLE_ID, APPLE_ID_PASS, and APPLE_TEAM_ID environment variables must be set",
        );
      }

      console.info("Notarizing...");

      await notarize({
        tool: "notarytool",
        appPath: `${ctx.appOutDir}/${ctx.packager.appInfo.productFilename}.app`,
        teamId: appleTeamId,
        appleId: appleId,
        appleIdPassword: appleIdPass,
      });

      console.info("Notarization complete");
    },
    // afterAllArtifactBuild: ".erb/scripts/sign.js",
    afterAllArtifactBuild: async (ctx) => {
      // Check if this is a Linux build by looking for any AppImage
      const isLinux = ctx.artifactPaths.some((artifact) => artifact.endsWith(".AppImage"));

      if (!isLinux) {
        console.info("No AppImage found, skipping signing");
        return [];
      }

      if (!process.env.GPG_KEY_ID) {
        throw new Error(
          "GPG_KEY_ID environment variable must be set to a valid GPG key ID (e.g., F51DE3D45EEFC1387B4469E788BBA7820E939D09)",
        );
      }

      // Filter all AppImages from artifactPaths
      const appImages = ctx.artifactPaths.filter((artifact) => artifact.endsWith(".AppImage"));

      if (!appImages.length) {
        throw new Error("No AppImages found in artifact paths");
      }

      // Sign each AppImage using forEach
      appImages.forEach((appImagePath) => {
        console.info(`Signing AppImage with key ${process.env.GPG_KEY_ID}: ${appImagePath}`);
        try {
          execSync(`gpg --detach-sign --armor --yes --default-key ${process.env.GPG_KEY_ID} "${appImagePath}"`, {
            stdio: "inherit",
          });
          console.info(`AppImage signed successfully: ${appImagePath}.asc`);
        } catch (error) {
          console.error(`Failed to sign AppImage: ${error}`);
          throw error; // This will stop the build and report the error
        }
      });

      return [];
    },
    mac: {
      target: {
        target: "default",
        arch: ["arm64"],
      },
      notarize: false,
      type: "distribution",
      hardenedRuntime: true,
      entitlementsInherit: "assets/entitlements.mac.plist",
      gatekeeperAssess: false,
      electronLanguages: ["zh_CN", "en"],
    },
    dmg: {
      contents: [
        {
          x: 130,
          y: 220,
        },
        {
          x: 410,
          y: 220,
          type: "link",
          path: "/Applications",
        },
      ],
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      perMachine: true,
    },
    win: {
      target: ["nsis"],
    },
    linux: {
      target: ["AppImage"],
      category: "Development",
      artifactName: "${productName}-${version}-${arch}.${ext}",
    },
    directories: {
      output: "release/build",
      app: "output",
    },
  },
});
