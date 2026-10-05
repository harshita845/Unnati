import { useEffect, useState } from 'react';
import type { SellerNotification } from './useSellerSocket';

/** Fired on window by SellerLayout for every order notification from the server. */
export const SELLER_ORDER_UPDATE_EVENT = 'seller-order-update';

export const broadcastSellerOrderUpdate = (notification: SellerNotification) => {
  window.dispatchEvent(new CustomEvent(SELLER_ORDER_UPDATE_EVENT, { detail: notification }));
};

/**
 * Returns a counter that increases whenever an order changes (new order, accepted,
 * picked up, ...). Add it to a fetch effect's dependencies to keep a page live.
 * With `orderId`, only changes to that order count. `pollMs` adds a quiet safety
 * refresh while the tab is visible, in case a socket message was missed.
 */
export function useSellerOrderUpdates(orderId?: string, pollMs?: number) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const notification = (event as CustomEvent<SellerNotification>).detail;
      if (!orderId || String(notification?.orderId) === String(orderId)) setTick((t) => t + 1);
    };
    window.addEventListener(SELLER_ORDER_UPDATE_EVENT, onUpdate);
    const timer = pollMs
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') setTick((t) => t + 1);
        }, pollMs)
      : undefined;
    return () => {
      window.removeEventListener(SELLER_ORDER_UPDATE_EVENT, onUpdate);
      if (timer) window.clearInterval(timer);
    };
  }, [orderId, pollMs]);

  return tick;
}
