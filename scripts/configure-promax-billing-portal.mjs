import Stripe from 'stripe';
import {
    ensureProMaxBillingPortal,
    inspectProMaxBillingPortal
} from '../src/lib/promaxBillingPortal.mjs';

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

async function main() {
    const apply = process.argv.includes('--apply');
    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
        apiVersion: '2025-01-27.acacia',
        typescript: false
    });
    const before = await inspectProMaxBillingPortal({
        env: process.env,
        stripe
    });
    const configuration = apply
        ? await ensureProMaxBillingPortal({ env: process.env, stripe })
        : before.configuration;
    const after = apply
        ? await inspectProMaxBillingPortal({ env: process.env, stripe })
        : before;

    const result = {
        action: apply
            ? (before.configuration ? 'updated_or_reused' : 'created')
            : (before.configurationReady ? 'unchanged' : 'inspection_only'),
        configurationId: configuration?.id || null,
        configurationReady: after.configurationReady,
        mode: after.mode,
        prices: after.prices.map(({ price, spec }) => ({
            active: price.active,
            currency: price.currency,
            interval: price.recurring?.interval || null,
            label: spec.label,
            unitAmount: price.unit_amount
        }))
    };

    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(`[promax-billing] ${error.message}`);
    process.exitCode = 1;
});
