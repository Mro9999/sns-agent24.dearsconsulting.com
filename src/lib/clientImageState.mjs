export const MAX_BASE_IMAGE_COUNT = 5;
export const MAX_BASE_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_BASE_IMAGE_EDGE = 1200;

export function getScaledImageDimensions(width, height, maxEdge = MAX_BASE_IMAGE_EDGE) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new TypeError('Image dimensions must be positive numbers');
    }

    const scale = Math.min(1, maxEdge / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

export function getPersistableProductContext(value = {}) {
    const persistable = { ...(value || {}) };
    delete persistable.baseImages;
    delete persistable.baseImage;
    delete persistable.logoUrl;

    return persistable;
}

export function isTemporaryImageUrl(value) {
    return typeof value === 'string' && value.startsWith('blob:');
}
