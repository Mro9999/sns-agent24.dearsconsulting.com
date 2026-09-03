import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_GEMINI_IMAGE_MODEL,
    FALLBACK_GEMINI_IMAGE_MODEL,
    createGeminiImageUserMessage,
    extractGeminiInlineImages,
    getGeminiImageModelCandidates,
    isGeminiImageModelUnavailable
} from './geminiImage.mjs';

test('current image model is preferred and the lighter current model remains a fallback', () => {
    assert.deepEqual(getGeminiImageModelCandidates(), [
        DEFAULT_GEMINI_IMAGE_MODEL,
        FALLBACK_GEMINI_IMAGE_MODEL
    ]);
    assert.deepEqual(getGeminiImageModelCandidates('custom-image-model'), [
        'custom-image-model',
        DEFAULT_GEMINI_IMAGE_MODEL,
        FALLBACK_GEMINI_IMAGE_MODEL
    ]);
});

test('image output is extracted from the current Gemini Interactions response', () => {
    assert.deepEqual(extractGeminiInlineImages({
        outputs: [
            { type: 'text', text: 'done' },
            { type: 'image', data: 'interaction-base64', mime_type: 'image/webp' }
        ]
    }), [{ base64: 'interaction-base64', mimeType: 'image/webp' }]);
});

test('inline image parts are also extracted from the former generateContent response', () => {
    assert.deepEqual(extractGeminiInlineImages({
        candidates: [{
            content: {
                parts: [
                    { text: 'done' },
                    { inlineData: { data: 'YWJj', mimeType: 'image/png' } }
                ]
            }
        }]
    }), [{ base64: 'YWJj', mimeType: 'image/png' }]);
});

test('only model availability failures switch to the fallback model', () => {
    assert.equal(isGeminiImageModelUnavailable({ status: 404, message: 'model is not found' }), true);
    assert.equal(isGeminiImageModelUnavailable(new Error('Status 404: model is not supported for generateContent')), true);
    assert.equal(isGeminiImageModelUnavailable({ status: 429, message: 'quota exceeded' }), false);
});

test('image errors are explained without discarding the completed post copy', () => {
    assert.match(createGeminiImageUserMessage({ status: 429 }), /投稿文は完成/);
    assert.match(createGeminiImageUserMessage({ status: 503 }), /一時的/);
    assert.match(createGeminiImageUserMessage(new Error('unknown')), /画像だけ/);
});
