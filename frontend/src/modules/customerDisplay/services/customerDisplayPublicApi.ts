import axios, { AxiosError } from 'axios';
import { getApiBaseURL } from '../../../services/api/config';
import type { DisplayBranding, DisplaySettingsPublic, DisplayState, LiveBanner } from '../sync/displayTypes';
import { UnauthorizedDisplayError, type ServerPoll } from '../sync/displayChannel';

/**
 * Customer screen API. Uses its own axios instance on purpose: it must never send the
 * admin token or trigger the admin login redirect. It authenticates with the terminal's
 * display key only.
 */

export interface DisplayBootstrap {
  terminal: { code: string; name: string };
  settings: DisplaySettingsPublic;
  branding: DisplayBranding;
  banners: LiveBanner[];
  contentVersion: number;
  state: DisplayState;
}

const client = (key: string) =>
  axios.create({
    baseURL: getApiBaseURL(),
    timeout: 10000,
    headers: { 'x-display-key': key },
  });

const unwrap = async <T>(request: Promise<{ data: { success: boolean; data: T; message?: string } }>): Promise<T> => {
  try {
    const res = await request;
    return res.data.data;
  } catch (err) {
    if ((err as AxiosError)?.response?.status === 401) throw new UnauthorizedDisplayError('Display key not valid');
    throw err;
  }
};

export const fetchDisplayBootstrap = (terminal: string, key: string) =>
  unwrap<DisplayBootstrap>(client(key).get('/customer-display/bootstrap', { params: { terminal } }));

export const fetchDisplayBanners = (terminal: string, key: string) =>
  unwrap<{ banners: LiveBanner[]; contentVersion: number }>(client(key).get('/customer-display/banners', { params: { terminal } }));

export const fetchDisplayState = (terminal: string, key: string, since: number) =>
  unwrap<ServerPoll>(client(key).get('/customer-display/state', { params: { terminal, since } }));
