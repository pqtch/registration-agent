// Dev-only: every pose at every Settings size, on light and dark paper.
import { createRoot } from "react-dom/client";
import "../styles.css";
import Fordhawke from "../components/Fordhawke";
import type { MascotState } from "../components/Mascot";

const POSES: MascotState[] = ["idle", "wave", "ponder", "reading", "whatif"];
const SIZES = [72, 100, 132];
const still = new URLSearchParams(location.search).has("still");

function Sheet({ dark }: { dark: boolean }) {
  return (
    <div className={dark ? "dark" : ""} style={{ background: dark ? "rgb(28 25 23)" : "rgb(246 245 243)", padding: 16 }}>
      {SIZES.map((h) => (
        <div key={h} style={{ display: "flex", gap: 18, alignItems: "flex-end", marginBottom: 10 }}>
          {POSES.map((p) => (
            <div key={p} style={{ width: h * 0.8, height: h }}>
              <Fordhawke pose={p} still={still} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <div style={{ display: "flex" }}>
    <Sheet dark={false} />
    <Sheet dark />
  </div>
);
