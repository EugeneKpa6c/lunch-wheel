type SafeAreaInset = Partial<Record<"top" | "right" | "bottom" | "left", number>>;

type TelegramHaptics = {
  impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
};

type TelegramWebApp = {
  HapticFeedback?: TelegramHaptics;
  contentSafeAreaInset?: SafeAreaInset;
  expand?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  onEvent?: (event: string, callback: () => void) => void;
  ready?: () => void;
  safeAreaInset?: SafeAreaInset;
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
  viewportStableHeight?: number;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const METRIC_EVENTS = [
  "safeAreaChanged",
  "contentSafeAreaChanged",
  "viewportChanged",
];

function setInset(name: string, value = 0) {
  document.documentElement.style.setProperty(name, `${Math.max(value, 0)}px`);
}

function syncTelegramMetrics(webApp: TelegramWebApp) {
  const safeArea = webApp.safeAreaInset ?? {};
  const contentSafeArea = webApp.contentSafeAreaInset ?? {};

  setInset("--tg-safe-top", Math.max(safeArea.top ?? 0, contentSafeArea.top ?? 0));
  setInset(
    "--tg-safe-right",
    Math.max(safeArea.right ?? 0, contentSafeArea.right ?? 0),
  );
  setInset(
    "--tg-safe-bottom",
    Math.max(safeArea.bottom ?? 0, contentSafeArea.bottom ?? 0),
  );
  setInset(
    "--tg-safe-left",
    Math.max(safeArea.left ?? 0, contentSafeArea.left ?? 0),
  );

  if (webApp.viewportStableHeight) {
    document.documentElement.style.setProperty(
      "--tg-stable-height",
      `${webApp.viewportStableHeight}px`,
    );
  }
}

export function bootTelegramMiniApp() {
  const webApp = window.Telegram?.WebApp;

  if (!webApp) {
    return;
  }

  syncTelegramMetrics(webApp);
  METRIC_EVENTS.forEach((event) => {
    webApp.onEvent?.(event, () => syncTelegramMetrics(webApp));
  });

  if (webApp.isVersionAtLeast?.("6.1")) {
    webApp.setHeaderColor?.("#120e18");
    webApp.setBackgroundColor?.("#120e18");
  }
  webApp.ready?.();
  webApp.expand?.();
}

export function spinHaptic() {
  const webApp = window.Telegram?.WebApp;

  if (webApp?.isVersionAtLeast?.("6.1")) {
    webApp.HapticFeedback?.impactOccurred?.("medium");
  }
}

export function resultHaptic() {
  const webApp = window.Telegram?.WebApp;

  if (webApp?.isVersionAtLeast?.("6.1")) {
    webApp.HapticFeedback?.notificationOccurred?.("success");
  }
}
