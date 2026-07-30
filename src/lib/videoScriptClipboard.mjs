const cleanText = (value) => (
    typeof value === 'string' ? value.trim() : ''
);

export function formatVideoScriptForClipboard(videoScript) {
    if (!Array.isArray(videoScript)) {
        return '';
    }

    const scenes = videoScript
        .map((script, index) => {
            if (!script || typeof script !== 'object') {
                return '';
            }

            const time = cleanText(script.time);
            const audio = cleanText(script.audio);
            const visual = cleanText(script.visual);
            const textOverlay = cleanText(script.text_overlay);

            if (!time && !audio && !visual && !textOverlay) {
                return '';
            }

            return [
                time ? `【シーン${index + 1}｜${time}】` : `【シーン${index + 1}】`,
                audio && `音声：${audio}`,
                visual && `映像：${visual}`,
                textOverlay && `画面テロップ：${textOverlay}`
            ].filter(Boolean).join('\n');
        })
        .filter(Boolean);

    if (scenes.length === 0) {
        return '';
    }

    return [
        'ショート動画台本（TikTok / Reels / Shorts）',
        ...scenes
    ].join('\n\n');
}
