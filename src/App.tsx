import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import rawPlaces from "./places.json";
import { resultHaptic, spinHaptic } from "./telegram";

const DEFAULT_SPIN_DURATION_MS = 8500;

type SourcePlace = {
  name: string;
  url?: string;
  route_url?: string;
  avg_bill?: string;
  price_level?: string;
  business_lunch_price?: string;
  lat?: number;
  lon?: number;
  straight_distance_meters?: number;
  approx_walk_minutes?: number;
  has_coords?: boolean;
  yandex_walk_distance_text?: string;
  yandex_walk_distance_m?: number;
  yandex_walk_minutes?: number;
  has_yandex_walk_route?: boolean;
};

type LunchPlace = SourcePlace & {
  id: string;
};

type Phase = "idle" | "spinning" | "result";

const palette = [
  "#f35b4f",
  "#ffc857",
  "#12b8a7",
  "#ff8f4e",
  "#53a7ff",
  "#e34d9b",
  "#9d4edd",
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f9c74f",
  "#90be6d",
  "#f9844a",
  "#5d5fef",
];

// Функция для получения случайного количества оборотов (от 8 до 14)
function getRandomTurns() {
  return 8 + Math.floor(Math.random() * 7);
}

// Функция для получения случайной длительности вращения (от 8000 до 9000 мс)
function getRandomSpinDuration() {
  return 8000 + Math.floor(Math.random() * 1000);
}

const places: LunchPlace[] = (rawPlaces as SourcePlace[])
  .filter((place) => place.name && place.business_lunch_price)
  .map((place, index) => ({ ...place, id: `${place.name}-${index}` }))
  .sort(() => Math.random() - 0.5);

function randomIndex(max: number) {
  if (max < 2) {
    return 0;
  }

  if (window.crypto?.getRandomValues) {
    const value = window.crypto.getRandomValues(new Uint32Array(1))[0];
    return value % max;
  }

  return Math.floor(Math.random() * max);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function formatMeters(value?: number) {
  if (value === undefined) {
    return undefined;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".0", "")} км`;
  }

  return `${Math.round(value)} м`;
}

function formatMinutes(value?: number) {
  if (value === undefined) {
    return undefined;
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} мин`;
}

function formatCoordinate(value?: number) {
  return value === undefined ? undefined : value.toFixed(6);
}

function compactName(name: string) {
  return name.length > 20 ? `${name.slice(0, 19).trim()}...` : name;
}

function wheelGradient(count: number, segmentAngle: number) {
  const stops: string[] = [];
  for (let i = 0; i < count; i++) {
    const color = palette[i % palette.length];
    const start = i * segmentAngle;
    const end = (i + 1) * segmentAngle;
    stops.push(`${color} ${start}deg ${end}deg`);
  }
  return `conic-gradient(from ${-90 - segmentAngle / 2}deg, ${stops.join(", ")})`;
}

function App() {
  const segmentAngle = 360 / places.length;
  const wheelBackground = useMemo(
    () => wheelGradient(places.length, segmentAngle),
    [segmentAngle],
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(DEFAULT_SPIN_DURATION_MS);
  const [targetIndex, setTargetIndex] = useState<number>();
  const [winnerIndex, setWinnerIndex] = useState<number>();
  const timeoutRef = useRef<number | undefined>(undefined);

  const selectedPlace =
    winnerIndex === undefined ? undefined : places[winnerIndex];

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  function spin() {
    const nextIndex = randomIndex(places.length);
    // В системе колеса центр сектора i — это i * segmentAngle (т.к. conic-gradient
    // сдвинут на -segmentAngle/2, и подпись для индекса i стоит ровно по центру).
    const sectorCenter = nextIndex * segmentAngle;
    // Случайное смещение внутри сектора (±35% от половины ширины) — чтобы стрелка
    // не падала каждый раз ровно по центру или ровно в границу.
    const jitter = (Math.random() - 0.5) * segmentAngle * 0.7;
    const targetAngle = sectorCenter + jitter;
    const currentRotation = positiveModulo(rotation, 360);
    const winningRotation = positiveModulo(-targetAngle, 360);
    const settleDelta = positiveModulo(winningRotation - currentRotation, 360);

    const turns = getRandomTurns();
    const duration = getRandomSpinDuration();

    window.clearTimeout(timeoutRef.current);
    setTargetIndex(nextIndex);
    setWinnerIndex(undefined);
    setPhase("spinning");
    setSpinDuration(duration);
    setRotation((current) => current + turns * 360 + settleDelta);
    spinHaptic();

    timeoutRef.current = window.setTimeout(() => {
      setWinnerIndex(nextIndex);
      setPhase("result");
      resultHaptic();
    }, duration);
  }

  return (
    <LayoutGroup>
      <main className={`lunch-app phase-${phase}`}>
        <AnimatePresence>
          {phase === "idle" ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="spin-cta-stage"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="start"
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.button
                animate={{ scale: 1, y: 0 }}
                className="spin-cta"
                exit={{ scale: 0.82, y: 18 }}
                initial={{ scale: 0.82, y: 18 }}
                onClick={spin}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                type="button"
              >
                <span>Крутите барабан</span>
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== "idle" ? (
            <motion.section
              animate={{ opacity: 1 }}
              className="wheel-scene"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="wheel-scene"
              transition={{ duration: 0.45 }}
            >
              <Winner place={selectedPlace} phase={phase} onSpin={spin} />
              <div className="wheel-stage" aria-label="Колесо заведений">
                <div className="pointer" aria-hidden="true" />
                <motion.div
                  animate={{ rotate: rotation }}
                  className="wheel"
                  initial={{ rotate: 0 }}
                  style={{ backgroundImage: wheelBackground, x: "-50%" }}
                  transition={{
                    duration: spinDuration / 1000,
                    ease: [0.08, 0.88, 0.16, 1],
                  }}
                >
                  <div className="wheel-rim" aria-hidden="true" />
                  {places.map((place, index) => (
                    <WheelLabel
                      angle={index * segmentAngle}
                      index={index}
                      key={place.id}
                      place={place}
                      phase={phase}
                      selected={targetIndex === index}
                    />
                  ))}
                  <div className="wheel-hub" aria-hidden="true">
                    <span />
                  </div>
                </motion.div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>
    </LayoutGroup>
  );
}

type WinnerProps = {
  onSpin: () => void;
  phase: Phase;
  place?: LunchPlace;
};

function Winner({ onSpin, phase, place }: WinnerProps) {
  return (
    <div className="winner-zone">
      <AnimatePresence mode="wait">
        {phase === "result" && place ? (
          <motion.article
            animate={{ opacity: 1, y: 0 }}
            className="winner"
            exit={{ opacity: 0, y: -18 }}
            initial={{ opacity: 0, y: 24 }}
            key={place.id}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <button className="again-button" onClick={onSpin} type="button">
              Крутить снова
            </button>
            <motion.h1
              className="winner-name"
              layoutId={`winner-${place.id}`}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {place.name}
            </motion.h1>
            <PlaceDetails place={place} />
            <div className="place-links">
              {place.url ? (
                <a href={place.url} rel="noreferrer" target="_blank" className="place-button">
                  Карточка заведения
                </a>
              ) : null}
              {place.route_url ? (
                <a href={place.route_url} rel="noreferrer" target="_blank" className="place-button primary">
                  Маршрут
                </a>
              ) : null}
            </div>
          </motion.article>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type WheelLabelProps = {
  angle: number;
  index: number;
  phase: Phase;
  place: LunchPlace;
  selected: boolean;
};

function WheelLabel({ angle, index, phase, place, selected }: WheelLabelProps) {
  const label = (
    <span className="wheel-label-copy" title={place.name}>
      {compactName(place.name)}
    </span>
  );

  return (
    <div
      className={`wheel-label wheel-label-${index % 2}`}
      style={{
        transform: `rotate(${angle - 90}deg) translateX(calc(var(--wheel-size) * 0.235))`,
      }}
    >
      {selected && phase !== "result" ? (
        <motion.span
          className="wheel-label-flight"
          layoutId={`winner-${place.id}`}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {label}
        </motion.span>
      ) : (
        label
      )}
    </div>
  );
}

function PlaceDetails({ place }: { place: LunchPlace }) {
  const facts = [
    ["Бизнес-ланч", place.business_lunch_price],
    ["Средний чек", place.avg_bill],
    ["Ценовой уровень", place.price_level],
    ["Пешком", formatMinutes(place.yandex_walk_minutes)],
    ["Дистанция по маршруту", formatMeters(place.yandex_walk_distance_m)],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  return (
    <section className="place-details">
      <dl>
        {facts.map(([label, value]) => (
          <div className="detail-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default App;
