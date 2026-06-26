import { toPng } from "html-to-image"
export async function exportToPNG(elementId: string, filename: string): Promise<void> {
  try {
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error("Element not found")
    }

    // Ensure all images inside the element are loaded before capture (mobile Safari fix)
    const imgs = Array.from(element.querySelectorAll('img')) as HTMLImageElement[]
    await Promise.all(
      imgs.map(async (img) => {
        try {
          img.setAttribute('crossOrigin', 'anonymous')
          if ((img as any).decode) {
            await (img as any).decode()
          }
        } catch { }
      }),
    )

    // Generate PNG
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width: 1080,
      cacheBust: true,
      skipFonts: false,
      style: {
        transform: "none",
        transformOrigin: "top left",
      },
      filter: (node) => {
        // Avoid capturing off-screen sticky UI artifacts
        const id = (node as HTMLElement).id
        if (id && id !== "protein-poster") return false
        return true
      },
    })

    // Try Web Share API first (mobile -> Photos/Gallery)
    const ua = navigator.userAgent || ""
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    if (navigator.share && navigator.canShare) {
      try {
        // Convert data URL to blob
        const response = await fetch(dataUrl)
        const blob = await response.blob()
        const file = new File([blob], filename, { type: "image/png" })

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "My Protein Plan",
            text: "Check out my personalized protein plan from PickProtein!",
            files: [file],
          })
          return
        }
      } catch (shareError) {
        console.log("Web Share failed, falling back to download:", shareError)
      }
    }

    // iOS fallback: open image in a new tab so user can long‑press → Save to Photos
    if (isIOS) {
      const win = window.open()
      if (win) {
        win.document.write(`<html><head><title>${filename}</title></head><body style="margin:0;background:#fff"><img src="${dataUrl}" style="width:100%;height:auto;display:block"/></body></html>`)
        return
      }
    }

    // Fallback to download (Android/Desktop)
    const link = document.createElement("a")
    link.download = filename
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error("Export failed:", error)
    throw new Error("Failed to export image. Please try again.")
  }
}

export function generateFilename(userInput: any): string {
  const date = new Date().toISOString().split("T")[0]
  const goal = userInput.goal || "plan"
  const weight = userInput.weight_kg || "unknown"
  return `protein-plan-${goal}-${weight}kg-${date}.png`
}
