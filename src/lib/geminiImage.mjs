export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const FALLBACK_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

export function getGeminiImageModelCandidates(configuredModel = '') {
    return [
        String(configuredModel || '').trim(),
        DEFAULT_GEMINI_IMAGE_MODEL,
        FALLBACK_GEMINI_IMAGE_MODEL
    ].filter((model, index, models) => model && models.indexOf(model) === index);
}

export function extractGeminiInlineImages(response) {
    const extractImages = (contents) => contents.flatMap((content) => {
        if (content?.type !== 'image' && !content?.data) return [];

        const data = content?.data;
        if (typeof data !== 'string' || data.length === 0) return [];

        return [{
            base64: data,
            mimeType: content.mime_type || content.mimeType || 'image/jpeg'
        }];
    });

    const outputImage = extractImages(response?.output_image ? [response.output_image] : []);
    if (outputImage.length > 0) return outputImage;

    const stepImages = extractImages(
        (Array.isArray(response?.steps) ? response.steps : [])
            .filter((step) => step?.type === 'model_output')
            .flatMap((step) => Array.isArray(step?.content) ? step.content : [])
    );
    if (stepImages.length > 0) return stepImages;

    // Legacy Interactions responses are retained only for defensive compatibility.
    const interactionImages = extractImages(
        Array.isArray(response?.outputs) ? response.outputs : []
    );

    if (interactionImages.length > 0) return interactionImages;

    // 旧generateContent形式も読み取れるようにして、移行途中の応答差を吸収する。
    const candidates = Array.isArray(response?.candidates) ? response.candidates : [];

    return candidates.flatMap((candidate) => {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        return parts.flatMap((part) => {
            const data = part?.inlineData?.data;
            if (typeof data !== 'string' || data.length === 0) return [];

            return [{
                base64: data,
                mimeType: part.inlineData.mimeType || 'image/png'
            }];
        });
    });
}

export function isGeminiImageModelUnavailable(error) {
    const status = Number(error?.status || error?.code || error?.response?.status || 0);
    const message = String(error?.message || error).toLowerCase();
    const isNotFound = status === 404 || /(?:^|\D)404(?:\D|$)/.test(message);
    return isNotFound && /model|not found|not supported|deprecated|shut down/.test(message);
}

export function createGeminiImageUserMessage(error) {
    const status = Number(error?.status || error?.code || error?.response?.status || 0);
    const message = String(error?.message || error).toLowerCase();

    if (status === 429 || /(?:^|\D)429(?:\D|$)|quota|rate limit|resource exhausted/.test(message)) {
        return '画像生成が混み合っています。投稿文は完成しているため、少し待ってから画像だけ再生成してください。';
    }

    if (status === 503 || /(?:^|\D)503(?:\D|$)|capacity|temporarily unavailable|timeout/.test(message)) {
        return '画像生成サービスが一時的に応答していません。投稿文は完成しているため、少し待ってから画像だけ再生成してください。';
    }

    return '画像だけを生成できませんでした。投稿文は完成しているため、そのままコピーするか、画像だけ再生成してください。';
}
