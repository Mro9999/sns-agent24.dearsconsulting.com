(async () => {
    await import('dotenv/config');
    const { researchTrends, generatePost, scrapeWebsite } = await import('./src/lib/apiService.js');

    const category = { label: '美容室・サロン' };
    const targetLabel = '20-30代';
    const targetGender = 'female';
    const businessStyle = 'physical';
    const tone = { label: '洗練・エレガント' };
    const purpose = 'reservation';
    const userProfile = {
        industry: '美容室・サロン',
        targetAudience: '20-30代',
        usp: 'オールハンドのトリートメント'
    };
    const cleanProductContext = {
        companyName: 'エステサロン「EST」',
        sellingPoint: 'オールハンドのトリートメント',
        websiteUrl: 'https://est-kisarazu.com/',
        location: '東京都渋谷区'
    };

    try {
        console.log("🔍 Scraping website...");
        const siteContent = await scrapeWebsite(cleanProductContext.websiteUrl);
        console.log("Site Content:", siteContent);

        console.log("\n📊 Running researchTrends...");
        const research = await researchTrends(category, targetLabel, targetGender, businessStyle, 'instagram_feed', cleanProductContext.location, siteContent, userProfile);
        console.log("Research Result:", JSON.stringify(research, null, 2));

        console.log("\n✍️ Running generatePost...");
        const post = await generatePost(research, 'instagram_feed', category, targetLabel, targetGender, businessStyle, tone, 'ja', cleanProductContext, siteContent, 'single', userProfile, purpose);
        console.log("Post Result:", JSON.stringify(post, null, 2));
    } catch (e) {
        console.error("Test failed", e);
    }
})();
