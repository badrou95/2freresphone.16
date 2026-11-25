import { getSaasConfig, SaasFeaturesConfig } from '../shared/domain';
import { SocialLinkItem } from '../types';

export interface PixelEventPayload {
  contentName?: string;
  contentId?: string | number;
  valueDzd?: number;
  currency?: string;
  quantity?: number;
  // Standard Meta/TikTok convenience fields
  content_name?: string;
  content_id?: string | number;
  content_ids?: string[];
  value?: number;
  num_items?: number;
  order_reference?: string;
}

export interface TrackedPixelEventEntry {
  event: string;
  timestamp: string;
  currency: string;
  contentName?: string;
  contentId?: string | number;
  valueDzd?: number;
  quantity?: number;
}

function getEffectivePixelIds(
  socialLinksOrConfig?: SocialLinkItem[] | SaasFeaturesConfig,
): {
  metaPixelId: string;
  tiktokPixelId: string;
  snapchatPixelId: string;
  googleTagId: string;
} {
  const cfg: SaasFeaturesConfig =
    socialLinksOrConfig && !Array.isArray(socialLinksOrConfig)
      ? socialLinksOrConfig
      : getSaasConfig();

  let metaPixelId = (cfg.metaPixelId || '').trim();
  let tiktokPixelId = (cfg.tiktokPixelId || '').trim();
  let snapchatPixelId = (cfg.snapchatPixelId || '').trim();
  const googleTagId = (cfg.googleTagId || '').trim();

  if (Array.isArray(socialLinksOrConfig)) {
    for (const s of socialLinksOrConfig) {
      if (!s.isActive || !s.pixelId) continue;
      const pid = s.pixelId.trim();
      if (!pid) continue;
      if ((s.platform === 'facebook' || s.platform === 'instagram') && !metaPixelId) {
        metaPixelId = pid;
      } else if (s.platform === 'tiktok' && !tiktokPixelId) {
        tiktokPixelId = pid;
      } else if (s.platform === 'snapchat' && !snapchatPixelId) {
        snapchatPixelId = pid;
      }
    }
  }

  return { metaPixelId, tiktokPixelId, snapchatPixelId, googleTagId };
}

export function initStoreAdPixels(
  socialLinksOrConfig?: SocialLinkItem[] | SaasFeaturesConfig,
): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  const { metaPixelId, tiktokPixelId, snapchatPixelId, googleTagId } =
    getEffectivePixelIds(socialLinksOrConfig);

  // Meta (Facebook) Pixel
  if (metaPixelId && !w.__2fp_meta_pixel_init) {
    w.__2fp_meta_pixel_init = metaPixelId;
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: any[]) {
        if (n.callMethod) n.callMethod.apply(n, args);
        else n.queue.push(args);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
    try {
      w.fbq('init', metaPixelId);
      w.fbq('track', 'PageView');
    } catch {
      // ignore adblock
    }
  }

  // TikTok Pixel
  if (tiktokPixelId && !w.__2fp_tiktok_pixel_init) {
    w.__2fp_tiktok_pixel_init = tiktokPixelId;
    try {
      w.ttq = w.ttq || [];
      if (typeof w.ttq.page === 'function') {
        w.ttq.page();
      }
    } catch {
      // ignore
    }
  }

  // Snapchat Pixel
  if (snapchatPixelId && !w.__2fp_snap_pixel_init) {
    w.__2fp_snap_pixel_init = snapchatPixelId;
  }

  // Google Tag (GA4 / Ads)
  if (googleTagId && !w.__2fp_gtag_init) {
    w.__2fp_gtag_init = googleTagId;
    w.dataLayer = w.dataLayer || [];
    w.gtag =
      w.gtag ||
      function (...args: any[]) {
        w.dataLayer.push(args);
      };
    w.gtag('js', new Date());
    w.gtag('config', googleTagId);
  }
}

export function trackAdPixelEvent(
  eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase',
  payload: PixelEventPayload = {},
  _saasConfig?: SaasFeaturesConfig,
): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  const value = Number(payload.valueDzd ?? payload.value) || 0;
  const currency = payload.currency || 'DZD';
  const contentName = payload.contentName || payload.content_name;
  const contentId =
    payload.contentId ||
    payload.content_id ||
    (payload.content_ids && payload.content_ids.length > 0 ? payload.content_ids[0] : undefined);
  const quantity = Number(payload.quantity ?? payload.num_items) || 1;

  // Record in local log for Admin Pixel Debugger inspection
  try {
    const historyRaw = sessionStorage.getItem('2fp_pixel_events_log');
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift({
      event: eventName,
      contentName,
      contentId,
      valueDzd: value,
      quantity,
      currency,
      timestamp: new Date().toISOString(),
    });
    sessionStorage.setItem('2fp_pixel_events_log', JSON.stringify(history.slice(0, 30)));
  } catch {
    // ignore
  }

  // Meta Pixel
  try {
    if (typeof w.fbq === 'function') {
      w.fbq('track', eventName, {
        content_name: contentName,
        content_ids: payload.content_ids || (contentId ? [String(contentId)] : undefined),
        content_type: 'product',
        value,
        currency,
        num_items: quantity,
      });
    }
  } catch {
    // ignore
  }

  // TikTok Pixel
  try {
    if (w.ttq && typeof w.ttq.track === 'function') {
      const ttEvent = eventName === 'Purchase' ? 'CompletePayment' : eventName;
      w.ttq.track(ttEvent, {
        content_name: contentName,
        content_id: contentId ? String(contentId) : undefined,
        value,
        currency,
        quantity,
      });
    }
  } catch {
    // ignore
  }

  // Google Tag
  try {
    if (typeof w.gtag === 'function') {
      w.gtag('event', eventName, {
        currency,
        value,
        items: [
          {
            item_id: String(contentId || ''),
            item_name: contentName || 'Produit 2Frères Phone',
            quantity,
            price: value,
          },
        ],
      });
    }
  } catch {
    // ignore
  }
}

export function getTrackedPixelEventsLog(): TrackedPixelEventEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem('2fp_pixel_events_log');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearTrackedPixelEventsLog(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('2fp_pixel_events_log');
  } catch {
    // ignore
  }
}
