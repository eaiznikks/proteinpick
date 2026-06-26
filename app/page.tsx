"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, RefreshCw, Download, Loader2, Info } from "lucide-react"
import type { UserInput, FoodItem, Plan } from "@/lib/types"
import { processFood, calculateBMR, calculateTDEE, calculateMaintenanceCalories, calculateCalorieTargetFromMaintenance, calcFoodTotals, costPer25gProtein, stepSizeForFood, parseFoodUnit } from "@/lib/calculations"
import { buildPlan, replaceItem, removeItem } from "@/lib/plan-builder"
import { Poster } from "@/components/poster"
import { exportToPNG, generateFilename } from "@/lib/export-utils"
import Image from "next/image"
import { Scales, User as UserIcon, Leaf, Barbell, Target } from "@phosphor-icons/react"

export default function PickProteinApp() {
  const [currentStep, setCurrentStep] = useState(1)
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [filteredFoods, setFilteredFoods] = useState<FoodItem[]>([])
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [filterComplete, setFilterComplete] = useState<"all" | "complete" | "incomplete">("all")
  const [filterLean, setFilterLean] = useState<"all" | "lean" | "dense">("all")
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [removedItems, setRemovedItems] = useState<string[]>([])
  const [showReplaceSheet, setShowReplaceSheet] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showProteinInfo, setShowProteinInfo] = useState(false)
  const [showCalorieInfo, setShowCalorieInfo] = useState(false)
  const [portionUnits, setPortionUnits] = useState<Record<string, number>>({})
  const [portionText, setPortionText] = useState<Record<string, string>>({})
  const [measureById, setMeasureById] = useState<Record<string, 'ml' | 'g' | 'scoop' | 'piece'>>({})
  const [showProteinWarning, setShowProteinWarning] = useState(false)
  const [lastWarnedProtein, setLastWarnedProtein] = useState(0)

  const [userInput, setUserInput] = useState<UserInput>({
    weight_kg: 0,
    gender: "male",
    diet_type: "nonveg",
    goal: "recomposition",
    gym_days_per_week: 3,
    protein_per_kg_slider: 1.8,
    allergies: [],
  })

  const [isLoading, setIsLoading] = useState(true)

  const handleSaveToGallery = async () => {
    if (!currentPlan) return

    setIsExporting(true)
    try {
      const filename = generateFilename(userInput)
      await exportToPNG("protein-poster", filename)
    } catch (error) {
      console.error("Export failed:", error)
      alert("Failed to save image. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  // ... existing useEffect and handler functions remain the same ...

  // Load foods data and user input from localStorage
  useEffect(() => {
    const loadFoods = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/foods.json")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()

        // Try load India market price overrides
        let priceOverrides: Record<string, number> = {}
        try {
          const priceRes = await fetch("/prices_in.json")
          if (priceRes.ok) {
            priceOverrides = await priceRes.json()
          }
        } catch (_) {
          // ignore override load errors; fall back to base prices
        }

        const merged = (data as any[]).map((f) => ({
          ...f,
          cost_per_unit_inr: priceOverrides[f.id] ?? f.cost_per_unit_inr,
        }))

        const processedFoods = merged.map(processFood)
        setFoods(processedFoods)
        setFilteredFoods(processedFoods)
      } catch (error) {
        console.error("Failed to load foods:", error)
        alert("Failed to load protein sources. Please refresh the page.")
      } finally {
        setIsLoading(false)
      }
    }
    loadFoods()

    // Load saved user input
    const savedInput = localStorage.getItem("pickprotein-user-input")
    if (savedInput) {
      try {
        const parsed = JSON.parse(savedInput)
        setUserInput(parsed)
      } catch (e) {
        console.error("Failed to parse saved user input:", e)
      }
    }

    // Load saved selected sources
    const savedSources = localStorage.getItem("pickprotein-selected-sources")
    if (savedSources) {
      try {
        const parsed = JSON.parse(savedSources)
        setSelectedSources(new Set(parsed))
      } catch (e) {
        console.error("Failed to parse saved sources:", e)
      }
    }

    // Load saved plan
    const savedPlan = localStorage.getItem("pickprotein-current-plan")
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan)
        setCurrentPlan(parsed)
      } catch (e) {
        console.error("Failed to parse saved plan:", e)
      }
    }
  }, [])

  // Save user input to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("pickprotein-user-input", JSON.stringify(userInput))
  }, [userInput])

  // Save selected sources to localStorage
  useEffect(() => {
    localStorage.setItem("pickprotein-selected-sources", JSON.stringify(Array.from(selectedSources)))
  }, [selectedSources])

  // Save current plan to localStorage
  useEffect(() => {
    if (currentPlan) {
      localStorage.setItem("pickprotein-current-plan", JSON.stringify(currentPlan))
    }
  }, [currentPlan])

  // Auto-select protein per kg based on gym days per week
  useEffect(() => {
    setUserInput((prev) => {
      const days = prev.gym_days_per_week
      let autoRatio = prev.protein_per_kg_slider
      if (days <= 2) autoRatio = 1.2
      else if (days <= 4) autoRatio = 1.6
      else if (days <= 5) autoRatio = 1.8 // assumption for 5 days
      else autoRatio = 2.0

      if (autoRatio === prev.protein_per_kg_slider) return prev
      return { ...prev, protein_per_kg_slider: autoRatio }
    })
  }, [userInput.gym_days_per_week])

  // Filter foods based on diet, allergies, search, and filters
  useEffect(() => {
    const filtered = foods.filter((food) => {
      // Diet filter - Fixed to match foods.json diet_type values
      const dietMatch =
        (userInput.diet_type === "vegan" && ["vegan", "vegetarian"].includes(food.diet_type as any)) ||
        (userInput.diet_type === "veg" && ["vegetarian", "vegan"].includes(food.diet_type as any)) ||
        (userInput.diet_type === "egg" && ["vegetarian", "vegan", "egg"].includes(food.diet_type as any)) ||
        (userInput.diet_type === "nonveg" && ["vegetarian", "vegan", "egg", "nonveg"].includes(food.diet_type as any))

      // Allergy filter
      const allergyMatch = !food.allergens?.some((allergen) => userInput.allergies.includes(allergen.toLowerCase()))

      // Search filter
      const searchMatch = food.name.toLowerCase().includes(searchQuery.toLowerCase())

      // Complete/Incomplete filter
      const completeMatch =
        filterComplete === "all" ||
        (filterComplete === "complete" && food.is_complete) ||
        (filterComplete === "incomplete" && !food.is_complete)

      // Lean/Dense filter - Added fallback for missing lean_tag
      const leanMatch =
        filterLean === "all" ||
        (filterLean === "lean" && food.lean_tag === "lean") ||
        (filterLean === "dense" && food.lean_tag === "dense")

      // Enforce only complete protein sources
      return dietMatch && allergyMatch && searchMatch && leanMatch && food.is_complete === true
    })

    // Sort by cost efficiency (rupees per gram)
    filtered.sort((a, b) => (a.rupees_per_gram || 0) - (b.rupees_per_gram || 0))

    setFilteredFoods(filtered)
  }, [foods, userInput.diet_type, userInput.allergies, searchQuery, filterComplete, filterLean])

  const handleNext = () => {
    if (currentStep === 2 && selectedSources.size >= 3) {
      // Generate plan when moving from step 2 to step 3
      const proteinTarget = Math.round(userInput.weight_kg * userInput.protein_per_kg_slider)
      const plan = buildPlan(foods, userInput, Array.from(selectedSources), proteinTarget)
      setCurrentPlan(plan)
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSourceToggle = (foodId: string) => {
    const newSelected = new Set(selectedSources)
    if (newSelected.has(foodId)) {
      newSelected.delete(foodId)
    } else {
      newSelected.add(foodId)
    }
    setSelectedSources(newSelected)
  }

  const handleRecalculate = () => {
    if (selectedSources.size >= 3) {
      const proteinTarget = Math.round(userInput.weight_kg * userInput.protein_per_kg_slider)
      const availableSources = Array.from(selectedSources).filter((id) => !removedItems.includes(id))
      const plan = buildPlan(foods, userInput, availableSources, proteinTarget)
      setCurrentPlan(plan)
    }
  }

  const handleClearAll = () => {
    setSelectedSources(new Set())
    setRemovedItems([])
  }

  const handleSelectAll = () => {
    const allIds = filteredFoods.map((f) => f.id)
    setSelectedSources(new Set(allIds))
  }

  // Enhanced remove item functionality
  const handleRemoveItem = (itemId: string) => {
    if (!currentPlan) return

    setRemovedItems((prev) => [...prev, itemId])
    const availableSources = Array.from(selectedSources).filter((id) => !removedItems.includes(id) && id !== itemId)

    if (availableSources.length >= 2) {
      // Allow minimum 2 sources after removal
      const proteinTarget = Math.round(userInput.weight_kg * userInput.protein_per_kg_slider)
      const newPlan = removeItem(currentPlan, foods, userInput, itemId, proteinTarget, availableSources)
      setCurrentPlan(newPlan)
    }
  }

  // Enhanced undo remove functionality
  const handleUndoRemove = (itemId: string) => {
    setRemovedItems((prev) => prev.filter((id) => id !== itemId))
    const availableSources = Array.from(selectedSources).filter((id) => !removedItems.includes(id) || id === itemId)
    const proteinTarget = Math.round(userInput.weight_kg * userInput.protein_per_kg_slider)
    const plan = buildPlan(foods, userInput, availableSources, proteinTarget)
    setCurrentPlan(plan)
  }

  // Added replace item functionality
  const handleReplaceItem = (itemId: string, replacementId: string) => {
    if (!currentPlan) return

    const proteinTarget = Math.round(userInput.weight_kg * userInput.protein_per_kg_slider)
    const newPlan = replaceItem(
      currentPlan,
      foods,
      userInput,
      itemId,
      replacementId,
      proteinTarget,
      Array.from(selectedSources),
    )
    setCurrentPlan(newPlan)
    setShowReplaceSheet(null)
  }

  const isStep1Valid = userInput.weight_kg > 0
  const isStep2Valid = selectedSources.size >= 1

  // Calculate nutrition targets for Step 3
  const proteinTarget = Math.round(userInput.weight_kg * userInput.protein_per_kg_slider)
  const bmr = calculateBMR(userInput.gender, userInput.weight_kg)
  const maintenance = calculateMaintenanceCalories(userInput.weight_kg, userInput.gym_days_per_week)
  const tdee = calculateTDEE(bmr, userInput.gym_days_per_week)
  const normalizedGoal: "cutting" | "bulking" | "recomposition" =
    (userInput.goal as any) === "cut" || (userInput.goal as any) === "cutting"
      ? "cutting"
      : (userInput.goal as any) === "bulk" || (userInput.goal as any) === "bulking"
        ? "bulking"
        : "recomposition"
  const calorieTarget = calculateCalorieTargetFromMaintenance(maintenance, normalizedGoal)
  const proteinCalories = proteinTarget * 4

  // Step 4 helpers: portions
  const getMaxUnits = (food: FoodItem) => (food.max_units_per_day ?? 10)
  const selectedFoodsArrayForPortions = foods.filter((f) => selectedSources.has(f.id))
  const clampToRange = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  useEffect(() => {
    if (currentStep !== 3 && currentStep !== 4) return
    setPortionUnits((prev) => {
      const next: Record<string, number> = { ...prev }
      for (const f of selectedFoodsArrayForPortions) {
        if (next[f.id] === undefined) next[f.id] = 0
      }
      return next
    })
    setPortionText((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const f of selectedFoodsArrayForPortions) {
        if (next[f.id] === undefined) next[f.id] = "0"
      }
      return next
    })
    setMeasureById((prev) => {
      const next: Record<string, 'ml' | 'g' | 'scoop' | 'piece'> = { ...prev }
      for (const f of selectedFoodsArrayForPortions) {
        if (!next[f.id]) {
          const u = f.unit.toLowerCase()
          if (u.includes('ml')) next[f.id] = 'ml'
          else if (u.includes('g')) next[f.id] = 'g'
          else if (u.includes('scoop')) next[f.id] = 'scoop'
          else next[f.id] = 'piece'
        }
      }
      return next
    })
  }, [currentStep, selectedSources, foods])

  // portionUnits[id] = GRAMS of this food selected (always, regardless of measure toggle)
  // After normalisation, protein_per_unit_g = g protein per gram of food
  // so protein = grams × protein_per_unit_g  (same for calories, cost, macros)
  const portionTotals = selectedFoodsArrayForPortions.reduce(
    (acc, f) => {
      const grams = portionUnits[f.id] || 0
      const { protein, calories, cost, fats, carbs } = calcFoodTotals(f, grams)
      acc.protein += protein
      acc.calories += calories
      acc.cost += cost
      acc.fats += fats
      acc.carbs += carbs
      return acc
    },
    { protein: 0, calories: 0, cost: 0, fats: 0, carbs: 0 },
  )

  // Warn when user exceeds daily protein target while adjusting portions on Step 3
  useEffect(() => {
    if (
      currentStep === 3 &&
      portionTotals.protein > proteinTarget &&
      !showProteinWarning &&
      portionTotals.protein > lastWarnedProtein
    ) {
      setShowProteinWarning(true)
    }
  }, [currentStep, portionTotals.protein, proteinTarget, showProteinWarning, lastWarnedProtein])

  if (currentStep === 3) {
    const selectedFoodsArray = foods.filter((f) => selectedSources.has(f.id))

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Off-screen Poster Component */}
        <div className="fixed -top-[10000px] -left-[10000px] pointer-events-none">
          <Poster
            userInput={userInput}
            proteinTarget={proteinTarget}
            maintenance={maintenance}
            budgetCalories={calorieTarget}
            foods={selectedFoodsArray}
          />
        </div>

        <div className="max-w-md mx-auto min-h-screen" style={{ backgroundColor: 'var(--brand-white)' }}>
          <div className="px-6 py-8 text-center border-b" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <Image
              src="/logo.png"
              alt="PickProtein logo"
              width={160}
              height={40}
              className="mx-auto mb-4 h-10 w-auto"
            />
            <h1 className="text-2xl font-bold font-sans" style={{ color: 'var(--brand-dark-gray)' }}>Your Optimized Protein Plan</h1>
            {/* Step indicator */}
            <div className="flex items-center justify-center mt-4 space-x-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--brand-dark-gray)', color: 'var(--brand-white)' }}>
                ✓
              </div>
              <div className="w-16 h-2 rounded-full brand-gradient"></div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--brand-dark-gray)', color: 'var(--brand-white)' }}>
                ✓
              </div>
              <div className="w-16 h-2 rounded-full brand-gradient"></div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--brand-dark-gray)', color: 'var(--brand-white)' }}>
                3
              </div>
            </div>
          </div>

          <div className="px-6 py-6" style={{ backgroundColor: 'var(--brand-white)' }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl p-4 shadow-md brand-gradient relative" style={{ color: 'var(--brand-white)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-sans opacity-90">Protein per day</div>
                    <div className="text-3xl font-bold font-sans">{proteinTarget}g</div>
                  </div>
                  <button aria-label="Protein calculation info" onClick={() => setShowProteinInfo(true)} className="opacity-90">
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="rounded-2xl p-4 shadow-md brand-gradient relative" style={{ color: 'var(--brand-white)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-sans opacity-90">Budget calories/day</div>
                    <div className="text-3xl font-bold font-sans">{calorieTarget}</div>
                    <div className="text-xs font-sans mt-1 opacity-90">Maintenance: {maintenance}</div>
                  </div>
                  <button aria-label="Calorie calculation info" onClick={() => setShowCalorieInfo(true)} className="opacity-90">
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Protein Target Warning Modal */}
          {showProteinWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl p-5 max-w-sm mx-4">
                <h3 className="text-lg font-bold mb-2 font-sans" style={{ color: 'var(--brand-black)' }}>You’ve exceeded your protein target</h3>
                <p className="text-sm mb-3 font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Protein total is now {Math.round(portionTotals.protein)} g, which is above your daily target of {proteinTarget} g.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => { setLastWarnedProtein(portionTotals.protein); setShowProteinWarning(false) }} variant="outline" className="flex-1 h-10 rounded-xl border-2 font-sans" style={{ borderColor: 'var(--brand-light-gray)', color: 'var(--brand-black)' }}>OK</Button>
                  <Button onClick={() => { setLastWarnedProtein(portionTotals.protein); setShowProteinWarning(false) }} className="flex-1 h-10 rounded-xl font-sans" style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}>Continue</Button>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 pb-6 border-b" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900 font-sans truncate">{userInput.weight_kg}kg</div>
                  <div className="text-xs text-gray-600 font-sans">Weight</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900 font-sans capitalize truncate">{userInput.goal === "recomposition" ? "Maintenance" : userInput.goal}</div>
                  <div className="text-xs text-gray-600 font-sans">Goal</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900 font-sans capitalize truncate">
                    {userInput.diet_type === "veg"
                      ? "Veg"
                      : userInput.diet_type === "egg"
                        ? "Egg"
                        : userInput.diet_type === "nonveg"
                          ? "Non-Veg"
                          : "Vegan"}
                  </div>
                  <div className="text-xs text-gray-600 font-sans">Diet</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900 font-sans">{userInput.protein_per_kg_slider}g/kg</div>
                  <div className="text-xs text-gray-600 font-sans">Ratio</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl p-3 border text-center font-sans text-sm" style={{ borderColor: 'var(--brand-light-gray)', color: 'var(--brand-dark-gray)', backgroundColor: 'var(--brand-white)' }}>
                <span className="font-semibold">Note:</span> always put protein first in your plate
              </div>
            </div>
          </div>

          {/* Info Modals */}
          {showProteinInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl p-5 max-w-sm mx-4">
                <h3 className="text-lg font-bold mb-2 font-sans" style={{ color: 'var(--brand-black)' }}>How we calculate protein</h3>
                <p className="text-sm mb-3 font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Daily protein target = weight (kg) × protein-per-kg. Your protein-per-kg is auto-selected by your gym days:
                  1–2 days → 1.2 g/kg, 3–4 days → 1.6 g/kg, 5 days → 1.8 g/kg, 6–7 days → 2.0 g/kg.
                </p>
                <button onClick={() => setShowProteinInfo(false)} className="w-full h-10 rounded-xl font-semibold font-sans" style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}>
                  Got it
                </button>
              </div>
            </div>
          )}

          {showCalorieInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl p-5 max-w-sm mx-4">
                <h3 className="text-lg font-bold mb-2 font-sans" style={{ color: 'var(--brand-black)' }}>How we calculate calories</h3>
                <p className="text-sm mb-2 font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Maintenance calories = weight (kg) × 2.2 × activity multiplier.
                  The activity multiplier depends on gym days: 0–2 → 13, 3–4 → 14, 5–6 → 15, 7 → 16.
                </p>
                <p className="text-sm mb-3 font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Budget calories are adjusted from maintenance based on your goal:
                  Cutting → maintenance − 300, Bulking → maintenance + 300, Recomposition → maintenance.
                </p>
                <button onClick={() => setShowCalorieInfo(false)} className="w-full h-10 rounded-xl font-semibold font-sans" style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}>
                  Got it
                </button>
              </div>
            </div>
          )}

          <div className="px-6 py-6" style={{ backgroundColor: 'var(--brand-white)' }}>
            <h2 className="text-xl font-bold text-gray-900 mb-6 font-sans">Your go-to Protein Sources</h2>

            <div className="space-y-4 pb-32">
              {selectedFoodsArray.map((food) => {
                const emoji =
                  (food?.diet_type as any) === "vegetarian"
                    ? "🥬"
                    : (food?.diet_type as any) === "egg"
                      ? "🥚"
                      : (food?.diet_type as any) === "nonveg"
                        ? "🍗"
                        : "🌱"

                const id = food.id
                // portionUnits[id] = GRAMS of this food selected
                const grams = portionUnits[id] || 0
                const { protein, calories, cost, fats, carbs } = calcFoodTotals(food, grams)

                // Measure toggle: 'g', 'ml', 'piece', 'scoop'
                const currentMeasure = measureById[id] || 'piece'

                // Step size based on food type
                const step = stepSizeForFood(food)

                // Cost per 25g protein — accurate regardless of food type
                const cp25 = costPer25gProtein(food)

                const onChangeUnits = (nextGrams: number) => {
                  const clamped = Math.max(0, nextGrams)
                  setPortionUnits((prev) => ({ ...prev, [id]: clamped }))
                }

                const inc = () => onChangeUnits(grams + step)
                const dec = () => onChangeUnits(grams - step)

                return (
                  <div key={food.id} className="mx-auto w-full rounded-3xl border border-zinc-200 bg-white p-5 shadow-lg">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center text-2xl">
                          {emoji}
                        </div>
                        <div>
                          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 font-sans">{food.name}</h2>
                          <div className="mt-1 inline-flex items-center gap-2">
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                              {((food?.diet_type as unknown) as string) === "vegetarian" ? "Veg" :
                                ((food?.diet_type as unknown) as string) === "egg" ? "Egg" : "Non-Veg"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-sm text-zinc-700 shadow-sm">
                        ₹{cp25}/25g protein
                      </div>
                    </div>

                    {/* Macro stats — always show, 0 when no portion selected */}
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-3 shadow-sm bg-white/60 backdrop-blur ring-2 ring-emerald-500/30">
                        <span className="text-sm font-medium text-zinc-500">Proteins</span>
                        <span className="text-3xl font-extrabold text-emerald-600 leading-none">{Math.round(protein * 10) / 10}g</span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-3 shadow-sm bg-white/60 backdrop-blur">
                        <span className="text-sm font-medium text-zinc-500">Fats</span>
                        <span className="text-3xl font-bold text-zinc-800 leading-none">{Math.round(fats * 10) / 10}g</span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-3 shadow-sm bg-white/60 backdrop-blur">
                        <span className="text-sm font-medium text-zinc-500">Carbs</span>
                        <span className="text-3xl font-bold text-zinc-800 leading-none">{Math.round(carbs * 10) / 10}g</span>
                      </div>
                    </div>

                    {/* Quantity stepper + measure toggle */}
                    <div className="mt-6 grid grid-cols-3 items-end gap-4">
                      <div className="col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-zinc-700">Quantity ({currentMeasure})</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={dec}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                              <path d="M5 12h14" strokeLinecap="round" />
                            </svg>
                          </button>
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={Math.round(grams)}
                            onChange={(e) => {
                              const raw = Math.max(0, Math.floor(Number(e.target.value) || 0))
                              onChangeUnits(raw)
                            }}
                            className="h-12 w-full flex-1 rounded-2xl border border-zinc-200 bg-white px-4 text-center text-lg font-semibold tracking-wider text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                          />
                          <button
                            type="button"
                            onClick={inc}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 active:scale-95"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-700">measure</label>
                        <div className="relative">
                          <select
                            value={currentMeasure}
                            onChange={(e) => setMeasureById((prev) => ({ ...prev, [id]: e.target.value as any }))}
                            className="h-12 w-full appearance-none rounded-2xl border border-zinc-200 bg-white px-4 pr-10 text-base font-medium text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                          >
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="piece">piece</option>
                            <option value="scoop">scoop</option>
                          </select>
                          <svg
                            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          >
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Live totals */}
                    <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-emerald-900">
                      <p className="text-sm font-semibold">Live totals</p>
                      <p className="mt-1 text-lg font-bold">
                        Protein: <span className="font-extrabold">{Math.round(protein * 10) / 10} g</span>
                        {" · "}
                        Calories: <span className="font-extrabold">{Math.round(calories)} kcal</span>
                        {" · "}
                        Cost: <span className="font-extrabold">₹{Math.round(cost)}</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sticky summary */}
          <div className="fixed bottom-0 left-0 right-0 border-t p-4 shadow-2xl" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-sans" style={{ color: 'var(--brand-dark-gray)' }}>
                  Protein: {Math.round(portionTotals.protein)} g / {proteinTarget} g
                </div>
                <div className="text-sm font-sans" style={{ color: 'var(--brand-dark-gray)' }}>
                  Cost: ₹{Math.round(portionTotals.cost)}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--brand-light-gray)' }}>
                  <div className="h-2" style={{ width: `${Math.min(100, (portionTotals.protein / Math.max(1, proteinTarget)) * 100)}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--brand-light-gray)' }}>
                  <div className="h-2" style={{ width: `${Math.min(100, (portionTotals.cost / Math.max(1, 1)) * 10)}%`, background: portionTotals.cost > 0 ? 'linear-gradient(90deg, #6366f1, #06b6d4)' : 'transparent' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="flex-1 h-12 text-base font-semibold rounded-xl border-2 font-sans" style={{ borderColor: 'var(--brand-light-gray)', backgroundColor: 'var(--brand-white)', color: 'var(--brand-black)' }}>← Back</Button>
                <Button className="flex-1 h-12 text-base font-semibold rounded-xl shadow-lg font-sans" style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}>Save Plan</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 1) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-white)' }}>
        <div className="max-w-md mx-auto px-4 sm:px-6">
          {/* Header - sticky logo + tagline + step indicator */}
          <div className="sticky top-0 z-20 bg-[var(--brand-white)]/95 backdrop-blur text-center py-4 sm:py-5 border-b" style={{ borderColor: 'var(--brand-light-gray)' }}>
            <Image
              src="/logo.png"
              alt="PickProtein logo"
              width={192}
              height={48}
              className="mx-auto mb-2 sm:mb-3 h-12 sm:h-14 w-auto"
              priority
            />
            <p className="text-base sm:text-lg font-sans" style={{ color: 'var(--brand-warm-gray)' }}>Your Protein intake is on Me, Champ!</p>
            <div className="flex items-center justify-center mt-4 space-x-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow" style={{ background: 'var(--brand-dark-gray)', color: 'var(--brand-white)' }}>
                1
              </div>
              <div className="w-16 h-2 rounded-full brand-gradient-soft"></div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--brand-light-gray)', color: 'var(--brand-medium-gray)' }}>
                2
              </div>
              <div className="w-16 h-2 rounded-full" style={{ background: 'var(--brand-light-gray)' }}></div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--brand-light-gray)', color: 'var(--brand-medium-gray)' }}>
                3
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-32">
            {/* Weight - Enhanced mobile layout */}
            <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--brand-white)' }}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4" style={{ background: "linear-gradient(135deg, var(--brand-dark-gray), var(--brand-warm-gray))", color: "var(--brand-white)" }}>
                    <Scales size={28} weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold font-sans" style={{ color: 'var(--brand-black)' }}>Weight</h3>
                    <p className="text-sm font-sans" style={{ color: 'var(--brand-warm-gray)' }}>Enter your current weight</p>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder="Weight in kg"
                  value={userInput.weight_kg || ""}
                  onChange={(e) => setUserInput({ ...userInput, weight_kg: Number.parseFloat(e.target.value) || 0 })}
                  className="h-12 sm:h-14 text-base sm:text-lg border-2 rounded-xl sm:rounded-2xl font-sans"
                  style={{ borderColor: 'var(--brand-light-gray)', backgroundColor: 'var(--brand-white)' }}
                />
              </CardContent>
            </Card>

            {/* Gender - Better responsive grid */}
            <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--brand-white)' }}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4" style={{ background: "linear-gradient(135deg, var(--brand-dark-gray), var(--brand-warm-gray))", color: "var(--brand-white)" }}>
                    <UserIcon size={28} weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold font-sans" style={{ color: 'var(--brand-black)' }}>Gender</h3>
                    <p className="text-sm font-sans" style={{ color: 'var(--brand-warm-gray)' }}>Select your gender</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { value: "male", label: "Male", emoji: "👨" },
                    { value: "female", label: "Female", emoji: "👩" },
                  ].map((gender) => (
                    <button
                      key={gender.value}
                      onClick={() => setUserInput({ ...userInput, gender: gender.value as "male" | "female" })}
                      className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${userInput.gender === gender.value
                        ? "brand-active shadow-lg"
                        : "bg-[var(--brand-white)]"
                        }`}
                      style={{ borderColor: 'var(--brand-light-gray)', color: userInput.gender === gender.value ? 'var(--brand-white)' : 'var(--brand-dark-gray)' }}
                    >
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">{gender.emoji}</div>
                      <div className="font-bold text-base sm:text-lg font-sans">{gender.label}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Diet - Better mobile grid layout */}
            <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--brand-white)' }}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4" style={{ background: "linear-gradient(135deg, var(--brand-dark-gray), var(--brand-warm-gray))", color: "var(--brand-white)" }}>
                    <Leaf size={28} weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold font-sans" style={{ color: 'var(--brand-black)' }}>Diet Type</h3>
                    <p className="text-sm font-sans" style={{ color: 'var(--brand-warm-gray)' }}>What can you eat?</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { value: "veg", label: "Vegetarian", emoji: "🥬" },
                    { value: "egg", label: "Eggetarian", emoji: "🥚" },
                    { value: "nonveg", label: "Non-Veg", emoji: "🍗" },
                    { value: "vegan", label: "Vegan", emoji: "🌱" },
                  ].map((diet) => (
                    <button
                      key={diet.value}
                      onClick={() => setUserInput({ ...userInput, diet_type: diet.value as any })}
                      className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 flex items-center justify-center sm:justify-start ${userInput.diet_type === diet.value
                        ? "brand-active shadow-lg"
                        : "bg-[var(--brand-white)]"
                        }`}
                      style={{ borderColor: 'var(--brand-light-gray)', color: userInput.diet_type === diet.value ? 'var(--brand-white)' : 'var(--brand-dark-gray)' }}
                    >
                      <span className="text-2xl sm:text-3xl mr-0 sm:mr-4">{diet.emoji}</span>
                      <span className="font-bold text-xs sm:text-sm font-sans">{diet.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Goal - Stack on mobile for better readability */}
            <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--brand-white)' }}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4" style={{ background: "linear-gradient(135deg, var(--brand-dark-gray), var(--brand-warm-gray))", color: "var(--brand-white)" }}>
                    <Target size={28} weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold font-sans" style={{ color: 'var(--brand-black)' }}>Goal</h3>
                    <p className="text-sm font-sans" style={{ color: 'var(--brand-warm-gray)' }}>What's your fitness goal?</p>
                  </div>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {[
                    { value: "cut", label: "Cut (Lose Fat)", emoji: "🔥" },
                    { value: "bulk", label: "Bulk (Gain Muscle)", emoji: "💪" },
                    { value: "recomposition", label: "Recomposition", emoji: "⚖️" },
                  ].map((goal) => (
                    <button
                      key={goal.value}
                      onClick={() => setUserInput({ ...userInput, goal: goal.value as any })}
                      className={`w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 flex items-center ${userInput.goal === goal.value
                        ? "brand-active shadow-lg"
                        : "bg-[var(--brand-white)]"
                        }`}
                      style={{ borderColor: 'var(--brand-light-gray)', color: userInput.goal === goal.value ? 'var(--brand-white)' : 'var(--brand-dark-gray)' }}
                    >
                      <span className="text-2xl sm:text-3xl mr-3 sm:mr-4">{goal.emoji}</span>
                      <span className="font-bold text-base sm:text-lg font-sans">{goal.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Protein Intake section removed: auto-selected from gym days */}

            <Card className="border-0 shadow-xl bg-white rounded-2xl sm:rounded-3xl overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4" style={{ background: "linear-gradient(135deg, var(--brand-dark-gray), var(--brand-warm-gray))", color: "var(--brand-white)" }}>
                    <Barbell size={28} weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 font-sans">Workout</h3>
                    <p className="text-sm text-gray-600 font-sans">how many day per week</p>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                    <button
                      key={days}
                      onClick={() => setUserInput({ ...userInput, gym_days_per_week: days })}
                      className="p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all duration-300 transform hover:scale-105 shadow-sm"
                      style={{
                        borderColor:
                          userInput.gym_days_per_week === days
                            ? 'var(--brand-dark-gray)'
                            : 'var(--brand-light-gray)',
                        backgroundColor:
                          userInput.gym_days_per_week === days
                            ? 'var(--brand-dark-gray)'
                            : 'var(--brand-white)',
                        color:
                          userInput.gym_days_per_week === days
                            ? 'var(--brand-white)'
                            : 'var(--brand-dark-gray)'
                      }}
                    >
                      <div className="text-sm sm:text-base font-bold font-sans">{days}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fixed Bottom Button - Better mobile positioning */}
          <div className="fixed bottom-0 left-0 right-0 border-t p-4 shadow-2xl" style={{ background: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <div className="max-w-md mx-auto">
              <div className="text-center mb-4">
                <div className="text-xs font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Made with <span style={{ color: 'var(--brand-dark-gray)' }}>♥</span> by <a href="https://www.instagram.com/lifeofanirudhh/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-dark-gray)', fontWeight: 700, fontStyle: 'italic' }}>Anirudh</a>
                </div>
              </div>
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!userInput.weight_kg || userInput.weight_kg <= 0}
                className="w-full h-12 sm:h-14 text-lg sm:text-xl font-bold rounded-xl sm:rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105 font-sans"
                style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}
              >
                Next →
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 2) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-white)' }}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse" style={{ background: 'linear-gradient(135deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}>
              <span className="text-2xl">🥗</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: 'var(--brand-warm-gray)' }}>Loading protein sources...</p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen" style={{ backgroundColor: 'var(--brand-white)' }}>
          {/* Header */}
          <div className="text-center py-6 px-4 sticky top-0 z-20 border-b" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <Image
              src="/logo.png"
              alt="PickProtein logo"
              width={160}
              height={40}
              className="mx-auto mb-2 h-10 w-auto"
            />
            <p className="text-base font-sans" style={{ color: 'var(--brand-warm-gray)' }}>Select sources you can easily get</p>

            {/* Progress */}
            <div className="flex items-center justify-center mt-6 space-x-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--brand-dark-gray)' }}>
                ✓
              </div>
              <div className="w-16 h-2 rounded-full brand-gradient"></div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--brand-dark-gray)' }}>
                2
              </div>
              <div className="w-16 h-2 rounded-full" style={{ background: 'var(--brand-light-gray)' }}></div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--brand-light-gray)', color: 'var(--brand-medium-gray)' }}>
                3
              </div>
            </div>
          </div>

          {/* Removed sticky counter per requirements */}

          {/* Search + Select/Clear */}
          <div className="px-4 py-4" style={{ backgroundColor: 'var(--brand-white)' }}>
            <div className="flex items-center justify-end gap-2 mb-3">
              <Button
                onClick={handleSelectAll}
                size="sm"
                className="rounded-xl font-sans font-semibold"
                style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}
              >
                Select All
              </Button>
              <Button
                onClick={handleClearAll}
                variant="outline"
                size="sm"
                className="rounded-xl font-sans font-semibold"
                style={{ borderColor: 'var(--brand-light-gray)', backgroundColor: 'var(--brand-white)', color: 'var(--brand-black)' }}
              >
                Clear All
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--brand-medium-gray)' }} />
              <Input
                placeholder="Search proteins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 border-2 rounded-2xl font-sans"
                style={{ borderColor: 'var(--brand-light-gray)', backgroundColor: 'var(--brand-white)' }}
              />
            </div>
          </div>

          {/* Protein Selection */}
          <div className="px-4 py-4 pb-32" style={{ backgroundColor: 'var(--brand-white)' }}>
            {filteredFoods.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 font-sans">No protein sources found for your diet type.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFoods.map((food) => (
                  <div
                    key={food.id}
                    onClick={() => handleSourceToggle(food.id)}
                    className={`w-full p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${selectedSources.has(food.id)
                      ? "brand-active shadow-lg"
                      : "shadow-sm"
                      }`}
                    style={{ borderColor: 'var(--brand-light-gray)', backgroundColor: selectedSources.has(food.id) ? 'var(--brand-dark-gray)' : 'var(--brand-white)', color: selectedSources.has(food.id) ? 'var(--brand-white)' : 'var(--brand-dark-gray)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${(food.diet_type as any) === "vegetarian"
                            ? "bg-green-100"
                            : (food.diet_type as any) === "egg"
                              ? "bg-yellow-100"
                              : (food.diet_type as any) === "nonveg"
                                ? "bg-red-100"
                                : "bg-green-200"
                            }`}
                        >
                          {((food.diet_type as unknown) as string) === "vegetarian"
                            ? "🥬"
                            : ((food.diet_type as unknown) as string) === "egg"
                              ? "🥚"
                              : ((food.diet_type as unknown) as string) === "nonveg"
                                ? "🍗"
                                : "🌱"}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg font-sans" style={{ color: selectedSources.has(food.id) ? 'var(--brand-white)' : 'var(--brand-dark-gray)' }}>{food.name}</h3>
                          {/* Removed complete/incomplete badge per requirements */}
                        </div>
                      </div>

                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all`}
                        style={{ background: selectedSources.has(food.id) ? 'var(--brand-dark-gray)' : 'var(--brand-white)', color: selectedSources.has(food.id) ? 'var(--brand-white)' : 'var(--brand-dark-gray)', border: selectedSources.has(food.id) ? 'none' : `2px solid var(--brand-light-gray)` }}
                      >
                        {selectedSources.has(food.id) && <span className="text-sm font-bold">✓</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 border-t p-4 shadow-2xl" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <div className="max-w-md mx-auto">
              <div className="text-center mb-4">
                <div className="text-xs font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Made with <span style={{ color: 'var(--brand-dark-gray)' }}>♥</span> by <a href="https://www.instagram.com/lifeofanirudhh/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-dark-gray)', fontWeight: 700, fontStyle: 'italic' }}>Anirudh</a>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 h-12 text-base font-semibold rounded-2xl border-2 font-sans bg-transparent"
                  style={{ borderColor: 'var(--brand-light-gray)', color: 'var(--brand-black)' }}
                >
                  ← Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!isStep2Valid}
                  className="flex-1 h-12 text-base font-semibold rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105 font-sans"
                  style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)', opacity: isStep2Valid ? 1 : 0.6 }}
                >
                  Generate my protein →
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 4: Adjust Portions with live price and protein totals
  if (currentStep === 4) {
    const selectedFoodsArray = foods.filter((f) => selectedSources.has(f.id))
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen" style={{ backgroundColor: 'var(--brand-white)' }}>
          <div className="px-6 py-6 text-center border-b" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <Image src="/logo.png" alt="PickProtein logo" width={160} height={40} className="mx-auto mb-2 h-10 w-auto" />
            <h2 className="text-xl font-bold font-sans" style={{ color: 'var(--brand-dark-gray)' }}>Adjust Portions</h2>
            <p className="text-sm font-sans" style={{ color: 'var(--brand-warm-gray)' }}>Move sliders to choose how much you’ll eat from each source</p>
          </div>

          <div className="px-6 py-4" style={{ backgroundColor: 'var(--brand-white)' }}>
            <div className="rounded-2xl p-4 brand-gradient text-center mb-4" style={{ color: 'var(--brand-white)' }}>
              <div className="text-sm font-sans opacity-90">Current totals</div>
              <div className="text-lg font-bold font-sans">Protein: {Math.round(portionTotals.protein)}g • Calories: {Math.round(portionTotals.calories)} • Cost: ₹{Math.round(portionTotals.cost)}</div>
              <div className="text-xs font-sans opacity-90 mt-1">Target: {proteinTarget}g protein</div>
            </div>

            <div className="space-y-4 pb-32">
              {selectedFoodsArray.map((f) => {
                // portionUnits[id] = GRAMS of this food selected
                const grams = portionUnits[f.id] || 0
                const { protein, calories, cost } = calcFoodTotals(f, grams)

                // Step 4 gram/ml input: show grams directly
                // portionUnits stores grams; value shown = grams
                const isGramLike = measureById[f.id] === 'g'
                const isMilliLike = measureById[f.id] === 'ml'

                return (
                  <Card key={f.id} className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-900 font-sans">{f.name}</h3>
                      </div>
                      <div className="text-sm font-sans mb-3" style={{ color: 'var(--brand-warm-gray)' }}>
                        {Math.round(protein)}g protein · {Math.round(calories)} kcal · ₹{Math.round(cost)}
                      </div>
                      {/* Gram/ml direct input */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                            {isMilliLike ? 'mL' : 'g'}
                          </span>
                          <Input
                            value={Math.round(grams)}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value)
                              const next = isNaN(raw) ? 0 : Math.max(0, raw)
                              setPortionUnits((prev) => ({ ...prev, [f.id]: next }))
                            }}
                            className="w-24 text-center h-9 rounded-lg border-2 font-sans"
                            style={{ borderColor: 'var(--brand-light-gray)' }}
                          />
                        </div>
                        <div className="ml-auto text-right font-sans text-sm" style={{ color: 'var(--brand-dark-gray)' }}>
                          {isMilliLike ? 'ml' : 'g'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t p-6 shadow-2xl" style={{ backgroundColor: 'var(--brand-white)', borderColor: 'var(--brand-light-gray)' }}>
            <div className="max-w-md mx-auto">
              <div className="text-center mb-4">
                <div className="text-xs font-sans" style={{ color: 'var(--brand-warm-gray)' }}>
                  Made with <span style={{ color: 'var(--brand-dark-gray)' }}>♥</span> by <a href="https://www.instagram.com/lifeofanirudhh/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-dark-gray)', fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline' }}>Anirudh</a>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep(3)} variant="outline" className="flex-1 h-12 text-base font-semibold rounded-xl border-2 font-sans" style={{ borderColor: 'var(--brand-light-gray)', backgroundColor: 'var(--brand-white)', color: 'var(--brand-black)' }}>← Back</Button>
                <Button onClick={handleSaveToGallery} className="flex-1 h-12 text-base font-semibold rounded-xl shadow-lg font-sans" style={{ background: 'linear-gradient(90deg, var(--brand-dark-gray), var(--brand-warm-gray))', color: 'var(--brand-white)' }}>
                  <Download className="w-4 h-4 mr-2" /> Save to Gallery
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ... fallthrough
}
