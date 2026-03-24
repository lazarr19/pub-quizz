"use client";

import React, {
  useEffect,
  useRef,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function RevealSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

export function RevealChildren({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const items = el.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-stagger ${className}`}>
      {addRevealToChildren(children)}
    </div>
  );
}

function addRevealToChildren(children: ReactNode): ReactNode {
  let i = 0;
  return Children.map(children, (child: ReactNode) => {
    if (isValidElement(child)) {
      const idx = i++;
      return cloneElement(
        child as React.ReactElement<Record<string, unknown>>,
        {
          className:
            `${(child as React.ReactElement<{ className?: string }>).props.className || ""} reveal`.trim(),
          style: {
            ...((child as React.ReactElement<{ style?: React.CSSProperties }>)
              .props.style || {}),
            "--i": idx,
          } as React.CSSProperties,
        },
      );
    }
    return child;
  });
}
