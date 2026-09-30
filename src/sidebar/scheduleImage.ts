// The week as a picture for the advisor email. A link can prefill Gmail's text
// but can't attach a file, so the picture goes to the clipboard and the student
// pastes it into the draft. Drawn from the same layout as the on-screen grid,
// always in light colours, because an email is read on white.
import { layoutWeek, type GridConflict, type GridItem } from "./weekLayout";
import { DAY_SHORT } from "./meetingFormat";

const W = 720;
const TOP = 84;
const GUTTER = 48;
const HOUR = 46;
const PAD = 24;
const INK = "#1c1917";
const INK_3 = "#57534e";
const LINE = "#e2dfdc";
const MAROON = "#6B1A1A";
const FONT = '"Hanken Grotesk", system-ui, sans-serif';

function clock(min: number): string {
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min % 60).padStart(2, "0")}`;
}

function hourLabel(min: number): string {
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

export async function scheduleImage(
  items: GridItem[],
  conflicts: GridConflict[],
  title: string,
  subtitle: string
): Promise<Blob> {
  await document.fonts?.ready;
  const l = layoutWeek(items, conflicts);
  const hours = (l.endMin - l.startMin) / 60;
  const H = TOP + hours * HOUR + PAD + 28;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas unavailable");
  g.scale(scale, scale);

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  g.fillStyle = INK;
  g.font = `600 20px ${FONT}`;
  g.fillText(title, PAD, 34);
  g.fillStyle = INK_3;
  g.font = `400 13px ${FONT}`;
  g.fillText(subtitle, PAD, 54);

  const gridLeft = PAD + GUTTER;
  const gridW = W - gridLeft - PAD;
  const col = gridW / l.days.length;
  const y = (min: number) => TOP + ((min - l.startMin) / 60) * HOUR;

  g.font = `600 12px ${FONT}`;
  g.fillStyle = INK_3;
  l.days.forEach((d, i) => {
    g.textAlign = "center";
    g.fillText(DAY_SHORT[d], gridLeft + col * i + col / 2, TOP - 10);
  });
  g.textAlign = "right";
  g.font = `400 11px ${FONT}`;
  g.strokeStyle = LINE;
  g.lineWidth = 1;
  for (let h = 0; h <= hours; h++) {
    const yy = Math.round(TOP + h * HOUR) + 0.5;
    g.beginPath();
    g.moveTo(gridLeft, yy);
    g.lineTo(W - PAD, yy);
    g.stroke();
    if (h < hours) g.fillText(hourLabel(l.startMin + h * 60), gridLeft - 8, yy + 4);
  }
  for (let i = 1; i < l.days.length; i++) {
    const xx = Math.round(gridLeft + col * i) + 0.5;
    g.beginPath();
    g.moveTo(xx, TOP);
    g.lineTo(xx, TOP + hours * HOUR);
    g.stroke();
  }

  g.textAlign = "left";
  for (const b of l.blocks) {
    const x = gridLeft + col * l.days.indexOf(b.day) + (col / b.lanes) * b.lane + 2;
    const w = col / b.lanes - 4;
    const top = y(b.start) + 1;
    const h = Math.max(y(b.end) - y(b.start) - 2, 14);
    g.fillStyle = b.clash ? "rgba(220,38,38,0.12)" : b.registered ? "#efedea" : "rgba(107,26,26,0.10)";
    g.strokeStyle = b.clash ? "rgba(220,38,38,0.6)" : b.registered ? "#cdc9c5" : "rgba(107,26,26,0.35)";
    g.beginPath();
    g.roundRect(x, top, w, h, 5);
    g.fill();
    g.stroke();
    g.fillStyle = b.clash ? "#b91c1c" : b.registered ? INK : MAROON;
    g.font = `600 12px ${FONT}`;
    g.save();
    g.beginPath();
    g.rect(x, top, w, h);
    g.clip();
    g.fillText(b.label, x + 6, top + 16);
    if (h > 32) {
      g.font = `400 11px ${FONT}`;
      g.fillStyle = INK_3;
      g.fillText(`${clock(b.start)}–${clock(b.end)}`, x + 6, top + 31);
    }
    g.restore();
  }

  g.fillStyle = INK_3;
  g.font = `400 11px ${FONT}`;
  const legendY = H - PAD + 4;
  g.fillStyle = "#efedea";
  g.fillRect(PAD, legendY - 9, 10, 10);
  g.fillStyle = "rgba(107,26,26,0.25)";
  g.fillRect(PAD + 96, legendY - 9, 10, 10);
  g.fillStyle = INK_3;
  g.fillText("Registered", PAD + 16, legendY);
  g.fillText("Planned", PAD + 112, legendY);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the schedule"))), "image/png")
  );
}
