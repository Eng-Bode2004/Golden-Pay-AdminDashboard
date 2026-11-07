import { useCallback, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./ui";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: number | null;
}

/**
 * Navigation with a single frosted lens that slides under the pointer and
 * settles back on the active page, so moving between icons feels like glass
 * travelling across the bar.
 */
export function GlassNav({
  items,
  label,
  className,
  iconOnly = false,
}: {
  items: NavItem[];
  label: string;
  className: string;
  iconOnly?: boolean;
}) {
  const nav = useRef<HTMLElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const location = useLocation();

  const place = useCallback((target: HTMLElement | null | undefined) => {
    const element = lens.current;
    if (!element) return;
    element.style.opacity = target ? "1" : "0";
    if (!target) return;
    const firstPlacement = !element.style.width;
    if (firstPlacement) element.style.transition = "none";
    element.style.width = `${target.offsetWidth}px`;
    element.style.height = `${target.offsetHeight}px`;
    element.style.transform = `translate3d(${target.offsetLeft}px, ${target.offsetTop}px, 0)`;
    if (firstPlacement) requestAnimationFrame(() => (element.style.transition = ""));
  }, []);

  const settle = useCallback(() => {
    place(nav.current?.querySelector<HTMLElement>("a.active"));
  }, [place]);

  useLayoutEffect(() => {
    settle();
    const observer = new ResizeObserver(settle);
    if (nav.current) observer.observe(nav.current);
    void document.fonts?.ready.then(settle);
    // Links can arrive after the first paint (e.g. owner-only items); settle once layout is final.
    const frame = requestAnimationFrame(settle);
    window.addEventListener("resize", settle);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", settle);
    };
  }, [settle, location.pathname, items.length]);

  return (
    <nav
      ref={nav}
      className={className}
      aria-label={label}
      onPointerLeave={settle}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        lens.current?.style.setProperty("--lens-x", `${event.clientX - box.left}px`);
        lens.current?.style.setProperty("--lens-y", `${event.clientY - box.top}px`);
      }}
      onBlur={settle}
    >
      <span className="glass-lens" ref={lens} aria-hidden="true" />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          title={iconOnly ? item.label : undefined}
          aria-label={iconOnly ? item.label : undefined}
          data-label={iconOnly ? item.label : undefined}
          onPointerEnter={(event) => place(event.currentTarget)}
          onFocus={(event) => place(event.currentTarget)}
        >
          <Icon name={item.icon} size={iconOnly ? 20 : 17} />
          {!iconOnly && <span>{item.label}</span>}
          {!!item.badge && <b className="nav-badge">{item.badge}</b>}
        </NavLink>
      ))}
    </nav>
  );
}
