import { useEffect, useRef, useState } from "react";
import { Icon } from "./components/ui";
import { currentTheme, motionEnabled, setMotion, setTheme, THEMES } from "./themes";

const ar = () => document.documentElement.lang !== "en";

/** Glass appearance control: theme, language and background motion. */
export function Preferences() {
  const [open, setOpen] = useState(false);
  const [theme, setThemeId] = useState(currentTheme().id);
  const [motion, setMotionOn] = useState(motionEnabled());
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const language = (next: string) => {
    if (next === document.documentElement.lang) return;
    localStorage.setItem("gp-language", next);
    window.location.reload();
  };

  return (
    <div className="appearance" ref={anchor}>
      <button
        className="icon-button"
        aria-label={ar() ? "المظهر واللغة" : "Appearance and language"}
        title={ar() ? "المظهر واللغة" : "Appearance and language"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="palette" />
      </button>
      {open && (
        <div className="appearance-panel glass">
          <h3>{ar() ? "اختر مظهرك" : "Choose your look"}</h3>
          <p>{ar() ? "لكل مظهر خلفية ثلاثية الأبعاد خاصة به." : "Every theme has its own 3D scene."}</p>
          <div className="theme-grid" role="radiogroup" aria-label={ar() ? "المظهر" : "Theme"}>
            {THEMES.map((item) => (
              <button
                key={item.id}
                role="radio"
                aria-checked={theme === item.id}
                className={theme === item.id ? "theme-card active" : "theme-card"}
                style={{
                  background: `radial-gradient(circle at 75% 15%, ${item.tokens["orb-a"]}, transparent 70%), ${item.tokens.bg}`,
                }}
                onClick={() => {
                  setTheme(item.id);
                  setThemeId(item.id);
                }}
              >
                <i
                  style={{
                    background: `linear-gradient(140deg, ${item.tokens["accent-strong"]}, ${item.tokens.accent} 45%, ${item.tokens["accent-deep"]})`,
                  }}
                />
                <span>{ar() ? item.ar : item.en}</span>
                {theme === item.id && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
          <div className="appearance-row">
            <span>{ar() ? "الخلفية المتحركة" : "Animated background"}</span>
            <button
              role="switch"
              aria-checked={motion}
              aria-label={ar() ? "الخلفية المتحركة" : "Animated background"}
              className={motion ? "switch on" : "switch"}
              onClick={() => {
                setMotion(!motion);
                setMotionOn(!motion);
              }}
            >
              <i />
            </button>
          </div>
          <div className="appearance-row">
            <span>{ar() ? "اللغة" : "Language"}</span>
            <div className="segmented">
              <button className={ar() ? "active" : ""} onClick={() => language("ar")}>
                العربية
              </button>
              <button className={ar() ? "" : "active"} onClick={() => language("en")}>
                English
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
