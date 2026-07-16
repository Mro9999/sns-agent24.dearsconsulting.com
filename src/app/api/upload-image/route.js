import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';

export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            console.error("Supabase Admin client is not configured.");
            return new NextResponse("Database configuration error", { status: 500 });
        }

        const body = await req.json().catch(() => null);
        if (!body || !body.base64Data) {
            return new NextResponse("Invalid Request Body or missing base64Data", { status: 400 });
        }

        const { base64Data } = body;
        
        // base64Data has format like "data:image/jpeg;base64,/9j/4AAQSk..."
        // We need to strip the prefix to get the raw base64 string
        const base64Parts = base64Data.split(';base64,');
        if (base64Parts.length !== 2) {
            return new NextResponse("Invalid Base64 format", { status: 400 });
        }
        
        const mimeType = base64Parts[0].split(':')[1] || 'image/jpeg';
        const allowedTypes = new Map([
            ['image/jpeg', 'jpg'],
            ['image/png', 'png'],
            ['image/webp', 'webp'],
        ]);
        const ext = allowedTypes.get(mimeType);
        if (!ext) {
            return new NextResponse('Unsupported image type', { status: 415 });
        }
        const rawBase64 = base64Parts[1];
        const buffer = Buffer.from(rawBase64, 'base64');
        if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
            return new NextResponse('Image must be 10MB or smaller', { status: 413 });
        }

        const BUCKET_NAME = 'generated-images';

        // Helper to get or create bucket
        const getOrCreateBucket = async () => {
            const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
            if (listError) throw new Error("Failed to list buckets: " + listError.message);
            
            const bucketExists = buckets.find(b => b.name === BUCKET_NAME);
            
            if (!bucketExists) {
                console.log(`Bucket ${BUCKET_NAME} does not exist. Creating...`);
                const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
                    public: true,
                    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
                    fileSizeLimit: 10485760 // 10MB
                });
                
                if (createError && !createError.message.includes('already exists')) {
                    throw new Error("Failed to create bucket: " + createError.message);
                }
                
                // Ensure bucket is public just in case
                await supabaseAdmin.storage.updateBucket(BUCKET_NAME, { public: true });
            }
        };

        // Ensure bucket exists
        await getOrCreateBucket();

        // Generate a random filename to avoid collisions
        const randomString = crypto.randomBytes(16).toString('hex');
        const fileName = `${userId}/${Date.now()}_${randomString}.${ext}`;

        // Upload the image
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            console.error("Supabase Upload Error:", uploadError);
            return new NextResponse("Failed to upload image", { status: 500 });
        }

        // Get public URL
        const { data: publicUrlData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            return new NextResponse("Failed to get public URL", { status: 500 });
        }

        return NextResponse.json({ success: true, url: publicUrlData.publicUrl });

    } catch (error) {
        console.error("Error in upload-image route:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
