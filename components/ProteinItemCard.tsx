"use client"
import React from "react"

// ---------------------------------------------------------------------------
// ProteinItemCard
//
// Expected props (all values must already be NORMALISED per-gram by the caller
// via normaliseFood / processFood from lib/calculations.ts):
//
//   proteinPerBase   — g protein per gram of the food
//   pricePerBase    — INR cost per gram of the food
//   baseRefLabel    — display string for the unit (e.g. "per 100g")
//
// The card handles the ratio math internally so the stepper always works in
// whole numbers (1 step = 1 gram), keeping the UX simple and accurate.
// ---------------------------------------------------------------------------

type MeasureKey = "g" | "ml" | "piece" | "scoop"

type Props = {
  iconUrl?: string
  name: string
  veg?: boolean
  /** Grams of protein per gram of food (normalised). */
  proteinPerBase: number
  /** INR cost per gram of food (normalised). */
  pricePerBase: number
  /** Label shown next to the per-base values, e.g. "per 100g". */
  baseRefLabel: string
  /** Available measure toggles. Defaults to g / ml / piece / scoop. */
  measures?: MeasureKey[]
  initialMeasure?: MeasureKey
  initialQty?: number
  minQty?: number
  maxQty?: number
  /** Fires whenever measure or quantity changes, with gram-normalised values. */
  onChange?(payload: {
    measure: MeasureKey
    quantity: number
    protein: number
    cost: number
  }): void
}

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v)

const round1 = (n: number) => Math.round(n * 10) / 10

const DEFAULT_MEASURES: MeasureKey[] = ["g", "ml", "piece", "scoop"]

export function ProteinItemCard({
  iconUrl,
  name,
  veg = true,
  proteinPerBase,
  pricePerBase,
  baseRefLabel,
  measures = DEFAULT_MEASURES,
  initialMeasure = "g",
  initialQty = 0,
  minQty = 0,
  maxQty = 99999,
  onChange,
}: Props) {
  const [measure, setMeasure] = React.useState<MeasureKey>(initialMeasure)
  const [qty, setQty] = React.useState<number>(initialQty)

  // protein = grams entered × protein per gram
  const protein = Math.max(0, qty * proteinPerBase)
  // cost = grams entered × cost per gram
  const cost = Math.max(0, qty * pricePerBase)

  React.useEffect(() => {
    onChange?.({ measure, quantity: qty, protein, cost })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, qty])

  const step = 1 // always step by 1 gram/piece
  const inc = () => setQty((q) => Math.min(maxQty, q + step))
  const dec = () => setQty((q) => Math.max(minQty, q - step))

  // Hold-to-repeat for fast entry
  const useHold = (fn: () => void) => {
    const timer = React.useRef<number | null>(null)
    const start = () => {
      fn()
      timer.current = window.setInterval(fn, 120)
    }
    const stop = () => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
    return {
      onMouseDown: start,
      onTouchStart: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchEnd: stop,
    }
  }

  const holdPlus = useHold(inc)
  const holdMinus = useHold(dec)

  return (
    <div className="w-full rounded-3xl bg-white shadow-md p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              className="w-8 h-8 rounded-md object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-lg">
              {veg ? "🥬" : "🍗"}
            </div>
          )}
          <div>
            <div className="text-lg font-semibold leading-6">{name}</div>
            <div className="mt-1 inline-flex items-center rounded-xl border border-gray-200 px-2 py-0.5 text-xs text-gray-700">
              <span
                className={`mr-1 inline-block h-2 w-2 rounded-sm ${veg ? "bg-green-600" : "bg-red-600"}`}
              />
              {veg ? "Veg" : "Non-Veg"}
            </div>
          </div>
        </div>
      </div>

      {/* Per-base info line */}
      <div className="mt-3 text-sm text-gray-600">
        <span className="font-medium">{round1(proteinPerBase * 100)}g protein</span>
        <span className="mx-1.5">•</span>
        <span>{INR(pricePerBase * 100)}</span>
        <span className="ml-1">{baseRefLabel}</span>
      </div>

      {/* Measure toggles */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {measures.map((m) => {
          const active = m === measure
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMeasure(m)}
              className={`h-10 rounded-xl border text-sm font-medium transition ${
                active
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-300 active:bg-gray-100"
              }`}
              aria-pressed={active}
            >
              {m === "piece" ? "pc" : m}
            </button>
          )
        })}
      </div>

      {/* Stepper */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={dec}
          {...holdMinus}
          className="h-11 w-11 rounded-2xl border border-gray-300 bg-white text-xl font-medium active:bg-gray-100"
        >
          −
        </button>
        <div className="flex-1 h-11 rounded-2xl border border-gray-300 bg-white text-center text-base font-semibold flex items-center justify-center">
          {qty}
          <span className="ml-1 text-xs text-gray-400 font-normal">{measure}</span>
        </div>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={inc}
          {...holdPlus}
          className="h-11 w-11 rounded-2xl border border-transparent bg-gray-900 text-white text-xl font-semibold active:opacity-90"
        >
          +
        </button>
      </div>

      {/* Totals */}
      <div className="mt-4 text-base font-semibold text-gray-900">
        Protein: {round1(protein)} g
        <span className="mx-1.5 text-gray-400">•</span>
        Cost: {INR(cost)}
      </div>
    </div>
  )
}
