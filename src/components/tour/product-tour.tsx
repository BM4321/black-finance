"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import SchoolRounded from "@mui/icons-material/SchoolRounded";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  parseTourProgress,
  TOUR_STEPS,
  tourStorageKey,
  type TourProgress,
  type TourStep,
} from "@/lib/ui/tour";

type TourControls = { start: () => void; active: boolean };

const TourContext = createContext<TourControls | null>(null);

/** Start or check the guided tour from anywhere inside the app shell. */
export function useTour(): TourControls {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour must be used inside <TourProvider>");
  return value;
}

function readProgress(key: string): TourProgress | null {
  try {
    return parseTourProgress(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeProgress(key: string, progress: TourProgress): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // Storage blocked: the tour still works for this visit.
  }
}

/**
 * Guided tour for new users.
 *
 * Highlights one element per step (by its `data-tour` marker), explains what
 * to click or fill in, and moves between pages on Next/Back. Progress is saved
 * per user, so the tour resumes after a reload, and it starts by itself for
 * accounts created in the last two weeks until it is finished or skipped.
 *
 * The dimmed backdrop never blocks the page: the user can click the
 * highlighted button themselves, and when that takes them to the page of a
 * following step, the tour jumps ahead to it.
 */
export function TourProvider({
  userId,
  autoStart,
  steps = TOUR_STEPS,
  children,
}: {
  userId: string;
  autoStart: boolean;
  /** The tour's steps; defaults to the product tour. */
  steps?: readonly TourStep[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const key = tourStorageKey(userId);
  const [index, setIndex] = useState<number | null>(null);

  // Resume a tour in progress, or auto-start for a new user. Deferred to a
  // frame so the page paints first and the server markup matches.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = readProgress(key);
      if (saved?.status === "active") setIndex(Math.min(saved.index, steps.length - 1));
      else if (!saved && autoStart) {
        writeProgress(key, { status: "active", index: 0 });
        setIndex(0);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [key, autoStart, steps.length]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(next);
      writeProgress(key, { status: "active", index: next });
      const target = steps[next].path;
      if (target !== window.location.pathname) router.push(target);
    },
    [key, router, steps],
  );

  const finish = useCallback(() => {
    setIndex(null);
    writeProgress(key, { status: "done", index: 0 });
  }, [key]);

  const start = useCallback(() => goTo(0), [goTo]);

  // The user navigated on their own (e.g. clicked the highlighted "Add
  // account"): if that lands on the page of one of the next few steps, jump
  // there so the tour keeps pace instead of pulling them back.
  useEffect(() => {
    if (index === null || steps[index].path === pathname) return;
    const ahead = steps.findIndex(
      (step, i) => i > index && i <= index + 4 && step.path === pathname,
    );
    if (ahead === -1) return;
    const frame = requestAnimationFrame(() => {
      setIndex(ahead);
      writeProgress(key, { status: "active", index: ahead });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, index, key, steps]);

  const controls = useMemo(() => ({ start, active: index !== null }), [start, index]);

  return (
    <TourContext.Provider value={controls}>
      {children}
      {index !== null && (
        <TourOverlay
          step={steps[index]}
          index={index}
          total={steps.length}
          onPage={steps[index].path === pathname}
          onBack={() => goTo(index - 1)}
          onNext={() => {
            // Off the step's page, the main button takes the user there first.
            if (steps[index].path !== pathname) goTo(index);
            else if (index === steps.length - 1) finish();
            else goTo(index + 1);
          }}
          onClose={finish}
        />
      )}
    </TourContext.Provider>
  );
}

/** First visible element carrying one of the step's markers. */
function findTarget(targets: readonly string[]): HTMLElement | null {
  for (const id of targets) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return element;
    }
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };

const PAD = 8;
const GAP = 14;
const CARD_WIDTH = 360;
const CARD_HEIGHT_ESTIMATE = 250;

/** Where the step card sits: beside a tall target, else below or above it. */
function cardPosition(box: Box | null, vw: number, vh: number) {
  const width = Math.min(CARD_WIDTH, vw - 32);
  if (!box) {
    return { width, left: (vw - width) / 2, top: Math.max(16, vh / 2 - CARD_HEIGHT_ESTIMATE / 2) };
  }
  const clampLeft = (left: number) => Math.min(Math.max(16, left), vw - width - 16);
  const clampTop = (top: number) =>
    Math.min(Math.max(16, top), Math.max(16, vh - CARD_HEIGHT_ESTIMATE - 16));

  if (box.height > vh * 0.5 && box.left + box.width + GAP + width + 16 <= vw) {
    return { width, left: box.left + box.width + GAP, top: clampTop(box.top + 24) };
  }
  const left = clampLeft(box.left + box.width / 2 - width / 2);
  if (vh - (box.top + box.height) - GAP >= CARD_HEIGHT_ESTIMATE) {
    return { width, left, top: box.top + box.height + GAP };
  }
  if (box.top - GAP >= CARD_HEIGHT_ESTIMATE) {
    return { width, left, bottom: vh - box.top + GAP };
  }
  return { width, left, top: clampTop(vh - CARD_HEIGHT_ESTIMATE - 16) };
}

function TourOverlay({
  step,
  index,
  total,
  onPage,
  onBack,
  onNext,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  onPage: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ vw: 1024, vh: 768 });
  const nextRef = useRef<HTMLButtonElement>(null);

  // Track the target every frame: pages load, scroll and resize under the
  // tour, and the spotlight should glide along with its element.
  useEffect(() => {
    let frame = 0;
    let scrolled = false;
    const tick = () => {
      const element = onPage ? findTarget(step.targets) : null;
      if (element && !scrolled) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        scrolled = true;
      }
      const rect = element?.getBoundingClientRect();
      setBox((previous) => {
        if (!rect) return null;
        const next = {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
        return previous &&
          previous.top === next.top &&
          previous.left === next.left &&
          previous.width === next.width &&
          previous.height === next.height
          ? previous
          : next;
      });
      setViewport((previous) =>
        previous.vw === window.innerWidth && previous.vh === window.innerHeight
          ? previous
          : { vw: window.innerWidth, vh: window.innerHeight },
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, onPage]);

  // Keep keyboard users on the tour controls, and let Escape end it.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [step.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const last = index === total - 1;
  const position = cardPosition(box, viewport.vw, viewport.vh);

  return (
    <>
      {/* Spotlight: a rounded hole in a dimmed page. Never blocks clicks. */}
      {box ? (
        <div
          aria-hidden="true"
          className="tour-spotlight"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden="true" className="tour-backdrop" />
      )}

      <Paper
        key={step.id}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        variant="outlined"
        className="animate-scale-in"
        sx={{
          position: "fixed",
          zIndex: 1401,
          p: 2.5,
          borderRadius: "18px",
          bgcolor: "background.paper",
          boxShadow: "var(--shadow)",
          transition: "top 300ms cubic-bezier(0.22, 1, 0.36, 1), left 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        style={position}
      >
        <div className="flex items-start justify-between gap-2">
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            Step {index + 1} of {total}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close the tour" sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </div>
        <Typography id="tour-title" component="h2" variant="h6" sx={{ mt: 0.5, fontSize: 17 }}>
          {step.title}
        </Typography>
        <Typography id="tour-body" variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
          {step.body}
        </Typography>

        <LinearProgress
          variant="determinate"
          value={((index + 1) / total) * 100}
          aria-hidden="true"
          sx={{ mt: 2, height: 4 }}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="small" onClick={onClose}>
            {last ? "Close" : "Skip tour"}
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" size="small" onClick={onBack}>
                Back
              </Button>
            )}
            <Button ref={nextRef} size="small" onClick={onNext}>
              {!onPage ? "Take me there" : last ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </Paper>
    </>
  );
}

/**
 * "Take the tour" row for the sidebar and the mobile menu. Also the last
 * step's target, so the tour ends by showing where to replay it.
 */
export function TourLauncher({
  labelClassName,
  onStart,
}: {
  labelClassName?: string;
  onStart?: () => void;
}) {
  const { start } = useTour();
  return (
    <ListItemButton
      component="button"
      type="button"
      data-tour="tour-restart"
      onClick={() => {
        onStart?.();
        start();
      }}
      aria-label="Take the tour"
      title="Take the tour"
      sx={{ minHeight: 40, px: 1.5, gap: 1.5, width: "100%" }}
    >
      <ListItemIcon sx={{ minWidth: 0, color: "text.secondary" }}>
        <SchoolRounded fontSize="small" />
      </ListItemIcon>
      <ListItemText
        className={labelClassName}
        primary="Take the tour"
        slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}
      />
    </ListItemButton>
  );
}
