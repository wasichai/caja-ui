// copiado de srtm-ui@a1df33a (src/kit/forms/geometry.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// a geojson geometry, as a form's geometry field sends it
export interface Geometry {
  type: string
  coordinates: unknown
}

// a geometry kept in a form's hidden field, as text
export const parseGeometry = (text: string | null | undefined): Geometry | null => {
  if (!text) return null
  try {
    const value = JSON.parse(text) as Geometry
    return value && typeof value.type === 'string' ? value : null
  } catch {
    return null
  }
}
