import { useEffect } from 'react';

/** Per-page title + description for crawlable public pages (SPA has one index.html). */
export function usePageMeta(title: string, description: string, path: string) {
  useEffect(() => {
    document.title = title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (tag) tag.setAttribute('content', description);
    let canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', `https://amcat-practice.antideploy.app${path}`);
    return () => {
      document.title = 'Free Concentrix AMCAT Mock Test Practice 2026 – SVAR & Typing';
      if (tag)
        tag.setAttribute(
          'content',
          'Free Concentrix AMCAT practice: timed mock tests in English, Quant, Logical & Customer Service, SVAR speaking lab, typing arena and explained answers.'
        );
      if (canon) canon.setAttribute('href', 'https://amcat-practice.antideploy.app/');
    };
  }, [title, description, path]);
}
