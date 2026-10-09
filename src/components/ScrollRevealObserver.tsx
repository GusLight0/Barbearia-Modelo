"use client";

import { useEffect } from "react";

const revealSelector = "[data-reveal]";
const revealVisibleClass = "is-revealed";

function getRevealTargets(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) {
    return [];
  }

  const targets: HTMLElement[] = [];
  if (node.matches(revealSelector)) {
    targets.push(node);
  }
  targets.push(...node.querySelectorAll<HTMLElement>(revealSelector));
  return targets;
}

export function useScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches || typeof window.IntersectionObserver !== "function") {
      root.removeAttribute("data-reveal-ready");
      return;
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            target.classList.add(revealVisibleClass);
          } else {
            target.classList.remove(revealVisibleClass);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -4% 0px" },
    );

    const observeTarget = (target: HTMLElement) => {
      if (target.dataset.revealObserved === "true") {
        return;
      }

      target.dataset.revealObserved = "true";
      const parent = target.parentElement;
      if (parent?.hasAttribute("data-reveal-stagger")) {
        const siblings = Array.from(parent.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement && child.matches(revealSelector),
        );
        const index = siblings.indexOf(target);
        target.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 80}ms`);
      }
      intersectionObserver.observe(target);
    };

    const observeTree = (node: Node) => {
      getRevealTargets(node).forEach(observeTarget);
    };

    observeTree(document.body);
    if (document.querySelector(revealSelector)) {
      root.setAttribute("data-reveal-ready", "true");
    }

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(observeTree);
        mutation.removedNodes.forEach((node) => {
          getRevealTargets(node).forEach((target) => {
            intersectionObserver.unobserve(target);
            delete target.dataset.revealObserved;
            target.classList.remove(revealVisibleClass);
            target.style.removeProperty("--reveal-delay");
          });
        });
      }

      if (document.querySelector(revealSelector)) {
        root.setAttribute("data-reveal-ready", "true");
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      document.querySelectorAll<HTMLElement>(revealSelector).forEach((target) => {
        delete target.dataset.revealObserved;
        target.classList.remove(revealVisibleClass);
        target.style.removeProperty("--reveal-delay");
      });
      root.removeAttribute("data-reveal-ready");
    };
  }, []);
}
