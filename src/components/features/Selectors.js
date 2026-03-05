import React from 'react';

export function CategorySelector({ selected, onSelect }) {
    const categories = [
        { id: 'beauty', label: '美容室・サロン' },
        { id: 'food', label: '飲食店・カフェ' },
        { id: 'apparel', label: 'アパレル・雑貨' },
        { id: 'fitness', label: 'ジム・フィットネス' },
        { id: 'education', label: '塾・スクール' },
        { id: 'consulting', label: 'コンサル・BtoB' },
        { id: 'realestate', label: '不動産' },
        { id: 'other', label: 'その他' }
    ];
    return (
        <div className="w-full max-w-2xl mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">業種・カテゴリ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map(c => (
                    <button
                        key={c.id}
                        onClick={() => onSelect(c)}
                        className={`py-3 px-2 rounded-xl text-sm font-semibold transition-all border ${selected?.id === c.id ? 'bg-purple-600/30 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function TargetSelector({ selected, onSelect, isPro }) {
    const targets = [
        { id: 'teens', label: '10代 (中高生)' },
        { id: 'young_adults', label: '20代〜30代' },
        { id: 'parents', label: 'ママ・パパ層' },
        { id: 'business', label: 'ビジネス層' },
        { id: 'high_end', label: '富裕層 (Pro限定)', isProOnly: true }
    ];
    return (
        <div className="w-full max-w-2xl mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">メインターゲット層</h3>
            <div className="flex flex-wrap justify-center gap-3">
                {targets.map(t => {
                    const isDisabled = t.isProOnly && !isPro;
                    return (
                        <button
                            key={t.id}
                            disabled={isDisabled}
                            onClick={() => onSelect(t.id)}
                            className={`py-2 px-6 rounded-full text-sm font-bold transition-all border 
                                ${isDisabled ? 'bg-black/40 border-gray-700 text-gray-600 cursor-not-allowed' :
                                    selected === t.id ? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' :
                                        'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}`}
                        >
                            {t.label}
                        </button>
                    )
                })}
            </div>
        </div>
    );
}

export function GenderSelector({ selected, onSelect }) {
    const genders = [
        { id: 'female', label: '女性メイン' },
        { id: 'male', label: '男性メイン' },
        { id: 'any', label: '問わない / 男女両方' }
    ];
    return (
        <div className="w-full max-w-2xl mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">ターゲットの性別</h3>
            <div className="flex justify-center gap-3">
                {genders.map(g => (
                    <button
                        key={g.id}
                        onClick={() => onSelect(g.id)}
                        className={`py-2 px-6 rounded-full text-sm font-bold transition-all border ${selected === g.id ? 'bg-pink-600/30 border-pink-500 text-white' : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}`}
                    >
                        {g.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function BusinessStyleSelector({ selected, onSelect }) {
    const styles = [
        { id: 'physical', label: '実店舗・対面サービス' },
        { id: 'online', label: 'オンライン・EC販売' },
        { id: 'service', label: '無形サービス・レッスン' }
    ];
    return (
        <div className="w-full max-w-2xl mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">ビジネスの形態</h3>
            <div className="flex flex-wrap justify-center gap-3">
                {styles.map(s => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className={`py-2 px-6 rounded-full text-sm font-bold transition-all border ${selected === s.id ? 'bg-green-600/30 border-green-500 text-white' : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ToneSelector({ selected, onSelect }) {
    const tones = [
        { id: 'polite', label: '丁寧・誠実' },
        { id: 'friendly', label: 'フランク・親しみ' },
        { id: 'passionate', label: '情熱的・熱血' },
        { id: 'luxury', label: '高級感・エレガント' },
        { id: 'trendy', label: 'トレンド・若者向け' }
    ];
    return (
        <div className="w-full max-w-2xl mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">投稿のトーン＆マナー</h3>
            <div className="flex flex-wrap justify-center gap-2">
                {tones.map(t => (
                    <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={`py-2 px-4 rounded font-medium transition-all text-sm border ${selected === t.id ? 'bg-orange-600/30 border-orange-500 text-white' : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-black/60 hover:text-gray-200'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function LanguageSelector({ selected, onSelect, isPro }) {
    const languages = [
        { id: 'ja', label: '日本語のみ' },
        { id: 'ja_en', label: '日本語 ＋ 英語 (Pro)', isProOnly: true },
        { id: 'ja_zh', label: '日本語 ＋ 繁体字 (Pro)', isProOnly: true },
        { id: 'ja_ko', label: '日本語 ＋ 韓国語 (Pro)', isProOnly: true },
        { id: 'all', label: '4ヶ国語全て (Pro)', isProOnly: true }
    ];
    return (
        <div className="w-full max-w-2xl mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">出力言語（インバウンド対応）</h3>
            <div className="flex flex-wrap justify-center gap-2">
                {languages.map(l => {
                    const isDisabled = l.isProOnly && !isPro;
                    return (
                        <button
                            key={l.id}
                            disabled={isDisabled}
                            onClick={() => onSelect(l.id)}
                            className={`py-2 px-4 rounded-full font-bold transition-all text-sm border 
                                ${isDisabled ? 'bg-black/40 border-gray-700 text-gray-600 cursor-not-allowed' :
                                    selected === l.id ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' :
                                        'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}`}
                        >
                            {l.label}
                        </button>
                    )
                })}
            </div>
        </div>
    );
}

export function ProductInput({ value = {}, onChange }) {
    const handleChange = (e) => {
        onChange({ ...value, [e.target.name]: e.target.value });
    };

    const handleBaseImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            alert("【サイズオーバー】\\n画像が15MBを超えています。もう少し軽い画像を選んでください。");
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                onChange({ ...value, baseImage: dataUrl });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="w-full max-w-2xl mb-8 bg-white/5 p-6 rounded-2xl border border-white/10">
            <h3 className="text-xl font-bold mb-6 text-center text-white">詳細情報（任意・推奨）</h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">自社・店舗名（ブランド名）</label>
                    <input
                        type="text"
                        name="companyName"
                        value={value.companyName || ''}
                        onChange={handleChange}
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="例：SNS Agent24"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">訴求したいポイントや特徴</label>
                    <textarea
                        name="sellingPoint"
                        value={value.sellingPoint || ''}
                        onChange={handleChange}
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        rows="3"
                        placeholder="例：無添加のオーガニック素材を使用。20代女性の口コミで話題の新作です。"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">地域・ロケーション</label>
                        <input
                            type="text"
                            name="location"
                            value={value.location || ''}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="例：東京都渋谷区"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">自社・店舗URL、または参考サイトURL</label>
                        <input
                            type="url"
                            name="websiteUrl"
                            value={value.websiteUrl || ''}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="https://..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">SNSリンク（Instagram, X, LINE等）</label>
                        <input
                            type="url"
                            name="snsUrl"
                            value={value.snsUrl || ''}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="https://instagram.com/..."
                        />
                    </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mt-4">
                    <label className="block text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
                        ベース写真・商品画像 <span className="text-gray-300 font-normal text-xs">(推奨) AIがこれをもとにSNSバナーを作ります</span>
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            id="baseImageInput"
                            type="file"
                            accept="image/*"
                            onChange={handleBaseImageUpload}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30 transition-all cursor-pointer"
                        />
                    </div>
                    {value.baseImage && (
                        <div className="mt-4 p-3 bg-black/50 rounded-lg inline-flex items-start gap-4 border border-blue-500/20 shadow-lg">
                            <div>
                                <p className="text-xs text-gray-400 mb-2">アップロード済みプレビュー</p>
                                <img src={value.baseImage} alt="Base Preview" className="h-32 object-contain rounded border border-gray-700" />
                            </div>
                            <button
                                onClick={() => {
                                    onChange({ ...value, baseImage: null });
                                    const input = document.getElementById('baseImageInput');
                                    if (input) input.value = '';
                                }}
                                className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/40 transition-colors border border-red-500/30"
                            >
                                ✕ 削除
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl">
                    <label className="block text-sm font-bold text-orange-300 mb-2">
                        ブランドロゴ・透かし画像 (任意) <span className="text-gray-300 font-normal ml-2">※自動で軽量化されます</span>
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            id="logoImageInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                // 上限を10MBに引き上げ
                                if (file.size > 10 * 1024 * 1024) {
                                    alert("【サイズオーバー】\\n画像が10MBを超えています。もう少し軽い画像を選んでください。");
                                    e.target.value = '';
                                    return;
                                }

                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    // 画像の自動リサイズ（丸型クリッピング・圧縮）処理
                                    const img = new Image();
                                    img.onload = () => {
                                        const minSize = Math.min(img.width, img.height);
                                        const canvas = document.createElement('canvas');
                                        const MAX_SIZE = 800;

                                        // 最終的なキャンバスのサイズ（真円を作るために正方形にする）
                                        let finalSize = minSize > MAX_SIZE ? MAX_SIZE : minSize;

                                        canvas.width = finalSize;
                                        canvas.height = finalSize;
                                        const ctx = canvas.getContext('2d');

                                        // 真円にクリッピングするためのパスを作成
                                        ctx.beginPath();
                                        ctx.arc(finalSize / 2, finalSize / 2, finalSize / 2, 0, Math.PI * 2, true);
                                        ctx.closePath();
                                        ctx.clip();

                                        // 中央を基準に画像を正方形に切り抜いて描画
                                        const sx = (img.width - minSize) / 2;
                                        const sy = (img.height - minSize) / 2;

                                        ctx.drawImage(img, sx, sy, minSize, minSize, 0, 0, finalSize, finalSize);

                                        // 丸く切り抜いた部分以外を透明にするため、必ずPNGで出力する
                                        const compressedDataUrl = canvas.toDataURL('image/png');
                                        onChange({ ...value, logoUrl: compressedDataUrl });
                                    };
                                    img.src = reader.result;
                                };
                                reader.readAsDataURL(file);
                            }}
                            className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 transition-colors"
                        />
                        {value.logoUrl && (
                            <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden border-2 border-white/20 relative group bg-black/40">
                                <img src={value.logoUrl} alt="Logo" className="h-full w-full object-cover" />
                                <button
                                    onClick={() => {
                                        onChange({ ...value, logoUrl: null });
                                        const input = document.getElementById('logoImageInput');
                                        if (input) input.value = '';
                                    }}
                                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                >
                                    削除
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-orange-200/70 mt-3 leading-relaxed">
                        ✨ <strong>自動で「綺麗な丸型（真円）」に切り抜かれ、軽量化されます（上限10MB）。</strong><br />
                        生成された画像の右下に自動でロゴとして合成されます。<br />
                        <span className="text-yellow-300">※四角い画像を入れても自動で丸く加工されます。</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
