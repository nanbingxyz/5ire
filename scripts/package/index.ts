import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { notarize } from "@electron/notarize";
import { type BuildResult, build } from "electron-builder";
import { existsSync, readdirSync, readFile, rmSync, writeFile } from "fs-extra";
import { stringify } from "yaml";

const publish = process.argv.includes("--publish");

const signLinuxAppImages = async (result: BuildResult) => {
  if (process.platform !== "linux") {
    return;
  }

  const appImages = result.artifactPaths.filter((artifact) => artifact.endsWith(".AppImage"));

  if (!appImages.length) {
    return console.warn("No AppImages found in artifact paths, skipping signing");
  }

  if (!process.env.GPG_SECRET_KEY_B64) {
    return console.warn("GPG_SECRET_KEY_B64 environment variable not set, skipping AppImage signing");
  }

  const secretKey = Buffer.from(process.env.GPG_SECRET_KEY_B64, "base64").toString("utf-8");
  const secretKeyPassword = process.env.GPG_SECRET_KEY_PASSWORD || "";
  const secretKeyIdRegex = /^gpg: key (.*?):/;

  const importSecretKeyResult = execSync(`gpg --import --logger-fd 1`, { input: secretKey, encoding: "utf-8" });

  const match = importSecretKeyResult.match(secretKeyIdRegex);

  if (!match?.[1]) {
    return console.warn(
      "Failed to extract GPG key ID from imported key. Make sure GPG_SECRET_KEY_B64 contains a valid GPG private key.",
    );
  }

  const additionalFiles: string[] = [];

  for (const appImage of appImages) {
    console.info(`Signing AppImage with key ${match[1]}: ${appImage}`);

    execSync(
      `gpg --detach-sign --armor --batch --passphrase-fd 0 --pinentry-mode loopback --yes --default-key ${match[1]} "${appImage}"`,
      {
        input: `${secretKeyPassword}\n`,
      },
    );

    additionalFiles.push(`${appImage}.asc`);
  }

  return additionalFiles;
};

const generateManifest = async (result: BuildResult) => {
  const file = join(result.outDir, `manifest-${process.platform}-${process.arch}.yml`);
  const content = {
    files: await Promise.all(
      result.artifactPaths
        .filter((artifact) => {
          return !artifact.endsWith(".blockmap");
        })
        .map(async (artifact) => {
          const content = await readFile(artifact);
          const sha512 = createHash("sha512").update(content).digest().toString("base64");
          const size = content.byteLength;

          return {
            url: basename(artifact),
            sha512,
            size,
          };
        }),
    ),
  };

  await writeFile(file, stringify(content, { aliasDuplicateObjects: false }));

  return [file];
};

build({
  config: {
    productName: "5ire",
    appId: "app.5ire.desktop",
    // Using maximum compression on Linux can cause excessively long application startup times
    compression: process.platform === "linux" ? "normal" : "maximum",
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
    afterAllArtifactBuild: async (ctx) => {
      const additionalFiles: string[] = [];

      await signLinuxAppImages(ctx).then((files) => {
        if (files) {
          additionalFiles.push(...files);
        }
      });

      await generateManifest(ctx).then((files) => {
        if (files) {
          additionalFiles.push(...files);
        }
      });

      return additionalFiles;
    },
    mac: {
      target: ["dmg", "zip"],
      notarize: false,
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
      // biome-ignore lint/suspicious/noTemplateCurlyInString: x
      artifactName: "${productName}-${version}-${arch}.${ext}",
    },
    directories: {
      output: "release",
      app: "output",
    },
    publish: {
      provider: "github",
    },
  },
  publish: publish ? "always" : undefined,
});
