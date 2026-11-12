"use client"

import { useId, useState, type CSSProperties, type ReactNode } from "react"
import { saveDefaultSettings } from "./settings-preset"
import { bezierEase, defaultCardSettings, easePresets, saveCardSettings, setCardSettings, useCardSettings, type Bezier, type CardSettings } from "../card-settings"
import { defaultAscii, defaultModel, defaultCamera, defaultText, type AsciiSettings, type ModelSettings } from "./live-settings"

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
  const [tab, setTab] = useState<"ascii" | "model" | "camera" | "cards" | "text">("ascii")
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
      <button id="text-tab" role="tab" aria-selected={tab === "text"} aria-controls="text-properties" onClick={() => setTab("text")}>Text</button>
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
      </> : tab === "text" ? <>
        <div className="property-card">
          <Group title="Floor text">
            <Toggle label="Show floor text" value={model.textEnabled} onChange={v => m("textEnabled", v)} />
            <label className="property-custom">Text<input aria-label="Floor text" value={model.floorText} maxLength={80} placeholder="Your text" onChange={e => m("floorText", e.target.value)} /></label>
            <div className="property-row"><span>Effect</span><span className="property-value">ASCII</span></div>
            <div className="property-row"><span>Opacity</span><span className="property-value">100%</span></div>
            <Color label="Text color" value={model.textColor} onChange={v => m("textColor", v)} />
          </Group>
          <Group title="Text ASCII">
            {mr("Start text columns", "textAsciiColumns", 40, 400, 1)}
            {mr("End text columns", "textAsciiEndColumns", 40, 400, 1)}
            <Range label="Text white point" value={model.textAsciiWhitePoint} min={0.01} max={1} onChange={v => onModel({ ...model, textAsciiWhitePoint: v, textAsciiBlackPoint: Math.min(v - 0.01, model.textAsciiBlackPoint) })} />
            <Range label="Text black point" value={model.textAsciiBlackPoint} min={0} max={0.99} onChange={v => onModel({ ...model, textAsciiBlackPoint: v, textAsciiWhitePoint: Math.max(v + 0.01, model.textAsciiWhitePoint) })} />
            <p className="property-help">Columns follow the scroll range and easing below. Set equal counts for a fixed grid. White and black points affect only the floor text.</p>
          </Group>
          <Group title="Perspective">
            {mr("Floor position · X", "textX", -8, 8, 0.1)}
            {mr("Floor position · Z", "textZ", -8, 8, 0.1)}
            {mr("Floor height", "textHeight", -0.1, 0.3, 0.005)}
            {mr("Text rotation · °", "textRotation", -180, 180, 1)}
            {mr("Text tilt · °", "textTilt", -30, 30, 1)}
            <p className="property-help">Flat on the floor at 0° tilt. Follows the environment transform; the tiger and trees occlude it naturally.</p>
          </Group>
          <Group title="Scroll size and columns">
            {mr("Start font size · px", "textStartFontSize", 4, 600, 1)}
            {mr("End font size · px", "textFontSize", 4, 600, 1)}
            <Range label="Starts · scroll %" value={model.textScrollStart} min={0} max={99} step={1} onChange={v => onModel({ ...model, textScrollStart: v, textScrollEnd: Math.max(v + 1, model.textScrollEnd) })} />
            <Range label="Ends · scroll %" value={model.textScrollEnd} min={1} max={100} step={1} onChange={v => onModel({ ...model, textScrollEnd: v, textScrollStart: Math.min(v - 1, model.textScrollStart) })} />
            <Select label="Scroll ease" value={model.textEase} options={[["smooth", "Smoothstep"], ["linear", "Linear"], ["cubic", "Ease out · cubic"]]} onChange={v => m("textEase", v)} />
            <Toggle label="Fit text to viewport" value={model.textFitViewport} onChange={v => m("textFitViewport", v)} />
            <p className="property-help">Size follows the camera scroll and reverses when scrolling up. Opacity stays at 100%; the side view is naturally edge-on. Fit caps large sizes on narrow screens.</p>
          </Group>
        </div>
      </> : tab === "cards" ? <>
        <div className="property-card">
          <Group title="Scroll camera">
            <p className="property-help">Scrolling down from the hero first moves the camera from the Camera tab settings to these (linear with scroll). Once it arrives, the first card enters. Scrolling back up retraces it.</p>
            <Range label="Focal length · mm" value={cards.camFocal} min={15} max={120} step={1} onChange={v => c("camFocal", v)} />
            <Range label="Orbit" value={cards.camOrbit} min={-180} max={180} step={1} onChange={v => c("camOrbit", v)} />
            <Range label="Elevation" value={cards.camElevation} min={-60} max={90} step={1} onChange={v => c("camElevation", v)} />
            <p className="property-help">90° is exactly top-down. Cursor orbit and landing motion fade out as the camera arrives.</p>
            <Range label="Shift X" value={cards.camShiftX} min={-1} max={1} onChange={v => c("camShiftX", v)} />
            <Range label="Shift Y" value={cards.camShiftY} min={-1} max={1} onChange={v => c("camShiftY", v)} />
            <Range label="Cursor orbit · horizontal °" value={cards.camCursorHorizontal} min={0} max={30} step={0.1} onChange={v => c("camCursorHorizontal", v)} />
            <Range label="Cursor orbit · vertical °" value={cards.camCursorVertical} min={0} max={30} step={0.1} onChange={v => c("camCursorVertical", v)} />
          </Group>
          <Group title="Open · button or letter key">
            <Range label="Delay · ms" value={cards.openDelayMs} min={0} max={1000} step={10} onChange={v => c("openDelayMs", v)} />
            <Range label="Duration · ms" value={cards.openMs} min={100} max={3000} step={50} onChange={v => c("openMs", v)} />
            <EaseEditor label="Ease" value={cards.openEase} onChange={v => c("openEase", v)} />
            <Range label="Unlock before end · ms" value={cards.unlockMs} min={0} max={1000} step={10} onChange={v => c("unlockMs", v)} />
            <p className="property-help">The slide when you click Work, Studio or Contact, or press A, W or S. Delay is the wait between the trigger and the slide starting. Unlock is how long before the slide lands that the next press is accepted.</p>
          </Group>
          <Group title="Close · button, Esc, wordmark">
            <Range label="Duration · ms" value={cards.closeMs} min={200} max={3000} step={50} onChange={v => c("closeMs", v)} />
            <Range label="Stagger · ms" value={cards.closeStaggerMs} min={0} max={300} step={5} onChange={v => c("closeStaggerMs", v)} />
            <EaseEditor label="Ease" value={cards.closeEase} onChange={v => c("closeEase", v)} />
            <p className="property-help">How the stack leaves. The front card goes first and each card below follows after the stagger. A card that is only half open takes proportionally less time.</p>
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
    <footer className="properties-footer"><span>{status === "checking" ? "Connecting renderer…" : status === "yes" ? "Changes update in real time" : "Static preview"}</span><button onClick={() => tab === "ascii" ? onAscii({ ...defaultAscii }) : tab === "camera" ? onModel({ ...model, ...defaultCamera }) : tab === "cards" ? setCardSettings(defaultCardSettings) : tab === "text" ? onModel({ ...model, ...defaultText }) : onModel({ ...defaultModel })}>Reset {tab === "ascii" ? "effect" : tab === "camera" ? "camera" : tab === "cards" ? "cards" : tab === "text" ? "text" : "model"}</button></footer>
  </aside>
}
