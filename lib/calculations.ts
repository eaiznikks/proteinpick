export interface UserData {
  gender: "male" | "female"
  weight: number
  dietaryPreference: "vegan" | "vegetarian" | "eggetarian" | "non-vegetarian"
  goal: "cutting" | "bulking" | "recomposition"
  customProteinRatio?: number
}

export interface NutritionRequirements {
  dailyCalories: number
  dailyProtein: number
  proteinPerKg: number
}

import type { FoodItem } from "./types"

// ---------------------------------------------------------------------------
// Unit normalisation
// ---------------------------------------------------------------------------
// All stepper math works on a per-gram (or per-ml) basis.
// Every food item is normalised so protein_per_unit_g = grams of protein per
// gram (or ml) of the food.  Macros and cost are similarly per-gram.
//
// Edge cases handled:
//   • "800ml", "150g"     → extract size, divide protein/cals/cost by size
//   • "1 scoop (33g)"     → extract scoop count (1) and scoop size (33g)
//   • "4 eggs", "6 whites" → extract piece count, protein = total/piece_count
//   • "1 bar"              → piece count = 1
//   • "1 scoop" (no grams) → defaults to 1 discrete unit
//   • Range "100-125g"     → extracts first number (100)
//   • No number at all     → treats as 1 discrete unit (safe fallback)
// ---------------------------------------------------------------------------

type UnitKind = "g" | "ml" | "discrete"

/** Returns the kind of unit and the numeric size embedded in the string. */
export function parseUnitKindAndSize(
  unit: string,
): { kind: UnitKind; size: number; count: number } {
  const u = unit.trim().toLowerCase()

  // Volume: contains "ml" (not "g")
  if (/ml/.test(u) && !/g\b/.test(u)) {
    const m = u.match(/^(\d+(?:\.\d+)?)\s*ml$/) || u.match(/(\d+(?:\.\d+)?)\s*ml/)
    const size = m ? parseFloat(m[1]) : 250
    return { kind: "ml", size, count: 1 }
  }

  // Weight: contains "g" as a word boundary unit (not inside a word)
  // Must NOT match "egg", "protein", etc.
  if (/\bg\b/.test(u)) {
    // e.g. "150g", "100-125g", "1 scoop (23g)"
    const m =
      u.match(/\((\d+(?:\.\d+)?)\s*g\)/) || // "(23g)" inside parens – scoop size
      u.match(/^(\d+(?:\.\d+)?)\s*g($)/) ||  // "150g" at start/end
      u.match(/(\d+(?:\.\d+)?)\s*g\b/)        // "100-125g" anywhere
    const size = m ? parseFloat(m[1]) : 100
    return { kind: "g", size, count: 1 }
  }

  // Discrete items: "4 eggs", "6 whites", "1 bar", "1 scoop"
  // Extract leading integer if present; default to 1
  const m = u.match(/^(\d+)/)
  const count = m ? parseInt(m[1], 10) : 1
  return { kind: "discrete", size: 1, count }
}

/**
 * Normalise a FoodItem so that protein_per_unit_g, calories_per_unit,
 * cost_per_unit_inr, fats_per_unit_g, and carbs_per_unit_g are all
 * expressed PER GRAM (or per ml) of the food — not per package/serving.
 *
 * Also adds rupees_per_gram and calories_per_g_protein as derived fields.
 */
export function normaliseFood(food: FoodItem): FoodItem {
  const { kind, size, count } = parseUnitKindAndSize(food.unit)

  let proteinPerGram: number
  let caloriesPerGram: number
  let costPerGram: number
  let fatsPerGram: number
  let carbsPerGram: number

  if (kind === "discrete") {
    // protein_per_unit_g is total for all pieces; divide by count to get per-piece
    const proteinPerPiece = count > 0 ? food.protein_per_unit_g / count : food.protein_per_unit_g
    const caloriesPerPiece = count > 0 ? food.calories_per_unit / count : food.calories_per_unit
    const costPerPiece = count > 0 ? food.cost_per_unit_inr / count : food.cost_per_unit_inr

    proteinPerGram = proteinPerPiece   // 1 discrete unit = 1 piece
    caloriesPerGram = caloriesPerPiece
    costPerGram = costPerPiece
    fatsPerGram = ((food as any).fats_per_unit_g ?? 0) / Math.max(count, 1)
    carbsPerGram = ((food as any).carbs_per_unit_g ?? 0) / Math.max(count, 1)
  } else {
    // Weight or volume: size is grams or ml per package
    // protein_per_unit_g is already the total for the whole package — divide by size
    proteinPerGram = size > 0 ? food.protein_per_unit_g / size : food.protein_per_unit_g
    caloriesPerGram = size > 0 ? food.calories_per_unit / size : food.calories_per_unit
    costPerGram = size > 0 ? food.cost_per_unit_inr / size : food.cost_per_unit_inr
    fatsPerGram = size > 0 ? ((food as any).fats_per_unit_g ?? 0) / size : ((food as any).fats_per_unit_g ?? 0)
    carbsPerGram = size > 0 ? ((food as any).carbs_per_unit_g ?? 0) / size : ((food as any).carbs_per_unit_g ?? 0)
  }

  const calories_per_g_protein =
    proteinPerGram > 0 ? caloriesPerGram / proteinPerGram : 0
  const rupees_per_gram =
    proteinPerGram > 0 ? costPerGram / proteinPerGram : 0

  // Lean tag based on calories per gram of protein
  let lean_tag: "lean" | "neutral" | "dense"
  if (calories_per_g_protein <= 5) {
    lean_tag = "lean"
  } else if (calories_per_g_protein >= 7) {
    lean_tag = "dense"
  } else {
    lean_tag = "neutral"
  }

  return {
    ...food,
    // Normalised per-gram values — these are what the stepper must use
    protein_per_unit_g: proteinPerGram,
    calories_per_unit: caloriesPerGram,
    cost_per_unit_inr: costPerGram,
    // Derived /补充 fields
    fats_per_unit_g: fatsPerGram,
    carbs_per_unit_g: carbsPerGram,
    rupees_per_gram,
    calories_per_g_protein,
    lean_tag,
    // Attach raw size so the UI knows how many g/ml one "unit" represents
    _unit_size: size,
    _unit_count: count,
    _unit_kind: kind,
  } as FoodItem & { _unit_size: number; _unit_count: number; _unit_kind: UnitKind }
}

/** Backward-compatible alias — prefer normaliseFood in new code. */
export function processFood(food: FoodItem): FoodItem {
  return normaliseFood(food)
}

// ---------------------------------------------------------------------------
// Calorie / BMR helpers (unchanged)
// ---------------------------------------------------------------------------

export function calculateBMR(gender: "male" | "female", weight: number, height = 170, age = 25): number {
  return gender === "male"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161
}

export function calculateTDEE(bmr: number, gymDaysPerWeek: number): number {
  const factor = 1.2 + Math.min(Math.max(gymDaysPerWeek, 0), 7) * 0.075
  return Math.round(bmr * factor)
}

export function getActivityMultiplier(gymDaysPerWeek: number): number {
  if (gymDaysPerWeek <= 0) return 12
  if (gymDaysPerWeek <= 2) return 13
  if (gymDaysPerWeek <= 4) return 14
  if (gymDaysPerWeek <= 6) return 15
  return 16
}

export function calculateMaintenanceCalories(weightKg: number, gymDaysPerWeek: number): number {
  return Math.round(weightKg * 2.2 * getActivityMultiplier(gymDaysPerWeek))
}

export function calculateCalorieTargetFromMaintenance(
  maintenance: number,
  goal: "cutting" | "bulking" | "recomposition",
): number {
  if (goal === "cutting") return Math.round(maintenance - 300)
  if (goal === "bulking") return Math.round(maintenance + 300)
  return Math.round(maintenance)
}

// ---------------------------------------------------------------------------
// Goal-aware scoring
// ---------------------------------------------------------------------------

export function scoreByGoal(food: FoodItem, goal: "cutting" | "bulking" | "recomposition"): number {
  const baseScore = (food.rupees_per_gram as number) || 0
  const lean = (food.lean_tag as string) as "lean" | "neutral" | "dense"

  switch (goal) {
    case "cutting":
      return lean === "lean" ? baseScore * 1.0 : lean === "neutral" ? baseScore * 1.1 : baseScore * 1.25
    case "bulking":
      return lean === "dense" ? baseScore * 0.9 : lean === "neutral" ? baseScore * 1.05 : baseScore * 1.2
    default:
      return baseScore
  }
}

export function getGoalDescription(goal: "cutting" | "bulking" | "recomposition"): string {
  return goal === "cutting"
    ? "Fat Loss & Muscle Preservation"
    : goal === "bulking"
      ? "Muscle Building & Weight Gain"
      : "Balanced Muscle & Fat Gain"
}

export function getDietaryDescription(preference: "vegan" | "vegetarian" | "eggetarian" | "non-vegetarian"): string {
  switch (preference) {
    case "vegan": return "Plant-based only"
    case "vegetarian": return "Dairy & plant-based"
    case "eggetarian": return "Eggs, dairy & plant-based"
    case "non-vegetarian": return "All protein sources"
    default: return preference
  }
}

// ---------------------------------------------------------------------------
// Step 3 / 4 helpers (shared UI logic)
// ---------------------------------------------------------------------------

/**
 * Given a food item with normalised per-gram values, compute protein (g),
 * calories, and cost for a given amount in grams.
 */
export function calcFoodTotals(food: FoodItem, grams: number) {
  const p = food.protein_per_unit_g as number
  const c = food.calories_per_unit as number
  const r = food.cost_per_unit_inr as number
  const f = (food as any).fats_per_unit_g as number ?? 0
  const b = (food as any).carbs_per_unit_g as number ?? 0
  return {
    protein: grams * p,
    calories: grams * c,
    cost: grams * r,
    fats: grams * f,
    carbs: grams * b,
  }
}

/**
 * Cost of getting 25 g of protein from this food.
 * Uses the per-gram values so the result is always accurate.
 */
export function costPer25gProtein(food: FoodItem): number {
  const p = food.protein_per_unit_g as number
  const r = food.cost_per_unit_inr as number
  if (p <= 0) return 0
  return Math.round((r / p) * 25 * 100) / 100 // keep 2 decimal places
}

/**
 * Step size for the gram/ml stepper.
 * Discrete items step by 1 piece; weight/volume steps by 25 g or 50 ml.
 */
export function stepSizeForFood(food: FoodItem): number {
  const kind = (food as any)._unit_kind as UnitKind | undefined
  if (kind === "ml") return 50
  if (kind === "g") return 25
  return 1 // discrete
}

/**
 * Parse a food's unit string and return the numeric size and kind.
 * Kind: 'g' | 'ml' | 'discrete'
 */
export function parseFoodUnit(unit: string): {
  kind: "g" | "ml" | "discrete"
  size: number | null
} {
  const { kind, size } = parseUnitKindAndSize(unit)
  return { kind, size }
}
