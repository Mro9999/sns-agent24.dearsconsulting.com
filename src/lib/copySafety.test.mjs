import test from 'node:test';
import assert from 'node:assert/strict';
import { findUnsupportedMetricMatch, removeUnsupportedNumericClaims } from './copySafety.mjs';

test('出典のない健康関連の具体割合を検出する', () => {
    const caption = '幸せな気持ちを支えるセロトニンの約90%は、腸で作られているのです。';
    assert.ok(findUnsupportedMetricMatch(caption));
});

test('近くに出典機関と発表年がある割合は遮断しない', () => {
    const caption = '厚生労働省の2025年調査によると、回答者の60%が睡眠に課題を感じています。';
    assert.equal(findUnsupportedMetricMatch(caption), null);
});

test('時間や価格など割合ではない数字は残す', () => {
    const post = { caption: '90分だけスマホを置いて過ごしましょう。ランチは1,500円です。' };
    assert.equal(removeUnsupportedNumericClaims(post).caption, post.caption);
});

test('危険な一文だけを除去し、前後の安全な文は残す', () => {
    const post = {
        caption: '週末は体を休めましょう。セロトニンの約90%は腸で作られます。自然の中で深呼吸してみませんか。'
    };
    assert.equal(
        removeUnsupportedNumericClaims(post).caption,
        '週末は体を休めましょう。自然の中で深呼吸してみませんか。'
    );
});

test('リサーチ結果の入れ子になった文章にも同じ安全処理を適用する', () => {
    const research = {
        insight_target: '若者の約76%が健康を意識しています。自分に合う無理のない方法が好まれています。',
        evidence_notes: ['総務省の2025年調査によると、回答者の60%が睡眠に課題を感じています。']
    };
    assert.deepEqual(removeUnsupportedNumericClaims(research), {
        insight_target: '自分に合う無理のない方法が好まれています。',
        evidence_notes: research.evidence_notes
    });
});
