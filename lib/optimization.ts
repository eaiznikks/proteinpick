import { type ProteinSource, getProteinSourcesByDiet, sortByCostPerGramProtein } from "./protein-data"
import type { UserData, NutritionRequirements } from "./calculations"

export interface OptimizedProteinPlan {
  sources: SelectedProteinSource[]
  totalProtein: number
  totalCost: number
  totalCalories: number
  proteinDeficit: number
  isComplete: boolean
}

export interface SelectedProteinSource extends ProteinSource {
  quantity: number
  totalProtein: number
  totalCost: number
  totalCalories: number
  isRemoved?: boolean
}

/**
 * Main optimization function that creates a cost-effective protein plan
 * Following 80% complete protein, 20% incomplete protein rule
 */
export function optimizeProteinPlan(
  userData: UserData,
  nutritionRequirements: NutritionRequirements,
  excludedSourceIds: string[] = [],
): OptimizedProteinPlan {
  // Get available protein sources based on dietary preference
  const availableSources = getProteinSourcesByDiet(userData.dietaryPreference).filter(
    (source) => !excludedSourceIds.includes(source.id),
  )

  const completeSources = availableSources.filter((source) => source.category !== "plant-incomplete")
  const incompleteSources = availableSources.filter((source) => source.category === "plant-incomplete")

  // Sort both categories by cost efficiency
  const sortedCompleteSources = sortByCostPerGramProtein(completeSources)
  const sortedIncompleteSources = sortByCostPerGramProtein(incompleteSources)

  const selectedSources: SelectedProteinSource[] = []
  let totalCost = 0
  let totalCalories = 0

  const completeProteinTarget = nutritionRequirements.dailyProtein * 0.8
  const incompleteProteinTarget = nutritionRequirements.dailyProtein * 0.2

  let remainingCompleteProtein = completeProteinTarget
  let remainingIncompleteProtein = incompleteProteinTarget

  // First, fulfill 80% from complete protein sources
  const highEfficiencyComplete = sortedCompleteSources.slice(0, Math.ceil(sortedCompleteSources.length * 0.4))
  const mediumEfficiencyComplete = sortedCompleteSources.slice(
    Math.ceil(sortedCompleteSources.length * 0.4),
    Math.ceil(sortedCompleteSources.length * 0.8),
  )

  // Strategy for complete proteins: prioritize variety and efficiency
  const completeCategories = [
    { sources: highEfficiencyComplete, maxSources: 3, priority: 1 },
    { sources: mediumEfficiencyComplete, maxSources: 2, priority: 2 },
  ]

  for (const category of completeCategories) {
    if (remainingCompleteProtein <= 0) break

    let sourcesUsedInCategory = 0
    for (const source of category.sources) {
      if (remainingCompleteProtein <= 0 || sourcesUsedInCategory >= category.maxSources) break

      const optimalQuantity = calculateOptimalQuantity(source, remainingCompleteProtein, userData.goal)

      if (optimalQuantity > 0) {
        const proteinFromSource = Math.min(source.protein * optimalQuantity, remainingCompleteProtein)
        const adjustedQuantity = proteinFromSource / source.protein

        const selectedSource: SelectedProteinSource = {
          ...source,
          quantity: adjustedQuantity,
          totalProtein: proteinFromSource,
          totalCost: source.cost * adjustedQuantity,
          totalCalories: source.calories * adjustedQuantity,
        }

        selectedSources.push(selectedSource)
        remainingCompleteProtein -= proteinFromSource
        totalCost += selectedSource.totalCost
        totalCalories += selectedSource.totalCalories
        sourcesUsedInCategory++
      }
    }
  }

  // Then, fulfill 20% from incomplete protein sources
  for (const source of sortedIncompleteSources) {
    if (remainingIncompleteProtein <= 5) break // Stop when close to target

    const optimalQuantity = calculateOptimalQuantity(source, remainingIncompleteProtein, userData.goal)

    if (optimalQuantity > 0) {
      const proteinFromSource = Math.min(source.protein * optimalQuantity, remainingIncompleteProtein)
      const adjustedQuantity = proteinFromSource / source.protein

      const selectedSource: SelectedProteinSource = {
        ...source,
        quantity: adjustedQuantity,
        totalProtein: proteinFromSource,
        totalCost: source.cost * adjustedQuantity,
        totalCalories: source.calories * adjustedQuantity,
      }

      selectedSources.push(selectedSource)
      remainingIncompleteProtein -= proteinFromSource
      totalCost += selectedSource.totalCost
      totalCalories += selectedSource.totalCalories
    }
  }

  // If still short on total protein, add more from the most efficient complete sources
  const totalRemainingProtein = remainingCompleteProtein + remainingIncompleteProtein
  if (totalRemainingProtein > 0 && sortedCompleteSources.length > 0) {
    const topEfficiencySource = sortedCompleteSources[0]
    const additionalQuantity = totalRemainingProtein / topEfficiencySource.protein

    const existingSource = selectedSources.find((s) => s.id === topEfficiencySource.id)
    if (existingSource) {
      existingSource.quantity += additionalQuantity
      existingSource.totalProtein += totalRemainingProtein
      existingSource.totalCost += topEfficiencySource.cost * additionalQuantity
      existingSource.totalCalories += topEfficiencySource.calories * additionalQuantity
      totalCost += topEfficiencySource.cost * additionalQuantity
      totalCalories += topEfficiencySource.calories * additionalQuantity
    } else {
      const additionalSource: SelectedProteinSource = {
        ...topEfficiencySource,
        quantity: additionalQuantity,
        totalProtein: totalRemainingProtein,
        totalCost: topEfficiencySource.cost * additionalQuantity,
        totalCalories: topEfficiencySource.calories * additionalQuantity,
      }
      selectedSources.push(additionalSource)
      totalCost += additionalSource.totalCost
      totalCalories += additionalSource.totalCalories
    }
  }

  const totalProtein = selectedSources.reduce((sum, source) => sum + source.totalProtein, 0)
  const proteinDeficit = Math.max(0, nutritionRequirements.dailyProtein - totalProtein)

  return {
    sources: selectedSources,
    totalProtein: Math.round(totalProtein),
    totalCost: Math.round(totalCost),
    totalCalories: Math.round(totalCalories),
    proteinDeficit: Math.round(proteinDeficit),
    isComplete: proteinDeficit <= 5,
  }
}

/**
 * Calculate optimal quantity for a protein source
 */
function calculateOptimalQuantity(source: ProteinSource, remainingProtein: number, goal: "cut" | "bulk"): number {
  // Base quantity to meet protein needs
  let baseQuantity = Math.min(1, remainingProtein / source.protein)

  // Adjust based on source type and goal
  if (source.category === "dairy" && source.id.includes("whey")) {
    // Limit whey protein to 1-2 scoops max
    baseQuantity = Math.min(baseQuantity, 2)
  } else if (source.category === "plant-incomplete") {
    // Limit incomplete proteins as they shouldn't be the primary source
    baseQuantity = Math.min(baseQuantity, 0.5)
  } else if (source.category === "eggs-meat" && goal === "cut") {
    // Favor lean proteins during cutting
    baseQuantity = Math.min(baseQuantity, 1.2)
  }

  // Ensure minimum viable quantity
  return Math.max(0.1, Math.min(2, baseQuantity))
}

/**
 * Recalculate plan when sources are removed
 */
export function recalculateWithRemovedSources(
  originalPlan: OptimizedProteinPlan,
  removedSourceIds: string[],
  userData: UserData,
  nutritionRequirements: NutritionRequirements,
): OptimizedProteinPlan {
  // Get all excluded sources (originally excluded + newly removed)
  const allExcludedIds = [...removedSourceIds]

  // Recalculate the entire plan
  return optimizeProteinPlan(userData, nutritionRequirements, allExcludedIds)
}

/**
 * Get cost efficiency score for display
 */
export function getCostEfficiencyScore(source: SelectedProteinSource): string {
  const costPerGram = source.totalCost / source.totalProtein

  if (costPerGram < 2) return "Excellent"
  if (costPerGram < 4) return "Good"
  if (costPerGram < 6) return "Fair"
  return "Expensive"
}

/**
 * Get cost efficiency color for UI
 */
export function getCostEfficiencyColor(source: SelectedProteinSource): string {
  const costPerGram = source.totalCost / source.totalProtein

  if (costPerGram < 2) return "text-green-600"
  if (costPerGram < 4) return "text-blue-600"
  if (costPerGram < 6) return "text-yellow-600"
  return "text-red-600"
}

/**
 * Format quantity for display
 */
export function formatQuantity(source: SelectedProteinSource): string {
  if (source.quantity === 1) {
    return source.amount
  }

  // Handle different quantity formats
  if (source.amount.includes("scoop")) {
    const scoops = Math.round(source.quantity)
    return `${scoops} ${scoops === 1 ? "scoop" : "scoops"}`
  }

  if (source.amount.includes("Eggs")) {
    const eggs = Math.round(source.quantity * 4) // 4 eggs per serving
    return `${eggs} Eggs`
  }

  if (source.amount.includes("Whites")) {
    const whites = Math.round(source.quantity * 6) // 6 whites per serving
    return `${whites} Whites`
  }

  // For weight-based items, multiply the base amount
  const match = source.amount.match(/(\d+)\s*(g|gms|ml)/i)
  if (match) {
    const baseAmount = Number.parseInt(match[1])
    const unit = match[2]
    const totalAmount = Math.round(baseAmount * source.quantity)
    return `${totalAmount} ${unit}`
  }

  return `${source.quantity.toFixed(1)}x ${source.amount}`
}
