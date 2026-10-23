/**
 * CloudPilot Privacy-Preserving Analytics Module (Google Analytics 4 & Custom Events)
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export function initAnalytics() {
  if (typeof window === 'undefined') return;

  // Check if user has opted out of analytics
  const optOut = localStorage.getItem('cloudpilot_telemetry_opt_out');
  if (optOut === 'true') {
    return;
  }

  if (GA_ID && !window.gtag) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      anonymize_ip: true,
      send_page_view: false, // Managed by usePageSEO per route
    });
  }
}

export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window !== 'undefined' && window.gtag && localStorage.getItem('cloudpilot_telemetry_opt_out') !== 'true') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}
