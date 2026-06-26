import type { FoodItem, UserInput, PlanItem, Plan } from "./types"
import { scoreByGoal } from "./calculations"

// Helpers for strict rounding and unit handling
function isWeightOrVolumeUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase()
  // Treat as weight/volume ONLY when the entire unit is just a number + g/ml, e.g. "150g", "800ml"
  // Do not match composite strings like "1 scoop (33g)" or "4 eggs"
  return /^(?:\d+(?:\.\d+)?\s*(?:g|ml))$/.test(normalized)
}

function unitStep(unit: string): number {
  return isWeightOrVolumeUnit(unit) ? 0.1 : 1
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}

function clampUnits(units: number, maxUnits: number, step: number): number {
  const clamped = Math.min(units, maxUnits)
  // Ensure we do not exceed max when snapping to step
  const snappedDown = Math.floor(clamped / step) * step
  return Number(snappedDown.toFixed(step === 0.1 ? 1 : 0))
}

function getMaxUnits(food: FoodItem): number {
  return food.max_units_per_day ?? 10
}

function addUnitsToItem(
  items: Map<string, PlanItem>,
  food: FoodItem,
  unitsToAdd: number,
): number /* protein added */ {
  if (unitsToAdd <= 0) return 0
  const step = unitStep(food.unit)
  const existing = items.get(food.id)
  const currentUnits = existing?.units_per_day ?? 0
  const maxUnits = getMaxUnits(food)

  const availableUnits = Math.max(0, maxUnits - currentUnits)
  let addUnits = Math.min(availableUnits, unitsToAdd)
  addUnits = clampUnits(addUnits, availableUnits, step)
  if (addUnits <= 0) return 0

  const protein = addUnits * food.protein_per_unit_g
  const calories = addUnits * food.calories_per_unit
  const cost = Math.round(addUnits * food.cost_per_unit_inr)

  const newUnits = Number((currentUnits + addUnits).toFixed(step === 0.1 ? 1 : 0))
  const newProtein = (existing?.protein_g ?? 0) + protein
  const newCalories = (existing?.calories ?? 0) + calories
  const newCost = (existing?.cost ?? 0) + cost

  items.set(food.id, {
    id: food.id,
    name: food.name,
    units_per_day: newUnits,
    protein_g: newProtein,
    calories: newCalories,
    cost: newCost,
    unit: food.unit,
    is_complete: food.is_complete,
  })

  return protein
}

function removeUnitsFromItem(
  items: Map<string, PlanItem>,
  food: FoodItem,
  unitsToRemove: number,
): number /* protein removed */ {
  const existing = items.get(food.id)
  if (!existing || unitsToRemove <= 0) return 0
  const step = unitStep(food.unit)
  const remove = clampUnits(unitsToRemove, existing.units_per_day, step)
  if (remove <= 0) return 0

  const protein = remove * food.protein_per_unit_g
  const calories = remove * food.calories_per_unit
  const cost = Math.round(remove * food.cost_per_unit_inr)

  const newUnits = Number((existing.units_per_day - remove).toFixed(step === 0.1 ? 1 : 0))
  if (newUnits <= 0) {
    items.delete(food.id)
  } else {
    items.set(food.id, {
      ...existing,
      units_per_day: newUnits,
      protein_g: existing.protein_g - protein,
      calories: existing.calories - calories,
      cost: existing.cost - cost,
    })
  }
  return protein
}

function computeTotals(items: Map<string, PlanItem>) {
  let totalProtein = 0
  let totalCalories = 0
  let totalCost = 0
  let completeProtein = 0
  let incompleteProtein = 0

  for (const item of items.values()) {
    totalProtein += item.protein_g
    totalCalories += item.calories
    totalCost += item.cost
    if (item.is_complete) completeProtein += item.protein_g
    else incompleteProtein += item.protein_g
  }
  return { totalProtein, totalCalories, totalCost, completeProtein, incompleteProtein }
}

function toPlan(items: Map<string, PlanItem>): Plan {
  const list = Array.from(items.values())
  const { totalProtein, totalCalories, totalCost, completeProtein, incompleteProtein } = computeTotals(items)
  return {
    items: list,
    totals: {
      dailyCost: totalCost,
      monthlyCost: totalCost * 30,
      proteinG: Math.round(totalProtein),
      calories: Math.round(totalCalories),
      completeProtein: Math.round(completeProtein),
      incompleteProtein: Math.round(incompleteProtein),
    },
  }
}

export function buildPlanGreedyStrict(
  foods: FoodItem[],
  userInput: UserInput,
  selectedSourceIds: string[],
  proteinTargetG: number,
): Plan {
  // Filter foods by diet, allergies, and selected sources only
  const eligibleFoods = foods.filter((food) => {
    const dietMatch =
      (userInput.diet_type === "vegan" && ["vegan", "vegetarian"].includes(food.diet_type)) ||
      (userInput.diet_type === "veg" && ["vegetarian", "vegan"].includes(food.diet_type)) ||
      (userInput.diet_type === "egg" && ["vegetarian", "vegan", "egg"].includes(food.diet_type)) ||
      (userInput.diet_type === "nonveg" && ["vegetarian", "vegan", "egg", "nonveg"].includes(food.diet_type))

    const allergyMatch = !food.allergens?.some((allergen) => userInput.allergies.includes(allergen.toLowerCase()))
    const selectedMatch = selectedSourceIds.includes(food.id)
    return dietMatch && allergyMatch && selectedMatch
  })

  const completeFoods = eligibleFoods.filter((f) => f.is_complete)
  const incompleteFoods = eligibleFoods.filter((f) => !f.is_complete)

  // Rank by goal-aware cost efficiency (lower is better)
  const rankedComplete = [...completeFoods].sort(
    (a, b) => scoreByGoal(a, userInput.goal) - scoreByGoal(b, userInput.goal),
  )
  const rankedIncomplete = [...incompleteFoods].sort(
    (a, b) => scoreByGoal(a, userInput.goal) - scoreByGoal(b, userInput.goal),
  )

  const items = new Map<string, PlanItem>()
  const baseUnits = new Map<string, number>()
  // Targets for complete/incomplete protein. If one category is unavailable,
  // push the entire target to the available category.
  const hasComplete = completeFoods.length > 0
  const hasIncomplete = incompleteFoods.length > 0
  const completeTarget = hasComplete && hasIncomplete ? proteinTargetG * 0.8 : hasComplete ? proteinTargetG : 0
  const incompleteTarget = hasComplete && hasIncomplete ? proteinTargetG * 0.2 : hasIncomplete ? proteinTargetG : 0

  // Seed: ensure every selected source has at least one minimal step to "utilize" it
  for (const food of [...rankedComplete, ...rankedIncomplete]) {
    const step = unitStep(food.unit)
    addUnitsToItem(items, food, step)
    baseUnits.set(food.id, step)
  }

  // Fill complete protein first beyond the seed
  let { completeProtein, incompleteProtein, totalProtein } = computeTotals(items)

  for (const food of rankedComplete) {
    if (completeProtein >= completeTarget) break
    const need = Math.max(0, completeTarget - completeProtein)
    const unitsNeeded = need / food.protein_per_unit_g
    const proteinAdded = addUnitsToItem(items, food, unitsNeeded)
    completeProtein += proteinAdded
    totalProtein += proteinAdded
  }

  // If still below due to rounding, add minimal steps across ranked list
  if (completeProtein < completeTarget - 0.5) {
    for (const food of rankedComplete) {
      if (completeProtein >= completeTarget) break
      const stepProtein = unitStep(food.unit) * food.protein_per_unit_g
      const added = addUnitsToItem(items, food, unitStep(food.unit))
      if (added > 0) {
        completeProtein += stepProtein
        totalProtein += stepProtein
      }
    }
  }

  // Fill incomplete protein next
  for (const food of rankedIncomplete) {
    if (incompleteProtein >= incompleteTarget) break
    const need = Math.max(0, incompleteTarget - incompleteProtein)
    const unitsNeeded = need / food.protein_per_unit_g
    const proteinAdded = addUnitsToItem(items, food, unitsNeeded)
    incompleteProtein += proteinAdded
    totalProtein += proteinAdded
  }

  if (incompleteProtein < incompleteTarget - 0.5) {
    for (const food of rankedIncomplete) {
      if (incompleteProtein >= incompleteTarget) break
      const stepProtein = unitStep(food.unit) * food.protein_per_unit_g
      const added = addUnitsToItem(items, food, unitStep(food.unit))
      if (added > 0) {
        incompleteProtein += stepProtein
        totalProtein += stepProtein
      }
    }
  }

  // Post fill adjustments to reach target and maintain complete ratio bounds
  // Share bounds. If only one category exists, allow full range [0,1].
  const MIN_COMPLETE_SHARE = hasIncomplete && hasComplete ? 0.75 : 0
  const MAX_COMPLETE_SHARE = hasIncomplete && hasComplete ? 0.85 : 1
  const MAX_OVERFLOW = 20 // never go more than +20g over
  const allRankedAsc = [...rankedComplete, ...rankedIncomplete]
  const allRankedDesc = [...allRankedAsc].reverse() // for removals

  let guard = 0
  while (guard++ < 500) {
    const totals = computeTotals(items)
    const share = totals.totalProtein > 0 ? totals.completeProtein / totals.totalProtein : 0
    const diff = proteinTargetG - totals.totalProtein

    const inProteinRange = totals.totalProtein >= proteinTargetG && totals.totalProtein <= proteinTargetG + MAX_OVERFLOW
    const inShareRange = share >= MIN_COMPLETE_SHARE && share <= MAX_COMPLETE_SHARE

    if (inProteinRange && inShareRange) break

    if (diff > 0) {
      // Need more protein. Favor type that keeps share within bounds.
      const needType: "complete" | "incomplete" | "any" =
        hasIncomplete && share >= MAX_COMPLETE_SHARE
          ? "incomplete"
          : hasComplete && share <= MIN_COMPLETE_SHARE
            ? "complete"
            : "any"

      const candidates =
        needType === "complete" ? rankedComplete : needType === "incomplete" ? rankedIncomplete : allRankedAsc

      let progressed = false
      for (const food of candidates) {
        const step = unitStep(food.unit)
        const added = addUnitsToItem(items, food, step)
        if (added > 0) {
          progressed = true
          break
        }
      }
      if (!progressed) break
    } else if (diff < -MAX_OVERFLOW) {
      // Too much protein. Remove from least efficient while preserving share bounds.
      const needType: "complete" | "incomplete" | "any" =
        hasComplete && share > MAX_COMPLETE_SHARE
          ? "complete"
          : hasIncomplete && share < MIN_COMPLETE_SHARE
            ? "incomplete"
            : "any"

      const itemsList = Array.from(items.values())
      const itemsByType = itemsList
        .filter((it) => (needType === "any" ? true : it.is_complete === (needType === "complete")))
        .map((it) => ({
          it,
          score: scoreByGoal(
            eligibleFoods.find((f) => f.id === it.id)!,
            userInput.goal,
          ),
        }))
        .sort((a, b) => b.score - a.score) // remove worst first

      let progressed = false
      for (const { it } of itemsByType) {
        const food = eligibleFoods.find((f) => f.id === it.id)!
        const step = unitStep(food.unit)
        // Do not go below base step so all selected remain utilized
        const minKeep = baseUnits.get(food.id) ?? 0
        if (it.units_per_day <= minKeep) continue
        const removed = removeUnitsFromItem(items, food, step)
        if (removed > 0) {
          progressed = true
          break
        }
      }
      if (!progressed) break
    } else {
      // Protein within tolerance but share outside. Adjust with minimal impact.
      if (share > MAX_COMPLETE_SHARE && hasIncomplete) {
        // Try add incomplete step, else remove one complete step
        let progressed = false
        for (const food of rankedIncomplete) {
          const step = unitStep(food.unit)
          const added = addUnitsToItem(items, food, step)
          if (added > 0) {
            progressed = true
            break
          }
        }
        if (!progressed) {
          const itemsComplete = Array.from(items.values())
            .filter((it) => it.is_complete)
            .map((it) => ({
              it,
              score: scoreByGoal(eligibleFoods.find((f) => f.id === it.id)!, userInput.goal),
            }))
            .sort((a, b) => b.score - a.score)
          for (const { it } of itemsComplete) {
            const food = eligibleFoods.find((f) => f.id === it.id)!
            const step = unitStep(food.unit)
            const removed = removeUnitsFromItem(items, food, step)
            if (removed > 0) break
          }
        }
      } else if (share < MIN_COMPLETE_SHARE && hasComplete) {
        // Try add complete step, else remove one incomplete step
        let progressed = false
        for (const food of rankedComplete) {
          const step = unitStep(food.unit)
          const added = addUnitsToItem(items, food, step)
          if (added > 0) {
            progressed = true
            break
          }
        }
        if (!progressed) {
          const itemsIncomplete = Array.from(items.values())
            .filter((it) => !it.is_complete)
            .map((it) => ({
              it,
              score: scoreByGoal(eligibleFoods.find((f) => f.id === it.id)!, userInput.goal),
            }))
            .sort((a, b) => b.score - a.score)
          for (const { it } of itemsIncomplete) {
            const food = eligibleFoods.find((f) => f.id === it.id)!
            const step = unitStep(food.unit)
            const removed = removeUnitsFromItem(items, food, step)
            if (removed > 0) break
          }
        }
      } else {
        break
      }
    }
  }

  // Final top-up: ensure we never return below the target due to step sizes
  let finalGuard = 0
  while (finalGuard++ < 200) {
    const totals = computeTotals(items)
    if (totals.totalProtein >= proteinTargetG) break
    const candidates = hasComplete ? rankedComplete : rankedIncomplete
    let progressed = false
    for (const food of candidates) {
      const added = addUnitsToItem(items, food, unitStep(food.unit))
      if (added > 0) {
        progressed = true
        break
      }
    }
    if (!progressed) break
  }

  return toPlan(items)
}

export function buildPlan(
  foods: FoodItem[],
  userInput: UserInput,
  selectedSourceIds: string[],
  proteinTargetG: number,
): Plan {
  // Delegate to normalized planner that seeds all selected sources
  return buildPlanUsingAllSelectedAdapter(foods, userInput, selectedSourceIds, proteinTargetG)
}

export function replaceItem(
  currentPlan: Plan,
  foods: FoodItem[],
  userInput: UserInput,
  itemToReplaceId: string,
  replacementFoodId: string,
  proteinTargetG: number,
  selectedSourceIds: string[],
): Plan {
  // Strict mode: Only allow replacement if the replacement is within selected sources
  if (!selectedSourceIds.includes(replacementFoodId)) {
    return currentPlan
  }

  // Keep the selected set unchanged; the item id in the set should remain as-is if different
  // If the replacement id is different from the removed id and both are in selected list,
  // the strict builder will choose optimal units under constraints.
  const stillSelected = selectedSourceIds.filter((id) => id !== itemToReplaceId)
  if (!stillSelected.includes(replacementFoodId)) stillSelected.push(replacementFoodId)

  return buildPlan(foods, userInput, stillSelected, proteinTargetG)
}

export function removeItem(
  currentPlan: Plan,
  foods: FoodItem[],
  userInput: UserInput,
  itemToRemoveId: string,
  proteinTargetG: number,
  availableSourceIds: string[],
): Plan {
  const stillSelected = availableSourceIds.filter((id) => id !== itemToRemoveId)
  return buildPlan(foods, userInput, stillSelected, proteinTargetG)
}

export function rebuildFromSeedStrict(
  foods: FoodItem[],
  userInput: UserInput,
  selectedSourceIds: string[],
  proteinTargetG: number,
): Plan {
  return buildPlanGreedyStrict(foods, userInput, selectedSourceIds, proteinTargetG)
}

export function getReplacementCandidates(
  foods: FoodItem[],
  userInput: UserInput,
  currentPlan: Plan,
  itemToReplaceId: string,
): FoodItem[] {
  const itemToReplace = currentPlan.items.find((item) => item.id === itemToReplaceId)
  if (!itemToReplace) return []

  // Filter eligible replacement foods
  const eligibleFoods = foods.filter((food) => {
    // Skip if already in plan
    if (currentPlan.items.some((item) => item.id === food.id)) return false

    const dietMatch =
      (userInput.diet_type === "vegan" && ["vegan", "vegetarian"].includes(food.diet_type)) ||
      (userInput.diet_type === "veg" && ["vegetarian", "vegan"].includes(food.diet_type)) ||
      (userInput.diet_type === "egg" && ["vegetarian", "vegan", "egg"].includes(food.diet_type)) ||
      (userInput.diet_type === "nonveg" && ["vegetarian", "vegan", "egg", "nonveg"].includes(food.diet_type))

    // Allergy filter
    const allergyMatch = !food.allergens?.some((allergen) => userInput.allergies.includes(allergen.toLowerCase()))

    // Prefer same protein type (complete/incomplete)
    const typeMatch = food.is_complete === itemToReplace.is_complete

    return dietMatch && allergyMatch && typeMatch
  })

  // Rank by goal-aware score (cost efficiency)
  return eligibleFoods.sort((a, b) => scoreByGoal(a, userInput.goal) - scoreByGoal(b, userInput.goal)).slice(0, 8) // Limit to top 8 candidates
}

// ---------------- New normalized planner (uses all selected sources) ----------------

type GoalNorm = "cutting" | "recomposition" | "bulking"
type UnitKind = "pc" | "scoop" | "g100" | "ml250"

type FoodNorm = {
  id: string
  name: string
  diet_type: "veg" | "egg" | "nonveg" | "vegan"
  is_complete: boolean
  unit_kind: UnitKind
  grams_protein_per_unit: number
  calories_per_unit: number
  cost_inr_per_unit: number
  max_units_per_day?: number
  inr_per_g?: number
  kcal_per_g?: number
  lean_tag?: "lean" | "neutral" | "dense"
}

type PlanItemNorm = {
  id: string
  name: string
  unit_kind: UnitKind
  is_complete: boolean
  units: number
  proteinG: number
  calories: number
  cost: number
  inr_per_g: number
  kcal_per_g: number
}

function round1(x: number) {
  return Math.round(x * 10) / 10
}

function deriveNorm(food: FoodNorm): FoodNorm {
  const inr_per_g = food.cost_inr_per_unit / food.grams_protein_per_unit
  const kcal_per_g = food.calories_per_unit / food.grams_protein_per_unit
  const lean_tag: "lean" | "neutral" | "dense" = kcal_per_g <= 5 ? "lean" : kcal_per_g >= 7 ? "dense" : "neutral"
  return { ...food, inr_per_g, kcal_per_g, lean_tag }
}

function addUnitsNorm(items: PlanItemNorm[], f: FoodNorm, add: number) {
  if (add <= 0) return
  const idx = items.findIndex((x) => x.id === f.id)
  const p = f.grams_protein_per_unit * add
  const c = f.calories_per_unit * add
  const inr = f.cost_inr_per_unit * add
  if (idx >= 0) {
    items[idx].units += add
    items[idx].proteinG += p
    items[idx].calories += c
    items[idx].cost += inr
  } else {
    items.push({
      id: f.id,
      name: f.name,
      unit_kind: f.unit_kind,
      is_complete: f.is_complete,
      units: add,
      proteinG: p,
      calories: c,
      cost: inr,
      inr_per_g: f.inr_per_g!,
      kcal_per_g: f.kcal_per_g!,
    })
  }
}

function isDiscrete(kind: UnitKind) {
  return kind === "pc" || kind === "scoop"
}

function capLeftNorm(items: PlanItemNorm[], f: FoodNorm) {
  const have = items.find((x) => x.id === f.id)?.units ?? 0
  const cap = f.max_units_per_day ?? 99
  return Math.max(0, cap - have)
}

function rankScoreNorm(f: FoodNorm, goal: GoalNorm) {
  const base = f.inr_per_g!
  if (goal === "cutting") return base * (f.lean_tag === "lean" ? 1.0 : f.lean_tag === "neutral" ? 1.1 : 1.25)
  if (goal === "bulking") return base * (f.lean_tag === "dense" ? 0.9 : f.lean_tag === "neutral" ? 1.05 : 1.2)
  return base
}

function parseUnitKindAndScale(unit: string): { kind: UnitKind; countOrSize: number } {
  const u = unit.trim().toLowerCase()
  const num = parseFloat(u)
  if (/ml/.test(u) && !isNaN(num)) {
    return { kind: "ml250", countOrSize: num } // size in ml
  }
  if (/\bg\b/.test(u) && !isNaN(num)) {
    return { kind: "g100", countOrSize: num } // size in grams
  }
  if (/scoop/.test(u)) {
    const cnt = isNaN(num) ? 1 : num
    return { kind: "scoop", countOrSize: cnt }
  }
  if (/egg|white|bar/.test(u)) {
    const cnt = isNaN(num) ? 1 : num
    return { kind: "pc", countOrSize: cnt }
  }
  return { kind: "pc", countOrSize: 1 }
}

function toFoodNorm(src: FoodItem): FoodNorm {
  const { kind, countOrSize } = parseUnitKindAndScale(src.unit)

  let grams_protein_per_unit: number
  let calories_per_unit: number
  let cost_inr_per_unit: number

  if (kind === "pc" || kind === "scoop") {
    // Discrete: protein_per_unit_g = total for all pieces; per-piece:
    const cnt = Math.max(1, Math.round(countOrSize))
    grams_protein_per_unit = src.protein_per_unit_g / cnt
    calories_per_unit = src.calories_per_unit / cnt
    cost_inr_per_unit = src.cost_per_unit_inr / cnt
  } else {
    // Weight or volume: protein_per_unit_g = total for full package; per-gram:
    grams_protein_per_unit = src.protein_per_unit_g / countOrSize
    calories_per_unit = src.calories_per_unit / countOrSize
    cost_inr_per_unit = src.cost_per_unit_inr / countOrSize
  }

  return {
    id: src.id,
    name: src.name,
    diet_type: src.diet_type,
    is_complete: src.is_complete,
    unit_kind: kind,
    grams_protein_per_unit,
    calories_per_unit,
    cost_inr_per_unit,
    max_units_per_day: src.max_units_per_day,
  }
}

function buildPlanUsingAllSelected(
  foodsRaw: FoodNorm[],
  selectedIds: string[],
  targetProteinG: number,
  goal: GoalNorm,
): { items: PlanItemNorm[]; totals: { proteinG: number; completeProtein: number; incompleteProtein: number; calories: number; dailyCost: number; monthlyCost: number } } {
  const foods = foodsRaw.filter((f) => selectedIds.includes(f.id)).map(deriveNorm)
  const complete = foods.filter((f) => f.is_complete).sort((a, b) => rankScoreNorm(a, goal) - rankScoreNorm(b, goal))
  const incomplete = foods.filter((f) => !f.is_complete).sort((a, b) => rankScoreNorm(a, goal) - rankScoreNorm(b, goal))

  const items: PlanItemNorm[] = []
  let TP = 0,
    CP = 0,
    IP = 0,
    CAL = 0,
    INR = 0

  // Seed: use all selected sources
  for (const f of foods) {
    const seed = isDiscrete(f.unit_kind) ? 1 : 0.1
    if (capLeftNorm(items, f) >= seed) {
      addUnitsNorm(items, f, seed)
      const p = f.grams_protein_per_unit * seed
      TP += p
      CAL += f.calories_per_unit * seed
      INR += f.cost_inr_per_unit * seed
      if (f.is_complete) CP += p
      else IP += p
    }
  }

  const compTarget = Math.round(targetProteinG * 0.8)
  const incTarget = targetProteinG - compTarget

  function take(list: FoodNorm[], needProtein: number) {
    for (const f of list) {
      let left = capLeftNorm(items, f)
      if (left <= 0) continue
      const per = f.grams_protein_per_unit
      let unitsNeeded = Math.max(0, needProtein / per)
      unitsNeeded = isDiscrete(f.unit_kind) ? Math.floor(unitsNeeded) : round1(unitsNeeded)
      const add = Math.min(left, unitsNeeded)
      if (add <= 0) continue
      addUnitsNorm(items, f, add)
      const p = per * add
      TP += p
      CAL += f.calories_per_unit * add
      INR += f.cost_inr_per_unit * add
      if (f.is_complete) CP += p
      else IP += p
      needProtein -= p
      if (needProtein <= 2) break
    }
  }

  if (CP < compTarget) take(complete, compTarget - CP)
  if (TP < targetProteinG) take(incomplete, targetProteinG - TP)
  if (TP < targetProteinG) take(complete, targetProteinG - TP)
  if (TP < targetProteinG) take(incomplete, targetProteinG - TP)

  const pct = TP > 0 ? (CP / TP) * 100 : 0
  if (pct < 75) {
    for (const f of complete) {
      if (capLeftNorm(items, f) <= 0) continue
      const add = isDiscrete(f.unit_kind) ? 1 : 0.1
      addUnitsNorm(items, f, add)
      const p = f.grams_protein_per_unit * add
      TP += p
      CP += p
      CAL += f.calories_per_unit * add
      INR += f.cost_inr_per_unit * add
      if ((CP / TP) * 100 >= 75) break
    }
  }

  const totals = {
    proteinG: Math.round(TP),
    completeProtein: Math.round(CP),
    incompleteProtein: Math.round(IP),
    calories: Math.round(CAL),
    dailyCost: Math.round(INR),
    monthlyCost: Math.round(INR * 30),
  }
  return { items, totals }
}

function buildPlanUsingAllSelectedAdapter(
  foods: FoodItem[],
  userInput: UserInput,
  selectedSourceIds: string[],
  proteinTargetG: number,
): Plan {
  const eligibleFoods = foods.filter((food) => {
    const dietMatch =
      (userInput.diet_type === "vegan" && ["vegan", "vegetarian"].includes(food.diet_type)) ||
      (userInput.diet_type === "veg" && ["vegetarian", "vegan"].includes(food.diet_type)) ||
      (userInput.diet_type === "egg" && ["vegetarian", "vegan", "egg"].includes(food.diet_type)) ||
      (userInput.diet_type === "nonveg" && ["vegetarian", "vegan", "egg", "nonveg"].includes(food.diet_type))
    return dietMatch
  })

  const foodsNorm = eligibleFoods.map(toFoodNorm)
  const goalNorm: GoalNorm = userInput.goal === "cutting" ? "cutting" : userInput.goal === "bulking" ? "bulking" : "recomposition"
  const { items, totals } = buildPlanUsingAllSelected(foodsNorm, selectedSourceIds, proteinTargetG, goalNorm)

  const planItems: PlanItem[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    units_per_day: Number(it.units.toFixed(isDiscrete(it.unit_kind) ? 0 : 1)),
    protein_g: Number(it.proteinG.toFixed(1)),
    calories: Math.round(it.calories),
    cost: Math.round(it.cost),
    unit: "unit", // unit string not used in Step 3 summary, keep placeholder
    is_complete: it.is_complete,
  }))

  return {
    items: planItems,
    totals: {
      dailyCost: totals.dailyCost,
      monthlyCost: totals.monthlyCost,
      proteinG: totals.proteinG,
      calories: totals.calories,
      completeProtein: totals.completeProtein,
      incompleteProtein: totals.incompleteProtein,
    },
  }
}
