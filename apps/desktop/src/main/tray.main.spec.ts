import * as path from "path";

import { Tray } from "electron";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@bitwarden/key-management";

import { TrayIconStyle } from "../platform/models/domain/tray-icon-style";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { TrayMain } from "./tray.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  app: { dock: { hide: jest.fn(), show: jest.fn() } },
  Menu: { buildFromTemplate: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({ setTemplateImage: jest.fn() })) },
  Tray: jest.fn(() => ({
    on: jest.fn(),
    setContextMenu: jest.fn(),
    setImage: jest.fn(),
    setPressedImage: jest.fn(),
    setToolTip: jest.fn(),
  })),
}));

// isDev() reads a webpack-defined global that doesn't exist in Jest.
jest.mock("../utils", () => ({
  isDev: jest.fn().mockReturnValue(false),
}));

describe("TrayMain", () => {
  const originalPlatform = process.platform;

  // tray.main.ts resolves icons against its own __dirname, which is this spec's directory.
  const colorIcon = path.join(__dirname, "/images/icon.png");
  const whiteIcon = path.join(__dirname, "/images/tray-icon-white.png");
  const blackIcon = path.join(__dirname, "/images/tray-icon-black.png");

  let desktopSettingsService: MockProxy<DesktopSettingsService>;
  let runInBackground$: BehaviorSubject<boolean>;
  let trayIconStyle$: BehaviorSubject<TrayIconStyle>;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  const createSut = () =>
    new TrayMain(
      mock<WindowMain>(),
      mock<I18nService>(),
      desktopSettingsService,
      mock<MessagingService>(),
      mock<BiometricsService>(),
    );

  const latestTray = (): jest.Mocked<Tray> => jest.mocked(Tray).mock.results.at(-1)?.value;

  beforeEach(() => {
    jest.clearAllMocks();

    runInBackground$ = new BehaviorSubject(true);
    trayIconStyle$ = new BehaviorSubject<TrayIconStyle>(TrayIconStyle.Color);
    desktopSettingsService = mock<DesktopSettingsService>();
    Object.assign(desktopSettingsService, { runInBackground$, trayIconStyle$ });
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  describe("on linux", () => {
    beforeEach(() => {
      setPlatform("linux");
    });

    it.each([
      [TrayIconStyle.Color, colorIcon],
      [TrayIconStyle.White, whiteIcon],
      [TrayIconStyle.Black, blackIcon],
    ])("creates the tray with the %s icon", async (style, expectedIcon) => {
      trayIconStyle$.next(style);

      await createSut().init("Bitwarden");

      expect(Tray).toHaveBeenCalledWith(expectedIcon);
    });

    it("updates the tray icon when the style changes", async () => {
      await createSut().init("Bitwarden");

      trayIconStyle$.next(TrayIconStyle.White);
      expect(latestTray().setImage).toHaveBeenLastCalledWith(whiteIcon);

      trayIconStyle$.next(TrayIconStyle.Color);
      expect(latestTray().setImage).toHaveBeenLastCalledWith(colorIcon);
    });

    it("uses the chosen style when the tray is shown later", async () => {
      runInBackground$.next(false);
      await createSut().init("Bitwarden");

      trayIconStyle$.next(TrayIconStyle.Black);
      expect(Tray).not.toHaveBeenCalled();

      runInBackground$.next(true);
      expect(Tray).toHaveBeenCalledWith(blackIcon);
    });
  });

  describe.each<NodeJS.Platform>(["win32", "darwin"])("on %s", (platform) => {
    beforeEach(() => {
      setPlatform(platform);
    });

    it("ignores the tray icon style setting", async () => {
      trayIconStyle$.next(TrayIconStyle.White);

      await createSut().init("Bitwarden");

      expect(trayIconStyle$.observed).toBe(false);
      expect(Tray).toHaveBeenCalledTimes(1);
      expect(Tray).not.toHaveBeenCalledWith(whiteIcon);
    });
  });
});
