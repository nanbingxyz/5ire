import {
  app,
  Menu,
  MenuItem,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';

/**
 * Extended menu item constructor options for Darwin (macOS) platform
 * Includes additional properties specific to macOS menu behavior
 */
interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  /** macOS-specific selector for native menu actions */
  selector?: string;
  /** Submenu items, can be an array of Darwin options or a Menu instance */
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

/**
 * Builds and manages application menus for Electron applications
 * Provides platform-specific menu implementations and context menu handling
 */
export default class MenuBuilder {
  /** The main browser window instance for menu interactions */
  mainWindow: BrowserWindow;

  /**
   * Creates a new MenuBuilder instance
   * @param {BrowserWindow} mainWindow - The main browser window to associate with menus
   */
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Builds and sets the application menu based on the current platform
   * Sets up context menu handling and returns the created menu
   * @returns {Menu} The constructed application menu
   */
  buildMenu(): Menu {
    this.setupContextMenu();
    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  /**
   * Sets up context menu handling for the main window
   * Provides copy, paste, cut, select all, spell check suggestions, and developer tools
   */
  setupContextMenu(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const template = [
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Cut', role: 'cut' },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' },
      ] as MenuItemConstructorOptions[];
      const menu = Menu.buildFromTemplate(template);
      // Add each spelling suggestion
      Array.from(props.dictionarySuggestions).forEach((suggestion) => {
        menu.append(
          new MenuItem({
            label: suggestion,
            click: () =>
              this.mainWindow.webContents.replaceMisspelling(suggestion),
          }),
        );
      });
      // Allow users to add the misspelled word to the dictionary
      if (props.misspelledWord) {
        menu.append(
          new MenuItem({
            label: 'Add to dictionary',
            click: () =>
              this.mainWindow.webContents.session.addWordToSpellCheckerDictionary(
                props.misspelledWord,
              ),
          }),
        );
      }
      const { x, y } = props;
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.DEBUG_PROD === 'true'
      ) {
        menu.append(
          new MenuItem({
            type: 'separator',
          }),
        );
        menu.append(
          new MenuItem({
            label: 'Inspect element',
            click: () => {
              this.mainWindow.webContents.inspectElement(x, y);
            },
          }),
        );
      }
      menu.popup();
    });
  }

  /**
   * Builds the menu template for macOS (Darwin) platform
   * Includes standard macOS menu structure with app, edit, view, window, and help menus
   * @returns {MenuItemConstructorOptions[]} Array of menu items for macOS
   */
  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: '5ire',
      submenu: [
        {
          label: 'About 5ire',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide 5ire',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('https://5ire.app');
          },
        },
        {
          label: 'Community Discussions',
          click() {
            shell.openExternal('https://5ire.canny.io/');
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  /**
   * Builds the default menu template for non-macOS platforms
   * Includes file, view, and help menus with platform-appropriate keyboard shortcuts
   * @returns {MenuItemConstructorOptions[]} Array of menu items for default platforms
   */
  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
              ]
            : [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
              ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click() {
              shell.openExternal('https://electronjs.org');
            },
          },
          {
            label: 'Documentation',
            click() {
              shell.openExternal(
                'https://github.com/electron/electron/tree/main/docs#readme',
              );
            },
          },
          {
            label: 'Community Discussions',
            click() {
              shell.openExternal('https://www.electronjs.org/community');
            },
          },
          {
            label: 'Search Issues',
            click() {
              shell.openExternal('https://github.com/electron/electron/issues');
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
