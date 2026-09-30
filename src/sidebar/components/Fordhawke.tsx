// Implements: ADR 0044 (Fordhawke as a vector rig)
//
// Fordhawke drawn once, in parts, and moved by transforms: he breathes, blinks,
// his tassel sways, and a pose change moves his arms and head instead of
// swapping frames. Vector, so he is sharp at every size in Settings. Drawn
// facing left, into the conversation. Under reduced motion he holds still in
// the pose; the pose itself still changes, because it says what he's doing.
import type { MascotState } from "./Mascot";

const OUT = "#2b1b10";
const WOOL = "#f3eee4";
const WOOL_SHADE = "#e2d8c7";
const HORN = "#e1a62a";
const HORN_DARK = "#b27a17";
const HORN_LIGHT = "#f5cd62";
const COAT = "#5b3b23";
const COAT_DARK = "#462d1a";
const PANTS = "#3c2717";
const HOOF = "#8b8179";
const GOLD = "#e8b63d";
const CAP = "#3e2a1b";
const CAP_TOP = "#4e3524";

/** A limb: an outline stroke under a colour stroke, the cheapest outlined tube. */
function Limb({ d, color = COAT, w = 8 }: { d: string; color?: string; w?: number }) {
  return (
    <>
      <path d={d} stroke={OUT} strokeWidth={w + 3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={d} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

function Hand({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={4.6} fill={HOOF} stroke={OUT} strokeWidth={1.8} />
      <path d={`M${cx - 3.4} ${cy - 3.2} h6.8`} stroke="#f4efe6" strokeWidth={2.2} strokeLinecap="round" />
    </>
  );
}

export default function Fordhawke({ pose, still, label }: { pose: MascotState; still: boolean; label?: string }) {
  return (
    <svg
      viewBox="0 -10 120 160"
      className="fh"
      data-pose={pose}
      data-still={still ? "" : undefined}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id="fh-ball" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#c9d8ff" />
          <stop offset="1" stopColor="#6b5bd6" />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="145.5" rx="27" ry="3.4" fill="#000" opacity="0.13" />

      <g className="fh-body">
        {/* backpack, behind everything */}
        <path d="M77 73 h11 a9 9 0 0 1 9 9 v23 a7 7 0 0 1 -7 7 h-13 z" fill="#7b5331" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
        <path d="M84 88 h11 v8 a3 3 0 0 1 -3 3 h-8 z" fill="#8f633c" stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />

        {/* legs */}
        <g className="fh-leg fh-leg-a">
          <rect x="45" y="110" width="12.5" height="27" rx="4" fill={PANTS} stroke={OUT} strokeWidth="2" />
          <path d="M41 136.5 a4 4 0 0 1 4 -3.5 h12 a3 3 0 0 1 3 3 v4 h-19 z" fill={HOOF} stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
        </g>
        <g className="fh-leg fh-leg-b">
          <rect x="62" y="110" width="12.5" height="27" rx="4" fill={PANTS} stroke={OUT} strokeWidth="2" />
          <path d="M59 136.5 a4 4 0 0 1 4 -3.5 h12 a3 3 0 0 1 3 3 v4 h-19 z" fill={HOOF} stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
        </g>

        {/* back arm: hangs, or reaches round to hold a prop */}
        <g className="fh-part fh-arm-back-down">
          <Limb d="M79 74 q8 8 8 22 v10" color={COAT_DARK} />
          <Hand cx={87} cy={110} />
        </g>
        <g className="fh-part fh-arm-back-hold">
          <Limb d="M79 74 q6 12 -4 22 l-14 3" color={COAT_DARK} />
          <Hand cx={60} cy={99} />
        </g>

        {/* blazer */}
        <path d="M40 72 C44 63 76 63 80 72 L84 113 C70 119 50 119 36 113 Z" fill={COAT} stroke={OUT} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M51.5 66 L60 87 L68.5 66 Z" fill="#f5f0e7" />
        <path d="M58.4 68 h3.2 l1.6 19 l-3.2 4 l-3.2 -4 z" fill="#9b6731" stroke={OUT} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M51.5 66 L60 87 L49 81 L45.5 69 Z" fill={COAT_DARK} stroke={OUT} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M68.5 66 L60 87 L71 81 L74.5 69 Z" fill={COAT_DARK} stroke={OUT} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M68 90 h6.5 v2.4 h-4 v2 h3.2 v2.3 h-3.2 v4.3 h-2.5 z" fill={GOLD} />
        <circle cx="60.3" cy="100" r="1.4" fill={OUT} />
        <circle cx="60.3" cy="107" r="1.4" fill={OUT} />

        {/* props, held in front of the blazer */}
        <g className="fh-part fh-scroll">
          <path d="M31 83 h32 v19 h-32 z" fill="#f4e4bf" stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M36 88 h22 M36 92 h18 M36 96 h20" stroke="#b69a6a" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="28" y="81" width="5" height="23" rx="2.5" fill="#e8d3a2" stroke={OUT} strokeWidth="1.6" />
          <rect x="61" y="81" width="5" height="23" rx="2.5" fill="#e8d3a2" stroke={OUT} strokeWidth="1.6" />
        </g>
        <g className="fh-part fh-ball">
          <path d="M36 106 h18 l-3 6 h-12 z" fill="#6e4a2b" stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />
          <circle className="fh-ball-glow" cx="45" cy="95" r="15" fill="#b9b0ff" opacity="0.35" />
          <circle cx="45" cy="95" r="11" fill="url(#fh-ball)" stroke={OUT} strokeWidth="1.8" />
          <path className="fh-spark" d="M49 88 l1 2.4 l2.4 1 l-2.4 1 l-1 2.4 l-1 -2.4 l-2.4 -1 l2.4 -1 z" fill="#fff" />
        </g>

        {/* front arm: one variant per pose */}
        <g className="fh-part fh-arm-down">
          <Limb d="M42 74 q-8 8 -8 22 v10" />
          <Hand cx={34} cy={110} />
        </g>
        <g className="fh-part fh-arm-wave">
          <g className="fh-wave">
            <Limb d="M42 75 q-17 -6 -22 -33" />
            <Hand cx={20} cy={39} />
          </g>
        </g>
        <g className="fh-part fh-arm-chin">
          <Limb d="M43 76 q-14 6 -12 -4 q1 -6 5 -10" />
          <Hand cx={36} cy={61} />
        </g>
        <g className="fh-part fh-arm-hold">
          <Limb d="M42 75 q-10 10 -11 21" />
          <Hand cx={31} cy={99} />
        </g>

        {/* head */}
        <g className="fh-head">
          <g transform="translate(60 64) scale(1.24) translate(-60 -64)">
          <path
            d="M67 28 C83 13 107 24 104 48 C102 62 89 69 79.5 63 C72.5 58.5 75 47.5 84 46.5 C89 46 91.5 50.5 89 54 C87 52 84.5 51 82.8 52.4 C80.8 54.2 81.6 57.4 84.6 58.4 C90.6 60.4 96.6 55 96.6 46 C96.6 31.5 84 25.5 73 33.5 Z"
            fill={HORN}
            stroke={OUT}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M74 26.5 C86 20 100 28 100.5 42" stroke={HORN_LIGHT} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M84 21.5 l-3 7 M95.5 27.5 l-5.5 5 M102.5 40 l-6.5 1.6 M101.5 54 l-6 -2.4 M91.5 63.5 l-2.2 -5.2" stroke={HORN_DARK} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M76 44 C85 41 93 47 89 52 C85 55 79 53 76 49 Z" fill={WOOL} stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M78.5 46.5 C84 45.5 88 48.5 86.5 50.5" stroke="#e7c3b0" strokeWidth="2" strokeLinecap="round" fill="none" />

          <path d="M50 25 C65 21 79 30 79 44 C79 56 71 64 59 64 L45 64 C33 64 24.5 58.5 25.5 51.5 C26.5 45 34 42 40 40.5 C40 32.5 44 27 50 25 Z" fill={WOOL} stroke={OUT} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M60 57 C66 58 72 55 74 49" stroke={WOOL_SHADE} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M42 29 C35 23 27 29 30 37" stroke={OUT} strokeWidth="8.4" strokeLinecap="round" fill="none" />
          <path d="M42 29 C35 23 27 29 30 37" stroke={HORN} strokeWidth="5.4" strokeLinecap="round" fill="none" />

          <g className="fh-eyes">
            <ellipse cx="47.5" cy="42.5" rx="5.4" ry="6.4" fill="#fff" stroke={OUT} strokeWidth="1.6" />
            <ellipse cx="62" cy="40.5" rx="4.6" ry="5.8" fill="#fff" stroke={OUT} strokeWidth="1.6" />
            <g className="fh-pupils">
              <circle cx="46" cy="43.5" r="2.9" fill={OUT} />
              <circle cx="60.6" cy="41.6" r="2.5" fill={OUT} />
              <circle cx="45" cy="42.3" r="0.95" fill="#fff" />
              <circle cx="59.7" cy="40.5" r="0.8" fill="#fff" />
            </g>
          </g>
          <path className="fh-brows" d="M42 34.5 q5 -3.4 10 -1.2 M57.5 32.5 q4.4 -2.6 9 -0.4" stroke={OUT} strokeWidth="1.9" strokeLinecap="round" fill="none" />
          <ellipse cx="30.2" cy="51.6" rx="1.5" ry="1.1" fill={OUT} />
          <path d="M33 57.5 q6.5 4.4 13.5 1" stroke={OUT} strokeWidth="1.7" strokeLinecap="round" fill="none" />

          <g className="fh-cap">
            <path d="M43.5 31 C50 22.5 72 22.5 78.5 31 L77.5 37.5 C70 31 52 31 44.5 37.5 Z" fill={CAP} stroke={OUT} strokeWidth="1.9" strokeLinejoin="round" />
            <path d="M58.5 30.4 h4.4 v1.7 h-2.7 v1.4 h2.2 v1.6 h-2.2 v3 h-1.7 z" fill={GOLD} />
            <path d="M27 21.5 L60.5 10.5 L95 19.5 L62 31 Z" fill={CAP_TOP} stroke={OUT} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M33 21.8 L60.5 13 L88 20" stroke="#6a4a33" strokeWidth="1.3" strokeLinecap="round" fill="none" />
            <g className="fh-tassel">
              <path d="M61 20 Q73 21.5 80 25.5 L80.5 35" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path d="M78 34.5 l2.6 8 l2.6 -8 z" fill={GOLD} stroke={HORN_DARK} strokeWidth="0.8" strokeLinejoin="round" />
            </g>
            <circle cx="61" cy="20" r="1.8" fill={GOLD} stroke={OUT} strokeWidth="0.8" />
          </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
