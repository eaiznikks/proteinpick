export interface ProteinSource {
  id: string
  name: string
  category: "dairy" | "eggs-meat" | "plant-complete" | "plant-incomplete"
  amount: string
  calories: number
  cost: number
  protein: number
  fats: number
  carbs: number
  caloriesPer100g: number
  dietaryCompatibility: ("vegan" | "vegetarian" | "eggetarian" | "non-vegetarian")[]
  emoji: string
}

export const proteinSources: ProteinSource[] = [
  // Dairy (Vegetarian)
  {
    id: "toned-milk",
    name: "Toned Milk",
    category: "dairy",
    amount: "800 ml",
    calories: 480,
    cost: 32,
    protein: 3.1,
    fats: 3,
    carbs: 4.6,
    caloriesPer100g: 60,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥛",
  },
  {
    id: "low-fat-milk",
    name: "Low Fat Milk (Double Toned)",
    category: "dairy",
    amount: "700 ml",
    calories: 280,
    cost: 45,
    protein: 3.5,
    fats: 0.5,
    carbs: 5,
    caloriesPer100g: 40,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥛",
  },
  {
    id: "paneer",
    name: "Paneer",
    category: "dairy",
    amount: "150 gms",
    calories: 420,
    cost: 62,
    protein: 18,
    fats: 22,
    carbs: 2,
    caloriesPer100g: 280,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🧀",
  },
  {
    id: "cheese",
    name: "Cheese",
    category: "dairy",
    amount: "150 gms",
    calories: 450,
    cost: 100,
    protein: 17,
    fats: 25,
    carbs: 4,
    caloriesPer100g: 300,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🧀",
  },
  {
    id: "low-fat-paneer",
    name: "Low Fat Paneer",
    category: "dairy",
    amount: "100 gms",
    calories: 150,
    cost: 45,
    protein: 25,
    fats: 5,
    carbs: 5,
    caloriesPer100g: 150,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🧀",
  },
  {
    id: "curd",
    name: "Curd",
    category: "dairy",
    amount: "700 gms",
    calories: 420,
    cost: 60,
    protein: 3.5,
    fats: 3,
    carbs: 4.8,
    caloriesPer100g: 60,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥛",
  },
  {
    id: "greek-yogurt",
    name: "Greek Yogurt",
    category: "dairy",
    amount: "300 gms",
    calories: 240,
    cost: 140,
    protein: 8,
    fats: 2.2,
    carbs: 6,
    caloriesPer100g: 75,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥛",
  },
  {
    id: "whey-protein-conc",
    name: "Whey Protein Conc.",
    category: "dairy",
    amount: "1 scoop (23 g)",
    calories: 120,
    cost: 40,
    protein: 70.3,
    fats: 3.1,
    carbs: 14.5,
    caloriesPer100g: 365,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥤",
  },
  {
    id: "whey-protein-iso",
    name: "Whey Protein Iso.",
    category: "dairy",
    amount: "1 scoop (27 g)",
    calories: 120,
    cost: 53,
    protein: 81,
    fats: 1.84,
    carbs: 6,
    caloriesPer100g: 365,
    dietaryCompatibility: ["vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥤",
  },

  // Eggs & Meat (Non-Veg)
  {
    id: "eggs",
    name: "Eggs",
    category: "eggs-meat",
    amount: "4 Eggs",
    calories: 280,
    cost: 24,
    protein: 6,
    fats: 5,
    carbs: 1,
    caloriesPer100g: 70,
    dietaryCompatibility: ["eggetarian", "non-vegetarian"],
    emoji: "🥚",
  },
  {
    id: "egg-whites",
    name: "Egg Whites",
    category: "eggs-meat",
    amount: "6 Whites",
    calories: 100,
    cost: 36,
    protein: 3.5,
    fats: 0,
    carbs: 0,
    caloriesPer100g: 17,
    dietaryCompatibility: ["eggetarian", "non-vegetarian"],
    emoji: "🥚",
  },
  {
    id: "red-meats",
    name: "Red Meats (Mutton, Beef)",
    category: "eggs-meat",
    amount: "100 g",
    calories: 200,
    cost: 50,
    protein: 26,
    fats: 15,
    carbs: 0,
    caloriesPer100g: 200,
    dietaryCompatibility: ["non-vegetarian"],
    emoji: "🥩",
  },
  {
    id: "prawns",
    name: "Prawns",
    category: "eggs-meat",
    amount: "110 g",
    calories: 110,
    cost: 60,
    protein: 20,
    fats: 1.5,
    carbs: 1,
    caloriesPer100g: 100,
    dietaryCompatibility: ["non-vegetarian"],
    emoji: "🦐",
  },
  {
    id: "fish",
    name: "Other Fishes (Tilapia, Pomphret, Salmon)",
    category: "eggs-meat",
    amount: "100-125 g",
    calories: 160,
    cost: 50,
    protein: 22,
    fats: 7,
    carbs: 0,
    caloriesPer100g: 160,
    dietaryCompatibility: ["non-vegetarian"],
    emoji: "🐟",
  },
  {
    id: "chicken-breast",
    name: "Chicken Breast",
    category: "eggs-meat",
    amount: "80 g",
    calories: 135,
    cost: 30,
    protein: 31,
    fats: 0,
    carbs: 3.6,
    caloriesPer100g: 165,
    dietaryCompatibility: ["non-vegetarian"],
    emoji: "🍗",
  },

  // Plant Sources (Complete)
  {
    id: "soya-chunks",
    name: "Soya Chunks",
    category: "plant-complete",
    amount: "50 g",
    calories: 180,
    cost: 8,
    protein: 52,
    fats: 0.5,
    carbs: 33,
    caloriesPer100g: 360,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🌱",
  },
  {
    id: "tofu",
    name: "Tofu",
    category: "plant-complete",
    amount: "150 g",
    calories: 240,
    cost: 50,
    protein: 8,
    fats: 4,
    carbs: 2,
    caloriesPer100g: 160,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🧈",
  },
  {
    id: "tempeh",
    name: "Tempeh",
    category: "plant-complete",
    amount: "150 g",
    calories: 250,
    cost: 110,
    protein: 19,
    fats: 11,
    carbs: 9,
    caloriesPer100g: 190,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🌱",
  },
  {
    id: "plant-meat",
    name: "Plant Meat",
    category: "plant-complete",
    amount: "110 g",
    calories: 250,
    cost: 75,
    protein: 20,
    fats: 14,
    carbs: 9,
    caloriesPer100g: 227,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🌱",
  },
  {
    id: "plant-protein-powder",
    name: "Plant Protein Powder",
    category: "plant-complete",
    amount: "1 scoop (25 g)",
    calories: 120,
    cost: 75,
    protein: 75,
    fats: 1.84,
    carbs: 10,
    caloriesPer100g: 370,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🥤",
  },
  {
    id: "protein-bars",
    name: "Protein Bars",
    category: "plant-complete",
    amount: "1 bar",
    calories: 230,
    cost: 75,
    protein: 20,
    fats: 8,
    carbs: 22,
    caloriesPer100g: 230,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🍫",
  },

  // Plant Sources (Incomplete)
  {
    id: "dals-sprouts",
    name: "All Dals & Sprouts",
    category: "plant-incomplete",
    amount: "100 g",
    calories: 350,
    cost: 9,
    protein: 24,
    fats: 1.2,
    carbs: 63,
    caloriesPer100g: 350,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🌾",
  },
  {
    id: "chole-rajma-chana-besan",
    name: "Chole, Rajma, Chana, Besan",
    category: "plant-incomplete",
    amount: "100 g",
    calories: 350,
    cost: 12,
    protein: 24,
    fats: 1.2,
    carbs: 63,
    caloriesPer100g: 350,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🌾",
  },
  {
    id: "sattu",
    name: "Sattu",
    category: "plant-incomplete",
    amount: "100 g",
    calories: 350,
    cost: 18,
    protein: 24,
    fats: 1.2,
    carbs: 63,
    caloriesPer100g: 350,
    dietaryCompatibility: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    emoji: "🌾",
  },
]

export function getProteinSourcesByDiet(
  dietaryPreference: "vegan" | "vegetarian" | "eggetarian" | "non-vegetarian",
): ProteinSource[] {
  return proteinSources.filter((source) => source.dietaryCompatibility.includes(dietaryPreference))
}

export function getProteinSourcesByCategory(category: ProteinSource["category"]): ProteinSource[] {
  return proteinSources.filter((source) => source.category === category)
}

export function calculateProteinEfficiency(source: ProteinSource): number {
  // Calculate protein per rupee (higher is better)
  return source.protein / source.cost
}

export function calculateCostPerGramProtein(source: ProteinSource): number {
  // Calculate cost per gram of protein (lower is better)
  return source.cost / source.protein
}

export function sortByProteinEfficiency(sources: ProteinSource[]): ProteinSource[] {
  return [...sources].sort((a, b) => calculateProteinEfficiency(b) - calculateProteinEfficiency(a))
}

export function sortByCostPerGramProtein(sources: ProteinSource[]): ProteinSource[] {
  return [...sources].sort((a, b) => calculateCostPerGramProtein(a) - calculateCostPerGramProtein(b))
}

export function getCategoryName(category: ProteinSource["category"]): string {
  switch (category) {
    case "dairy":
      return "Dairy Products"
    case "eggs-meat":
      return "Eggs & Meat"
    case "plant-complete":
      return "Complete Plant Proteins"
    case "plant-incomplete":
      return "Incomplete Plant Proteins"
    default:
      return category
  }
}

export function getCategoryEmoji(category: ProteinSource["category"]): string {
  switch (category) {
    case "dairy":
      return "🥛"
    case "eggs-meat":
      return "🥚"
    case "plant-complete":
      return "🌱"
    case "plant-incomplete":
      return "🌾"
    default:
      return "🍽️"
  }
}
