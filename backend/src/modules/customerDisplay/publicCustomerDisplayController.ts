import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import CustomerDisplayTerminal, { ICustomerDisplayTerminal } from "../../models/CustomerDisplayTerminal";
import { emptyDisplayState } from "./displayState";
import {
  findTerminalByKey,
  getDisplayBranding,
  getDisplaySettings,
  listLiveBanners,
  toPublicSettings,
} from "./customerDisplayService";

/**
 * Customer screens have no login: they prove which counter they are with the terminal's
 * display key (sent as `x-display-key`). These endpoints return only the bill and banners.
 */

declare global {
  namespace Express {
    interface Request {
      displayTerminal?: ICustomerDisplayTerminal;
    }
  }
}

const SEEN_WRITE_INTERVAL_MS = 60 * 1000;

export const requireDisplayKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query.terminal;
    const key = req.header("x-display-key") || req.query.key;
    const terminal = await findTerminalByKey(code, key);
    if (!terminal) {
      return res.status(401).json({
        success: false,
        code: "DISPLAY_KEY_INVALID",
        message: "This display link is not valid any more. Reopen it from the POS screen.",
      });
    }
    req.displayTerminal = terminal;
    // "Last seen" for the admin terminal list, written at most once a minute per screen
    const last = terminal.lastSeenAt ? new Date(terminal.lastSeenAt).getTime() : 0;
    if (Date.now() - last > SEEN_WRITE_INTERVAL_MS) {
      CustomerDisplayTerminal.updateOne({ _id: terminal._id }, { lastSeenAt: new Date() }).catch(() => undefined);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const currentState = (terminal: ICustomerDisplayTerminal) =>
  terminal.state && typeof terminal.state === "object" ? terminal.state : emptyDisplayState(terminal.stateSeq || 0);

/** Everything a screen needs on load. */
export const getBootstrap = asyncHandler(async (req: Request, res: Response) => {
  const terminal = req.displayTerminal!;
  const settings = await getDisplaySettings();
  const [banners, branding] = await Promise.all([listLiveBanners(terminal.code), getDisplayBranding(settings)]);
  return res.json({
    success: true,
    data: {
      terminal: { code: terminal.code, name: terminal.name },
      settings: toPublicSettings(settings),
      branding,
      banners,
      contentVersion: settings.contentVersion,
      state: currentState(terminal),
    },
  });
});

export const getBanners = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getDisplaySettings();
  const banners = await listLiveBanners(req.displayTerminal!.code);
  return res.json({ success: true, data: { banners, contentVersion: settings.contentVersion } });
});

/**
 * Polling fallback (used when the same-PC channel and Socket.IO aren't available).
 * `since` = the seq the screen already shows; the state is only sent when newer.
 */
export const getState = asyncHandler(async (req: Request, res: Response) => {
  const terminal = req.displayTerminal!;
  const since = Number(req.query.since) || 0;
  const settings = await getDisplaySettings();
  const seq = terminal.stateSeq || 0;
  return res.json({
    success: true,
    data: {
      seq,
      contentVersion: settings.contentVersion,
      state: seq > since ? currentState(terminal) : null,
    },
  });
});
