import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { UserInput, FoodItem } from "@/lib/types"

interface PosterProps {
  userInput: UserInput
  proteinTarget: number
  maintenance: number
  budgetCalories: number
  foods: FoodItem[]
}

export function Poster({ userInput, proteinTarget, maintenance, budgetCalories, foods }: PosterProps) {
  const selectedFoods = foods

  const getDietLabel = (dietType: string) => {
    switch (dietType) {
      case "veg":
        return "Vegetarian"
      case "egg":
        return "Eggetarian"
      case "nonveg":
        return "Non-Vegetarian"
      case "vegan":
        return "Vegan"
      default:
        return dietType
    }
  }

  const getGoalLabel = (goal: string) => {
    switch (goal) {
      case "cut":
        return "Cutting"
      case "bulk":
        return "Bulking"
      case "recomposition":
        return "Recomposition"
      default:
        return goal
    }
  }

  return (
    <div id="protein-poster" className="w-[1080px] bg-white p-12 font-sans" style={{ fontFamily: "Inter, system-ui, sans-serif", position: "relative" }}>
      {/* Header */}
      <div className="mb-12 relative">
        {/* Use absolute origin + CORS-friendly attributes so html-to-image embeds the logo reliably */}
        <img
          src={(typeof window !== 'undefined' ? `${window.location.origin}` : '') + '/logo.png'}
          alt="ProteinPick logo"
          crossOrigin="anonymous"
          loading="eager"
          style={{ height: 80, width: 'auto', display: 'block' }}
        />
        <h2 className="text-3xl font-bold mt-4" style={{ color: "#3D3D3C" }}>Your protein intake is on me, Champ!</h2>
        <div className="w-48 h-2 rounded-full mt-6" style={{ background: "linear-gradient(90deg,#3D3D3C,#75746D)" }}></div>
      </div>

      {/* User Details */}
      <div className="grid grid-cols-2 gap-8 mb-12">
        <Card className="shadow-none" style={{ borderRadius: 24, border: '1px solid #E6E6E5' }}>
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Your Profile</h2>
            <div className="space-y-4 text-xl">
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-semibold">{userInput.weight_kg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gender:</span>
                <span className="font-semibold capitalize">{userInput.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Diet:</span>
                <span className="font-semibold">{getDietLabel(userInput.diet_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Goal:</span>
                <span className="font-semibold">{getGoalLabel(userInput.goal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Protein/kg:</span>
                <span className="font-semibold">{userInput.protein_per_kg_slider}g</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none" style={{ borderRadius: 24, border: '1px solid #E6E6E5' }}>
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Daily Targets</h2>
            <div className="space-y-4 text-xl">
              <div className="flex justify-between">
                <span className="text-gray-600">Protein Target:</span>
                <span className="font-semibold text-green-600">{proteinTarget}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Calorie Budget:</span>
                <span className="font-semibold" style={{ color: "#3D3D3C" }}>{budgetCalories} cal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Maintenance:</span>
                <span className="font-semibold" style={{ color: "#75746D" }}>{maintenance} cal</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Protein Sources Table */}
      <Card className="shadow-none" style={{ borderRadius: 24, border: '1px solid #E6E6E5' }}>
        <CardContent className="p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Your Protein Sources (per 25g protein)</h2>

          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-2 text-xl font-bold text-gray-900">Item</th>
                  <th className="text-center py-4 px-2 text-xl font-bold text-gray-900">Amount</th>
                  <th className="text-center py-4 px-2 text-xl font-bold text-gray-900">Protein</th>
                  <th className="text-center py-4 px-2 text-xl font-bold text-gray-900">Calories</th>
                  <th className="text-center py-4 px-2 text-xl font-bold text-gray-900">Cost (₹)</th>
                  <th className="text-center py-4 px-2 text-xl font-bold text-gray-900">Type</th>
                </tr>
              </thead>
              <tbody>
                {selectedFoods.map((food, index) => {
                  // Compute accurate per-25g protein amounts using normalised values
                  const proteinPerGram = food.protein_per_unit_g as number
                  const caloriesPerGram = food.calories_per_unit as number
                  const costPerGram = food.cost_per_unit_inr as number

                  const proteinPer25g = proteinPerGram > 0
                    ? Math.round((25 / proteinPerGram) * 100) / 100  // grams of food that gives 25g protein
                    : 0
                  const caloriesFor25gProtein = proteinPerGram > 0
                    ? Math.round((25 / proteinPerGram) * caloriesPerGram)
                    : 0
                  const costFor25gProtein = proteinPerGram > 0
                    ? Math.round((25 / proteinPerGram) * costPerGram)
                    : 0

                  return (
                    <tr
                      key={food.id}
                      className={`border-b border-gray-100 ${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                    >
                      <td className="py-6 px-2">
                        <div className="text-lg font-semibold text-gray-900">{food.name}</div>
                        <div className="text-base text-gray-600">{food.unit}</div>
                      </td>
                      <td className="text-center py-6 px-2 text-lg font-semibold">
                        {proteinPer25g}g
                      </td>
                      <td className="text-center py-6 px-2 text-lg font-semibold text-green-600">
                        25
                      </td>
                      <td className="text-center py-6 px-2 text-lg font-semibold">
                        {caloriesFor25gProtein}
                      </td>
                      <td className="text-center py-6 px-2 text-lg font-semibold text-blue-600">
                        ₹{costFor25gProtein}
                      </td>
                      <td className="text-center py-6 px-2">
                        <Badge
                          className={`text-base px-3 py-1 ${food.is_complete ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                        >
                          {food.is_complete ? "Complete" : "Incomplete"}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Row */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg p-4" style={{ background: "#CBCAC9" }}>
                <div className="text-2xl font-bold" style={{ color: "#3D3D3C" }}>{proteinTarget}g</div>
                <div className="text-base" style={{ color: "#75746D" }}>Protein / day</div>
              </div>
              <div className="rounded-lg p-4" style={{ background: "#CBCAC9" }}>
                <div className="text-2xl font-bold" style={{ color: "#3D3D3C" }}>{budgetCalories}</div>
                <div className="text-base" style={{ color: "#75746D" }}>Budget calories / day</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watermark removed per request */}
    </div>
  )
}
