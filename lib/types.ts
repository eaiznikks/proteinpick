export interface UserInput {
  weight_kg: number
  gender: "male" | "female"
  diet_type: "veg" | "egg" | "nonveg" | "vegan"
  goal: "cutting" | "bulking" | "recomposition"
  gym_days_per_week: number
  protein_per_kg_slider: number
  allergies: string[]
}

export interface FoodItem {
  id: string
  name: string
  diet_type: "veg" | "egg" | "nonveg" | "vegan"
  is_complete: boolean
  protein_per_unit_g: number
  calories_per_unit: number
  cost_per_unit_inr: number
  unit: string
  max_units_per_day?: number
  allergens?: string[]
  rupees_per_gram?: number
  calories_per_g_protein?: number
  lean_tag?: "lean" | "neutral" | "dense"
}

export interface SelectedSources {
  [key: string]: boolean
}

export interface PlanItem {
  id: string
  name: string
  units_per_day: number
  protein_g: number
  calories: number
  cost: number
  unit: string
  is_complete: boolean
}

export interface PlanTotals {
  dailyCost: number
  monthlyCost: number
  proteinG: number
  calories: number
  completeProtein: number
  incompleteProtein: number
}

export interface Plan {
  items: PlanItem[]
  totals: PlanTotals
}
