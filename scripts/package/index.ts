import { build } from "electron-builder";

build({
  config: {
    productName: "5ire",
    appId: "app.5ire.desktop",
    compression: "maximum",
    asar: true,
    asarUnpack: ["**/node_modules/**/*"],
    protocols: [
      {
        name: "5ire-deep-linking",
        schemes: ["app.5ire"],
      },
    ],
    electronLanguages: ["zh_CN", "en"],
    files: [
      "dist",
      "package.json",
      "!**/node_modules/**/*.map",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme,LICENSE,test.js}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/node_modules/.bin",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj,md,txt}",
      "!.editorconfig",
      "!**/._*",
      "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
      "!**/{__pycache__,docs, thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
      "!**/{appveyor.yml,.travis.yml,circle.yml}",
      "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}",
      "!**/src/**",
      "!**/source/**",
      "!**/node_modules/@xenova/transformers/dist/**",
      "**/node_modules/@xenova/transformers/src/**",
      "**/node_modules/textract/lib/extractors/**",
    ],
    afterPack: ".erb/scripts/remove-useless.js",
    afterSign: ".erb/scripts/notarize.js",
    afterAllArtifactBuild: ".erb/scripts/sign.js",
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
      include: "installer.nsh",
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
      buildResources: "assets",
      output: "release/build",
    },
    extraResources: [
      ".env",
      "./assets/**",
      "./public/locales/**",
      {
        from: "./public/images",
        to: "./images",
      },
    ],
  },
});
