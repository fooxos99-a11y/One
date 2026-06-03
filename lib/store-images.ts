const STORE_IMAGE_PROXY_PATH = "/api/store/image"

function extractPathFromStorageUrl(pathname) {
  const normalizedPathname = String(pathname || "")
  const publicPrefix = "/storage/v1/object/public/store-products/"
  const objectPrefix = "/storage/v1/object/store-products/"

  if (normalizedPathname.startsWith(publicPrefix)) {
    return normalizedPathname.slice(publicPrefix.length)
  }

  if (normalizedPathname.startsWith(objectPrefix)) {
    return normalizedPathname.slice(objectPrefix.length)
  }

  return ""
}

export function extractStoreImagePath(imageUrl) {
  const normalizedUrl = String(imageUrl || "").trim()
  if (!normalizedUrl) {
    return ""
  }

  if (normalizedUrl.startsWith(`${STORE_IMAGE_PROXY_PATH}?`)) {
    const params = new URLSearchParams(normalizedUrl.split("?")[1] || "")
    return params.get("path") || ""
  }

  if (normalizedUrl.startsWith("store-products/")) {
    return normalizedUrl.slice("store-products/".length)
  }

  if (!normalizedUrl.includes("/") && normalizedUrl.includes(".")) {
    return normalizedUrl
  }

  if (normalizedUrl.startsWith("/storage/")) {
    return extractPathFromStorageUrl(normalizedUrl)
  }

  try {
    const parsedUrl = new URL(normalizedUrl)
    return extractPathFromStorageUrl(parsedUrl.pathname)
  } catch {
    return ""
  }
}

export function resolveStoreImageSrc(imageUrl) {
  const normalizedUrl = String(imageUrl || "").trim()
  if (!normalizedUrl) {
    return ""
  }

  if (normalizedUrl.startsWith(`${STORE_IMAGE_PROXY_PATH}?`)) {
    return normalizedUrl
  }

  const imagePath = extractStoreImagePath(normalizedUrl)
  if (!imagePath) {
    return normalizedUrl
  }

  return `${STORE_IMAGE_PROXY_PATH}?path=${encodeURIComponent(imagePath)}`
}