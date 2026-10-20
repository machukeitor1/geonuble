import { useCallback, useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Galería tipo presentación: avanza sola cada `interval` ms con fundido cruzado.
// Se pausa con el mouse encima o el foco dentro; las flechas, miniaturas y el
// deslizamiento en pantallas táctiles reinician el tiempo.
function Slideshow({ images, title, interval = 10000 }) {
  const count = images.length;
  const [slide, setSlide] = useState({ index: 0, prev: null });
  const [paused, setPaused] = useState(false);
  const [reduceMotion] = useState(prefersReducedMotion);
  const touchX = useRef(null);
  const autoplay = count > 1 && !paused && !reduceMotion;

  const go = useCallback(
    (target) => setSlide((s) => {
      const index = (target + count) % count;
      return index === s.index ? s : { index, prev: s.index };
    }),
    [count]
  );

  // Avance automático. Depende del índice, así cada cambio (manual o no) reinicia los 10 s.
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => go(slide.index + 1), interval);
    return () => clearTimeout(timer);
  }, [autoplay, slide.index, interval, go]);

  // Precarga solo la siguiente foto para que el fundido no muestre un hueco.
  useEffect(() => {
    if (count < 2) return;
    const next = new Image();
    next.src = images[(slide.index + 1) % count].url;
  }, [slide.index, count, images]);

  if (count === 0) {
    return (
      <div className="detail-main-img">
        <div className="detail-noimg">Sin fotos</div>
      </div>
    );
  }

  return (
    <div
      className="slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
    >
      <div
        className="detail-main-img slideshow-stage"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(slide.index + (dx < 0 ? 1 : -1));
        }}
      >
        {images.map((img, i) =>
          i === slide.index || i === slide.prev ? (
            <img
              key={img.key || img.url}
              src={img.url}
              className={`slide ${i === slide.index ? "is-active" : "is-prev"}`}
              alt={i === slide.index ? `${title} - foto ${i + 1} de ${count}` : ""}
              aria-hidden={i !== slide.index}
            />
          ) : null
        )}

        {count > 1 && (
          <>
            <button type="button" className="slide-arrow slide-prev" onClick={() => go(slide.index - 1)} aria-label="Foto anterior">
              ‹
            </button>
            <button type="button" className="slide-arrow slide-next" onClick={() => go(slide.index + 1)} aria-label="Foto siguiente">
              ›
            </button>
            <span className="slide-counter">
              {slide.index + 1} / {count}
            </span>
            {autoplay && (
              <span
                key={slide.index}
                className="slide-progress"
                style={{ animationDuration: `${interval}ms` }}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </div>

      {count > 1 && (
        <div className="detail-thumbnails">
          {images.map((img, i) => (
            <button
              key={img.key || img.url}
              type="button"
              className={`thumb-btn ${i === slide.index ? "active" : ""}`}
              onClick={() => go(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === slide.index}
            >
              <img src={img.thumb || img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Slideshow;
