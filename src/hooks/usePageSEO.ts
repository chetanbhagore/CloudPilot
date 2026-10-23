import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface PageSEOMetadata {
  title: string;
  description: string;
  canonicalPath?: string;
  keywords?: string[];
}

/**
 * usePageSEO - Dynamic document title, meta description, and canonical URL manager.
 * Ensures every CloudPilot route has a unique title and contextual meta description.
 */
export function usePageSEO(meta: PageSEOMetadata) {
  const location = useLocation();

  useEffect(() => {
    // 1. Unique Title Tag
    const fullTitle = `${meta.title} — CloudPilot`;
    document.title = fullTitle;

    // 2. Meta Description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute('content', meta.description);

    // 3. Canonical Tag
    const canonicalUrl = `https://cloudpilot.io${meta.canonicalPath || location.pathname}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 4. Open Graph Tags
    const updateMeta = (property: string, content: string) => {
      let og = document.querySelector(`meta[property="${property}"]`);
      if (!og) {
        og = document.createElement('meta');
        og.setAttribute('property', property);
        document.head.appendChild(og);
      }
      og.setAttribute('content', content);
    };

    updateMeta('og:title', fullTitle);
    updateMeta('og:description', meta.description);
    updateMeta('og:url', canonicalUrl);

    // 5. Google Analytics 4 pageview emission if gtag is initialized
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
      (window as unknown as { gtag: Function }).gtag('event', 'page_view', {
        page_title: fullTitle,
        page_location: canonicalUrl,
        page_path: location.pathname,
      });
    }
  }, [meta.title, meta.description, meta.canonicalPath, location.pathname]);
}
