"use client"

import { useId, useState, type CSSProperties, type ReactNode } from "react"
import { saveDefaultSettings } from "./settings-preset"
import { bezierEase, defaultCardSettings, easePresets, saveCardSettings, setCardSettings, useCardSettings, type Bezier, type CardSettings } from "../card-settings"
import { defaultAscii, defaultModel, defaultCamera, type AsciiSettings, type ModelSettings } from "./live-settings"

type Props = {
  ascii: AsciiSettings
  model: ModelSettings
  onAscii: (value: AsciiSettings) => void
  onModel: (value: ModelSettings) => void
  status: "checking" | "yes" | "no"
}

function Range({ label, value, min, max, step = 0.01, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void
}) {
  const id = useId()
  return <div className="property-range">
    <div className="property-range-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{Number(value.toFixed(2))}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
      style={{ "--range-fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties} />
  </div>
}

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: [string, string][]; onChange: (value: string) => void
}) {
  return <label className="property-row"><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select></label>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="property-row"><span>{label}</span><button type="button" className="property-toggle" role="switch" aria-label={label} aria-checked={value} onClick={() => onChange(!value)}><span /></button></div>
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="property-row"><span>{label}</span><span className="property-color"><input aria-label={label} type="color" value={value} onChange={e => onChange(e.target.value)} /><span>{value.toUpperCase()}</span></span></label>
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <details className="property-group" open><summary>{title}</summary><div className="property-group-body">{children}</div></details>
}

const sameBezier = (a: Bezier, b: Bezier) => a.every((v, i) => Math.abs(v - b[i]) < 0.001)

/**
 * cubic-bezier editor: preset picker, a curve preview (time across, progress up;
 * the box is 0 to 1 so overshoot stays visible) and the four handles.
 */
function EaseEditor({ label, value, onChange }: { label: string; value: Bezier; onChange: (value: Bezier) => void }) {
  const preset = easePresets.find(([, b]) => sameBezier(b, value))?.[0] ?? "custom"
  const fn = bezierEase(value)
  const points = Array.from({ length: 41 }, (_, i) => { const t = i / 40; return `${(t * 100).toFixed(1)},${(75 - fn(t) * 50).toFixed(1)}` }).join(" ")
  const set = (index: number, v: number) => onChange(value.map((n, i) => (i === index ? v : n)) as Bezier)
  const handle = (x: number, y: number) => [x * 100, 75 - y * 50] as const
  const [h1x, h1y] = handle(value[0], value[1])
  const [h2x, h2y] = handle(value[2], value[3])
  return <div className="property-ease">
    <label className="property-row"><span>{label}</span><select aria-label={label} value={preset} onChange={e => {
      const found = easePresets.find(([name]) => name === e.target.value)
      if (found) onChange([...found[1]] as Bezier)
      e.currentTarget.blur() // keep letter shortcuts working after picking
    }}>
      {easePresets.map(([name]) => <option key={name} value={name}>{name}</option>)}
      <option value="custom">Custom</option>
    </select></label>
    <svg className="ease-preview" viewBox="0 0 100 100" role="img" aria-label={`${label} curve`}>
      <rect x="0" y="25" width="100" height="50" />
      <line x1="0" y1="75" x2={h1x} y2={h1y} /><line x1="100" y1="25" x2={h2x} y2={h2y} />
      <polyline points={points} />
      <circle cx={h1x} cy={h1y} r="2" /><circle cx={h2x} cy={h2y} r="2" />
    </svg>
    <Range label="Handle 1 · time" value={value[0]} min={0} max={1} onChange={v => set(0, v)} />
    <Range label="Handle 1 · progress" value={value[1]} min={-0.5} max={1.5} onChange={v => set(1, v)} />
    <Range label="Handle 2 · time" value={value[2]} min={0} max={1} onChange={v => set(2, v)} />
    <Range label="Handle 2 · progress" value={value[3]} min={-0.5} max={1.5} onChange={v => set(3, v)} />
  </div>
}

const options = (values: string[]) => values.map(value => [value, value.charAt(0).toUpperCase() + value.slice(1)] as [string, string])

export function PropertiesPanel({ ascii, model, onAscii, onModel, status }: Props) {
  const [tab, setTab] = useState<"ascii" | "model" | "camera" | "cards">("ascii")
  const [open, setOpen] = useState(true)
  const [saveStatus, setSaveStatus] = useState("")
  const cards = useCardSettings()
  const c = <K extends keyof CardSettings>(key: K, value: CardSettings[K]) => setCardSettings({ ...cards, [key]: value })
  const a = <K extends keyof AsciiSettings>(key: K, value: AsciiSettings[K]) => onAscii({ ...ascii, [key]: value })
  const m = <K extends keyof ModelSettings>(key: K, value: ModelSettings[K]) => onModel({ ...model, [key]: value })
  const ar = (label: string, key: keyof AsciiSettings, min: number, max: number, step = 0.01) => <Range label={label} value={ascii[key] as number} min={min} max={max} step={step} onChange={v => a(key, v)} />
  const mr = (label: string, key: keyof ModelSettings, min: number, max: number, step = 0.01) => <Range label={label} value={model[key] as number} min={min} max={max} step={step} onChange={v => m(key, v)} />

  if (!open) return <button className="properties-launcher" onClick={() => setOpen(true)} aria-expanded={false}>⠿ <span>Properties</span><span>↗</span></button>

  return <aside className="properties-panel" aria-label="Live properties">
    <header className="properties-header"><span className="properties-grip" aria-hidden>⠿</span><strong>Properties</strong><span className="properties-live"><i />Live</span><button onClick={() => setOpen(false)} aria-label="Hide properties" title="Hide properties">−</button></header>
    <div className="properties-tabs" role="tablist" aria-label="Object properties">
      <button id="ascii-tab" role="tab" aria-selected={tab === "ascii"} aria-controls="ascii-properties" onClick={() => setTab("ascii")}>ASCII</button>
      <button id="model-tab" role="tab" aria-selected={tab === "model"} aria-controls="model-properties" onClick={() => setTab("model")}>3D Model</button>
      <button id="camera-tab" role="tab" aria-selected={tab === "camera"} aria-controls="camera-properties" onClick={() => setTab("camera")}>Camera</button>
      <button id="cards-tab" role="tab" aria-selected={tab === "cards"} aria-controls="cards-properties" onClick={() => setTab("cards")}>Cards</button>
    </div>
    <div className="properties-body" role="tabpanel" id={`${tab}-properties`} aria-labelledby={`${tab}-tab`} key={tab}>
      {status === "no" && <p className="properties-notice" role="status">Showing a static preview. Open this page in a browser with WebGPU enabled for the live scene.</p>}
      {tab === "ascii" ? <>
        <div className="property-card"><Toggle label="ASCII effect" value={ascii.enabled} onChange={v => a("enabled", v)} /></div>
        <div className="property-card">
          <Group title="Grid">
            <Toggle label="Responsive columns" value={ascii.autoColumns} onChange={v => a("autoColumns", v)} />
            {!ascii.autoColumns && ar("Columns", "columns", 40, 400, 1)}
            <Select label="Break grid" value={ascii.breakGrid} options={options(["off", "2x", "4x", "8x", "16x"])} onChange={v => a("breakGrid", v)} />
            {ascii.breakGrid !== "off" && ar("Break threshold", "breakThreshold", 0.001, 0.5)}
          </Group>
          <Group title="Glyphs">
            <Select label="Font" value={ascii.fontFamily} options={[["mono", "Geist Mono"], ["sans", "Geist Sans"], ["display-serif", "Serif"]]} onChange={v => a("fontFamily", v)} />
            <Select label="Charset" value={ascii.charset} options={options(["light", "dense", "binary", "blocks", "boxes", "hatching", "hex", "katakana", "shades", "custom"])} onChange={v => a("charset", v)} />
            {ascii.charset === "custom" && <label className="property-custom">Characters<input value={ascii.customChars} maxLength={64} onChange={e => a("customChars", e.target.value)} /></label>}
            {ar("Boldness", "boldness", -1, 1)}
          </Group>
          <Group title="Color">
            <Select label="Color mode" value={ascii.colorMode} options={[["monochrome", "Monochrome"], ["source", "Source"]]} onChange={v => a("colorMode", v)} />
            {ascii.colorMode === "monochrome" && <Color label="Tint" value={ascii.monoColor} onChange={v => a("monoColor", v)} />}
          </Group>
          <Group title="Signal">
            <Range label="Black point" value={ascii.signalBlackPoint} min={0} max={0.99} onChange={v => onAscii({ ...ascii, signalBlackPoint: v, signalWhitePoint: Math.max(v + 0.01, ascii.signalWhitePoint) })} />
            <Range label="White point" value={ascii.signalWhitePoint} min={0.01} max={1} onChange={v => onAscii({ ...ascii, signalWhitePoint: v, signalBlackPoint: Math.min(v - 0.01, ascii.signalBlackPoint) })} />
            <Toggle label="Invert" value={ascii.invert} onChange={v => a("invert", v)} />
          </Group>
          <Group title="Hover">
            <Toggle label="Cursor highlight" value={ascii.hoverEnabled} onChange={v => a("hoverEnabled", v)} />
            {ar("Hover white point", "hoverWhitePoint", 0.01, 1)}
            {ar("Hover radius · px", "hoverRadius", 20, 300, 1)}
            <p className="property-help">Local white point around the cursor. The Signal white point sets the resting look. Soft edge · 180ms easing.</p>
          </Group>
          <Group title="Warp">{ar("Row warp", "rowWarp", 0, 1)}</Group>
        </div>
      </> : tab === "model" ? <>
        <div className="properties-file"><span className="properties-file-icon">◇</span><div><strong>plants.glb + tiger.glb</strong><span>Animated environment + tiger · shared camera</span></div></div>
        <div className="property-card">
          <Group title="Tiger">
            <Toggle label="Show tiger" value={model.tigerVisible} onChange={v => m("tigerVisible", v)} />
            {mr("Tiger scale", "tigerScale", 0.1, 2)}
            {mr("Tiger depth · X", "tigerX", -10, 8, 0.1)}
            {mr("Tiger height · Y", "tigerY", -3, 3, 0.1)}
            {mr("Tiger sideways · Z", "tigerZ", -5, 5, 0.1)}
            {mr("Tiger rotation", "tigerRotation", -180, 180, 1)}
            <p className="property-help">Excluded from ASCII. The animation controls below play both loops together.</p>
          </Group>
          <Group title="Tiger material">
            <Select label="Tiger material" value={model.tigerMaterial} options={[["original", "Original"], ["chrome", "Chrome"]]} onChange={v => m("tigerMaterial", v)} />
            {model.tigerMaterial === "chrome" && <>
              <Color label="Chrome color" value={model.tigerColor} onChange={v => m("tigerColor", v)} />
              {mr("Roughness", "tigerRoughness", 0, 1)}
              {mr("Metalness", "tigerMetalness", 0, 1)}
              {mr("Tiger studio light", "tigerReflection", 0, 3)}
              {mr("Studio rotation", "tigerStudioRotation", -180, 180, 1)}
              <p className="property-help">Shader Lab Studio HDR · Neutral tone mapping</p>
            </>}
            <Toggle label="Tiger wireframe" value={model.tigerWireframe} onChange={v => m("tigerWireframe", v)} />
          </Group>
          <Group title="Environment transform">
            <div className="property-axis-label">Position</div>
            <div className="property-axes">{(["X", "Y", "Z"] as const).map(axis => <label key={axis}><span data-axis={axis}>{axis}</span><input aria-label={`Position ${axis}`} type="number" step={0.1} value={model[`position${axis}`]} onChange={e => m(`position${axis}`, Number(e.target.value))} /></label>)}</div>
            <div className="property-axis-label">Rotation</div>
            <div className="property-axes">{(["X", "Y", "Z"] as const).map(axis => <label key={axis}><span data-axis={axis}>{axis}</span><input aria-label={`Rotation ${axis}`} type="number" step={1} value={model[`rotation${axis}`]} onChange={e => m(`rotation${axis}`, Number(e.target.value))} /></label>)}</div>
            {mr("Scale", "scale", 0.1, 3)}{mr("Spin · °/s", "spin", -60, 60, 1)}
          </Group>
          <Group title="Animation">
            <div className="property-row"><span>Clip</span><span className="property-value">Loop · 10.83s</span></div>
            <Toggle label="Play" value={model.playing} onChange={v => m("playing", v)} />
            {mr("Speed", "speed", 0, 3)}
            <Select label="Repeat" value={model.repeat} options={[["loop", "Loop"], ["once", "Once"], ["pingpong", "Ping-pong"]]} onChange={v => m("repeat", v)} />
            {mr("Seek · seconds", "start", 0, 10.83)}
            <p className="property-help">Pause to hold a frame. Seek to move through the animation.</p>
          </Group>
          <Group title="Environment material">
            <Select label="Material" value={model.material} options={[["original", "Original"], ["clay", "Clay"], ["normal", "Normals"]]} onChange={v => m("material", v)} />
            <Toggle label="Wireframe" value={model.wireframe} onChange={v => m("wireframe", v)} />
          </Group>
          <Group title="Light">
            {mr("Studio light", "studioLight", 0, 5)}{mr("Key light", "keyLight", 0, 10)}
            {mr("Key angle", "keyAngle", -180, 180, 1)}{mr("Key height", "keyHeight", -90, 90, 1)}
            <Color label="Key tint" value={model.keyColor} onChange={v => m("keyColor", v)} />
            {mr("Rim light", "rimLight", 0, 10)}<Color label="Rim tint" value={model.rimColor} onChange={v => m("rimColor", v)} />
          </Group>

        </div>
      </> : tab === "cards" ? <>
        <div className="property-card">
          <Group title="Hold trigger">
            <Range label="Hold · ms" value={cards.holdMs} min={300} max={3000} step={50} onChange={v => c("holdMs", v)} />
            <Range label="Creep to · %" value={cards.peekPct} min={5} max={60} step={1} onChange={v => c("peekPct", v)} />
            <p className="property-help">Hold W, S or C. The letter fills for the hold time while the card creeps in from 0% to the creep value. Release earlier and it goes back.</p>
          </Group>
          <Group title="Creep · 0% to creep value">
            <EaseEditor label="Ease" value={cards.creepEase} onChange={v => c("creepEase", v)} />
          </Group>
          <Group title="Final slide">
            <Range label="Duration · ms" value={cards.finishMs} min={50} max={1500} step={10} onChange={v => c("finishMs", v)} />
            <EaseEditor label="Ease" value={cards.finishEase} onChange={v => c("finishEase", v)} />
            <p className="property-help">Plays from the creep value to 100% the moment the hold ends. Press Esc to clear the cards, then hold a letter to test.</p>
          </Group>
        </div>
      </> : <>
        <div className="property-card">
          <Group title="Cursor movement">
            <Toggle label="Follow cursor" value={model.cursorEnabled} onChange={v => m("cursorEnabled", v)} />
            {mr("Horizontal orbit · °", "cursorHorizontal", 0, 30, 0.1)}
            {mr("Vertical orbit · °", "cursorVertical", 0, 30, 0.1)}
            {mr("Smoothing · seconds", "cursorSmoothing", 0.05, 1.5, 0.05)}
            <Toggle label="Reverse direction" value={model.cursorReverse} onChange={v => m("cursorReverse", v)} />
            <p className="property-help">Move left/right and up/down to orbit around the tiger. The camera keeps looking at its center. Angles are measured from center to edge; leaving returns to the resting view.</p>
            <p className="property-help">Cursor orbit uses a mouse. Reduced-motion preferences disable both cursor orbit and the footstep camera dip.</p>
          </Group>
          <Group title="Landing motion">
            <Toggle label="Footstep camera dip" value={model.landingMotion} onChange={v => m("landingMotion", v)} />
            {mr("Landing strength", "landingStrength", 0, 4, 0.05)}
            <p className="property-help">Uses the camera keys in the re-exported GLBs. 1× is the authored movement; pause, seek and speed stay synchronized with the run.</p>
          </Group>
          <Group title="Camera">
            <p className="property-help">Stable framing keeps the run centered without following individual limbs. The camera combines cursor orbit with the authored landing dip; the resting angle stays level. Portrait screens fit the full loop.</p>
            {mr("Focal length · mm", "focalLength", 15, 120, 1)}
            {mr("Orbit", "orbit", -180, 180, 1)}{mr("Elevation", "elevation", -60, 60, 1)}
            {mr("Shift X", "shiftX", -1, 1)}{mr("Shift Y", "shiftY", -1, 1)}
            {mr("Exposure · EV", "exposure", -3, 3)}
            <Select label="Tone mapping" value={model.toneMapping} options={[["none", "None"], ["neutral", "Neutral"], ["aces", "ACES filmic"]]} onChange={v => m("toneMapping", v)} />
          </Group>
        </div>
      </>}
    </div>
    <div className="properties-preset"><button onClick={() => setSaveStatus(saveDefaultSettings(ascii, model) && saveCardSettings() ? "Default saved" : "Could not save in this browser")}>Save as default</button><span role="status">{saveStatus}</span></div>
    <footer className="properties-footer"><span>{status === "checking" ? "Connecting renderer…" : status === "yes" ? "Changes update in real time" : "Static preview"}</span><button onClick={() => tab === "ascii" ? onAscii({ ...defaultAscii }) : tab === "camera" ? onModel({ ...model, ...defaultCamera }) : tab === "cards" ? setCardSettings(defaultCardSettings) : onModel({ ...defaultModel })}>Reset {tab === "ascii" ? "effect" : tab === "camera" ? "camera" : tab === "cards" ? "cards" : "model"}</button></footer>
  </aside>
}
