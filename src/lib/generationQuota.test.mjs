import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    FREE_DAILY_GENERATION_LIMIT,
    freeGenerationLimitMessage,
    hasUnlimitedGenerationAccess
} from './generationQuota.mjs';

test('Free plan limit is consistently three generations per day', () => {
    assert.equal(FREE_DAILY_GENERATION_LIMIT, 3);
    assert.match(freeGenerationLimitMessage(), /1日3回/);
});

test('paid and admin roles have unlimited generation access', () => {
    assert.equal(hasUnlimitedGenerationAccess('free'), false);
    assert.equal(hasUnlimitedGenerationAccess('pro'), true);
    assert.equal(hasUnlimitedGenerationAccess('promax'), true);
    assert.equal(hasUnlimitedGenerationAccess('admin'), true);
});

test('browser storage is not used to enforce generation quota', () => {
    const source = fs.readFileSync(new URL('../app/app/AppClient.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /snsAgent24_usage/);
    assert.doesNotMatch(source, /getDailyFreeLimit|checkLimitAndRecord|refundDailyFreeUsage/);
});

test('video script generation does not request an AI image', () => {
    const source = fs.readFileSync(new URL('../app/app/AppClient.js', import.meta.url), 'utf8');
    assert.match(source, /if \(selectedFormat !== 'video_script'\) \{\s*if \(baseImagesArray\.length === 0\)/);
});

test('migration restricts quota table and RPCs to service role', () => {
    const migration = fs.readFileSync(
        new URL('../../supabase/migrations/20260730030813_generation_daily_usage.sql', import.meta.url),
        'utf8'
    );
    assert.match(migration, /enable row level security/i);
    assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.reserve_generation_quota[\s\S]*to service_role/i);
    assert.match(migration, /grant execute on function public\.release_generation_quota[\s\S]*to service_role/i);
}
);
