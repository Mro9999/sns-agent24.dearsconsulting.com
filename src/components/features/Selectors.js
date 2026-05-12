import React from 'react';

// Icons for PurposeSelector
const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="3" width="15" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M1.5 7.5H16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M5.25 1.5V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M12.75 1.5V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="6" cy="11.25" r="0.75" fill="currentColor" />
        <circle cx="9" cy="11.25" r="0.75" fill="currentColor" />
    </svg>
);

const ChatIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.75 9C15.75 12.728 12.728 15.75 9 15.75C7.923 15.75 6.908 15.487 6.018 15.023L2.25 15.75L3.228 12.483C2.565 11.449 2.25 10.262 2.25 9C2.25 5.272 5.272 2.25 9 2.25C12.728 2.25 15.75 5.272 15.75 9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 9H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M6 6.75H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

const StarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 1.5L10.854 6.636L16.5 6.636L12.073 9.864L13.927 15L9 11.772L4.073 15L5.927 9.864L1.5 6.636L7.146 6.636L9 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
);

const MegaphoneIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 3C13.5 3 11.25 5.25 7.5 6H4.5C3.672 6 3 6.672 3 7.5V9C3 9.828 3.672 10.5 4.5 10.5H5.25L6 13.5H7.5L7.5 10.5C11.25 11.25 13.5 13.5 13.5 13.5V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M15.75 8.25C15.75 9.493 15.293 10.5 14.25 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

const CheckIcon = () => (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const purposes = [
    {
        id: "reservation",
        label: "来店・予約を増やしたい",
        Icon: CalendarIcon,
        description: "キャンペーン・新規集客・予約誘導",
        example: "「今月限定オーガニックカラー20%OFF、ご予約はプロフィールリンクから」",
    },
    {
        id: "relationship",
        label: "既存客との関係を深めたい",
        Icon: ChatIcon,
        description: "日常・スタッフ紹介・こだわりの裏側",
        example: "「今朝仕込んだトリートメント剤、実はこんなこだわりがあります」",
    },
    {
        id: "branding",
        label: "ブランドの世界観を伝えたい",
        Icon: StarIcon,
        description: "哲学・審美眼・ストーリー",
        example: "「私たちが大切にする、手をかけることの意味」",
    },
    {
        id: "announcement",
        label: "新メニュー・商品を告知したい",
        Icon: MegaphoneIcon,
        description: "新商品・季節メニュー・限定企画",
        example: "「春の新メニュー『桜カラー』、本日スタートしました」",
    },
];

export function PurposeSelector({ selected, onSelect }) {
    return (
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-1 text-center text-slate-800 tracking-tight">この投稿の目的を選んでください</h3>
            <p className="text-center text-sm md:text-base text-slate-500 font-medium mb-8">目的を選ぶと、AIが最適なコンテンツ戦略に切り替えます</p>

            <div className="flex flex-col gap-3">
                {purposes.map(({ id, label, Icon, description, example }) => {
                    const isSelected = selected === id;
                    return (
                        <div
                            key={id}
                            onClick={() => onSelect(id)}
                            className={`relative overflow-hidden rounded-2xl p-5 cursor-pointer border transition-all duration-300 ${isSelected
                                ? "bg-slate-900 border-slate-900 shadow-[0_10px_35px_rgba(0,0,0,0.15)] scale-[1.02]"
                                : "bg-white/80 backdrop-blur-md border-white/60 shadow-[0_4px_15px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-slate-200"
                                }`}
                        >
                            {isSelected && (
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-800 rounded-l-xl" />
                            )}
                            <div className="flex items-start gap-3 pl-2">
                                <div className={`mt-0.5 shrink-0 transition-colors ${isSelected ? "text-rose-500" : "text-slate-800 font-medium"}`}>
                                    <Icon />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <span className={`text-base font-extrabold transition-colors ${isSelected ? "text-white" : "text-slate-800"}`}>
                                            {label}
                                        </span>
                                        {isSelected && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-rose-500 font-bold tracking-wider">
                                                選択中
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-800 font-medium m-0">
                                        {description}
                                    </p>
                                    {isSelected && (
                                        <div className="mt-3 text-xs text-gray-700 bg-white/90 border border-slate-200 shadow-sm text-slate-800 rounded-lg p-2.5 border-l-2 border-pink-500/50 italic leading-relaxed">
                                            生成例：{example}
                                        </div>
                                    )}
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSelected
                                    ? "bg-gradient-to-br from-purple-500 to-pink-500 border-none shadow-md"
                                    : "border-2 border-gray-600 bg-transparent"
                                    }`}>
                                    {isSelected && <CheckIcon />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

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
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-slate-800 tracking-tight">業種・カテゴリ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map(c => (
                    <button
                        key={c.id}
                        onClick={() => onSelect(c)}
                        className={`py-3.5 px-3 rounded-2xl text-sm transition-all border flex items-center justify-center ${selected?.id === c.id ? "bg-slate-900 border-slate-900 text-white shadow-[0_8px_25px_rgba(0,0,0,0.15)] font-bold scale-[1.03]" : "bg-white/80 backdrop-blur-md border-white shadow-[0_4px_15px_rgba(0,0,0,0.03)] text-slate-600 font-medium hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:text-slate-900 hover:border-slate-200"}`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function FormatSelector({ selected, onSelect, isPro }) {
    const formats = [
        { id: 'single', label: '1枚画像', desc: '通常のシングル投稿' },
        { id: 'carousel', label: 'カルーセル', desc: '解説型・複数枚' },
        { id: 'video_script', label: 'ショート動画 (Pro限定)', desc: '台本と画面指示', isProOnly: true },
    ];
    return (
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-slate-800 tracking-tight">投稿フォーマット</h3>
            <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-3 w-full">
                {formats.map(f => {
                    const isDisabled = f.isProOnly && !isPro;
                    return (
                        <button
                            key={f.id}
                            disabled={isDisabled}
                            onClick={() => onSelect(f.id)}
                            className={`p-3 md:px-5 md:py-3 rounded-xl md:rounded-full text-sm font-semibold transition-all border flex flex-col items-center justify-center gap-1 ${selected === f.id ? 'bg-indigo-600/30 border-indigo-500 text-gray-900' : 'bg-white border-transparent shadow-sm text-slate-500 font-medium hover:border-slate-200 font-medium hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:text-rose-600'
                                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${f.id === 'video_script' ? 'col-span-2 md:col-span-1' : ''}`}
                        >
                            <span>{f.label}</span>
                            <span className="text-[10px] font-normal opacity-80">{f.desc}</span>
                        </button>
                    );
                })}
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
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-slate-800 tracking-tight">メインターターゲット層</h3>
            <div className="flex flex-wrap justify-center gap-3">
                {targets.map(t => {
                    const isDisabled = t.isProOnly && !isPro;
                    return (
                        <button
                            key={t.id}
                            disabled={isDisabled}
                            onClick={() => onSelect(t.id)}
                            className={`py-2.5 px-6 rounded-full text-sm font-bold transition-all border shadow-sm 
                                ${isDisabled ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60' :
                                    selected === t.id ? 'bg-slate-900 border-slate-900 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] scale-105' :
                                        'bg-white/80 backdrop-blur-sm border-white text-slate-600 hover:shadow-[0_6px_15px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:text-slate-900 hover:border-slate-200'}`}
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
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-slate-800 tracking-tight">ターゲットの性別</h3>
            <div className="flex justify-center gap-3">
                {genders.map(g => (
                    <button
                        key={g.id}
                        onClick={() => onSelect(g.id)}
                        className={`py-2.5 px-6 rounded-full text-sm font-bold transition-all border shadow-sm ${selected === g.id ? 'bg-slate-900 border-slate-900 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] scale-105' : 'bg-white/80 backdrop-blur-sm border-white text-slate-600 hover:shadow-[0_6px_15px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:text-slate-900 hover:border-slate-200'}`}
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
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-slate-800 tracking-tight">ビジネスの形態</h3>
            <div className="flex flex-wrap justify-center gap-3">
                {styles.map(s => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className={`py-2.5 px-6 rounded-full text-sm font-bold transition-all border shadow-sm ${selected === s.id ? 'bg-slate-900 border-slate-900 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] scale-105' : 'bg-white/80 backdrop-blur-sm border-white text-slate-600 hover:shadow-[0_6px_15px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:text-slate-900 hover:border-slate-200'}`}
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
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-slate-800 tracking-tight">投稿のトーン＆マナー</h3>
            <div className="flex flex-wrap justify-center gap-2">
                {tones.map(t => (
                    <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={`py-2 px-4 rounded font-medium transition-all text-sm border ${selected === t.id ? 'bg-orange-600/30 border-orange-500 text-gray-900' : 'bg-white/90 border border-slate-200 shadow-sm text-slate-8000 border border-white shadow-lg/80 border-gray-700 text-slate-800 font-medium hover:bg-black/60 hover:text-gray-200'}`}
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
        { id: 'ja_en', label: '日本語 ＋ 英語 (Pro限定)', isProOnly: true },
        { id: 'ja_zh', label: '日本語 ＋ 繁体字 (Pro限定)', isProOnly: true },
        { id: 'ja_ko', label: '日本語 ＋ 韓国語 (Pro限定)', isProOnly: true },
        { id: 'all', label: '4ヶ国語全て (Pro限定)', isProOnly: true }
    ];
    return (
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3 text-center text-slate-800 tracking-tight">キャプション言語（インバウンド対応）</h3>
            <p className="text-xs text-center text-slate-600 mb-6">投稿文・ハッシュタグ・スライド本文の言語。長文なので多言語併記OK。</p>
            <div className="flex flex-wrap justify-center gap-2">
                {languages.map(l => {
                    const isDisabled = l.isProOnly && !isPro;
                    return (
                        <button
                            key={l.id}
                            disabled={isDisabled}
                            onClick={() => onSelect(l.id)}
                            className={`py-2 px-4 rounded-full font-bold transition-all text-sm border
                                ${isDisabled ? 'bg-white/90 border border-slate-200 shadow-sm text-slate-8000 border border-white shadow-lg/80 border-gray-700 text-slate-800 cursor-not-allowed' :
                                    selected === l.id ? 'bg-indigo-600/30 border-indigo-500 text-gray-900 shadow-[0_0_15px_rgba(79,70,229,0.3)]' :
                                        'bg-transparent border-gray-600 text-slate-800 font-medium hover:border-gray-400 hover:text-gray-900'}`}
                        >
                            {l.label}
                        </button>
                    )
                })}
            </div>
        </div>
    );
}

// 画像オーバーレイ専用の言語選択 (常に単一言語)
// キャプションは多言語OKだが、画像内のテキストは視認性のため必ず1言語に絞る
export function OverlayLanguageSelector({ selected, onSelect }) {
    const overlayLanguages = [
        { id: 'ja', label: '日本語' },
        { id: 'en', label: 'English' },
        { id: 'zh_TW', label: '繁體中文' },
        { id: 'ko', label: '한국어' }
    ];
    return (
        <div className="w-full max-w-3xl mx-auto mb-10 p-6 md:p-10 bg-white/60 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3 text-center text-slate-800 tracking-tight">画像内テキストの言語</h3>
            <p className="text-xs text-center text-slate-600 mb-6">画像オーバーレイ（写真上の文字）に使う言語。視認性のため必ず1言語のみ。</p>
            <div className="flex flex-wrap justify-center gap-2">
                {overlayLanguages.map(l => (
                    <button
                        key={l.id}
                        onClick={() => onSelect(l.id)}
                        className={`py-2 px-4 rounded-full font-bold transition-all text-sm border
                            ${selected === l.id ? 'bg-pink-600/30 border-pink-500 text-gray-900 shadow-[0_0_15px_rgba(236,72,153,0.3)]' :
                                'bg-transparent border-gray-600 text-slate-800 font-medium hover:border-gray-400 hover:text-gray-900'}`}
                    >
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ProductInput({ value = {}, onChange }) {
    const handleChange = (e) => {
        onChange({ ...value, [e.target.name]: e.target.value });
    };

    const handleBaseImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // 最大5枚までの制限（例）
        const currentCount = (value.baseImages || []).length;
        if (currentCount + files.length > 5) {
            alert("画像は最大5枚までアップロード可能です。");
            e.target.value = '';
            return;
        }

        const validFiles = files.filter(file => {
            if (file.size > 15 * 1024 * 1024) {
                alert(`【サイズオーバー】\\n画像「${file.name}」が15MBを超えています。スキップされました。`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) {
            e.target.value = '';
            return;
        }

        const processFile = (file) => {
            return new Promise((resolve) => {
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
                        resolve(dataUrl);
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
        };

        const newImages = await Promise.all(validFiles.map(processFile));

        // 既存の baseImages 配列に新たに追加する
        const updatedImages = [...(value.baseImages || []), ...newImages];
        onChange({ ...value, baseImages: updatedImages });

        // パスをクリアして同じ画像も再アップ可能にする
        e.target.value = '';
    };

    const removeBaseImage = (indexToRemove) => {
        const updated = (value.baseImages || []).filter((_, i) => i !== indexToRemove);
        onChange({ ...value, baseImages: updated });
    };

    return (
        <div className="w-full max-w-2xl mb-8 bg-white/90 border border-slate-200 shadow-sm text-slate-800 p-6 rounded-2xl border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <h3 className="text-xl font-bold mb-6 text-center text-gray-900">詳細情報（任意・推奨）</h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-800 font-medium mb-1">自社・店舗名（ブランド名）</label>
                    <input
                        type="text"
                        name="companyName"
                        value={value.companyName || ''}
                        onChange={handleChange}
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-900 focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="例：SNS Agent24"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-800 font-medium mb-1 flex items-center gap-2">
                        訴求したいポイントや特徴
                        <span className="bg-pink-500/20 text-rose-500 text-[10px] px-2 py-0.5 rounded border border-pink-500/30">※入力するとAIの精度が大幅に上がります</span>
                    </label>
                    <textarea
                        name="sellingPoint"
                        value={value.sellingPoint || ''}
                        onChange={handleChange}
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-900 focus:outline-none focus:border-purple-500 transition-colors"
                        rows="3"
                        placeholder="例：無添加のオーガニック素材を使用。20代女性の口コミで話題の新作です。"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-800 font-medium mb-1">地域・ロケーション</label>
                        <input
                            type="text"
                            name="location"
                            value={value.location || ''}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-900 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="例：東京都渋谷区"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-800 font-medium mb-1">自社・店舗URL、または参考サイトURL</label>
                        <input
                            type="url"
                            name="websiteUrl"
                            value={value.websiteUrl || ''}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-900 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="https://..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-800 font-medium mb-1">SNSリンク（Instagram, X, LINE等）</label>
                        <input
                            type="url"
                            name="snsUrl"
                            value={value.snsUrl || ''}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-900 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="https://instagram.com/..."
                        />
                    </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mt-4">
                    <label className="block text-sm font-bold text-blue-300 mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span>ベース写真・商品画像 <span className="text-gray-700 font-normal text-xs">(推奨)</span></span>
                        <span className="text-slate-800 font-medium font-normal text-xs bg-white/90 border border-slate-200 shadow-sm text-slate-8000 border border-white shadow-lg/80 px-2 py-0.5 rounded border border-gray-700">複数枚（最大5枚）選択可能</span>
                    </label>
                    <p className="text-xs text-[#D4A373]/80 mb-3">※複数アップロードすると、AIがそれぞれの画像を使ってバリエーション豊かなカルーセルを生成します。</p>
                    <div className="flex items-center gap-4">
                        <input
                            id="baseImageInput"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleBaseImageUpload}
                            className="w-full text-sm text-slate-800 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30 transition-all cursor-pointer"
                        />
                    </div>
                    {value.baseImages && value.baseImages.length > 0 && (
                        <div className="mt-4 p-3 bg-black/50 rounded-lg border border-blue-500/20 shadow-lg">
                            <p className="text-xs text-slate-800 font-medium mb-3 flex items-center justify-between">
                                アップロード済みプレビュー ({value.baseImages.length}/5)
                                <button
                                    onClick={() => onChange({ ...value, baseImages: [] })}
                                    className="text-red-400 hover:text-red-300 underline"
                                >
                                    すべて削除
                                </button>
                            </p>
                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                {value.baseImages.map((imgBase64, idx) => (
                                    <div key={idx} className="relative group shrink-0">
                                        <img src={imgBase64} alt={`Preview ${idx + 1}`} className="h-24 w-24 object-cover rounded border border-gray-600 shadow-md" />
                                        <button
                                            onClick={() => removeBaseImage(idx)}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-gray-900 rounded-full text-xs flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all shadow-lg"
                                            title="この画像を削除"
                                        >
                                            ✕
                                        </button>
                                        <span className="absolute bottom-1 left-1 bg-black/70 text-gray-900 text-[10px] px-1.5 rounded">{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white/60 backdrop-blur-md border border-slate-200/60 p-5 md:p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
                    <label className="block text-sm font-extrabold text-slate-800 mb-2">
                        ブランドロゴ・透かし画像 (任意) <span className="text-slate-500 font-medium ml-2 text-xs">※自動で軽量化されます</span>
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

                                        // 背景を完全に透過クリアする
                                        ctx.clearRect(0, 0, finalSize, finalSize);

                                        // 真円にクリッピングするためのパスを作成
                                        ctx.save();
                                        ctx.beginPath();
                                        ctx.arc(finalSize / 2, finalSize / 2, finalSize / 2, 0, Math.PI * 2, true);
                                        ctx.closePath();
                                        ctx.clip();

                                        // 中央を基準に画像を正方形に切り抜いて描画
                                        const sx = (img.width - minSize) / 2;
                                        const sy = (img.height - minSize) / 2;

                                        ctx.drawImage(img, sx, sy, minSize, minSize, 0, 0, finalSize, finalSize);
                                        ctx.restore();

                                        // 丸く切り抜いた部分以外を透明にするため、必ずPNGで出力する
                                        const compressedDataUrl = canvas.toDataURL('image/png');
                                        onChange({ ...value, logoUrl: compressedDataUrl });
                                    };
                                    img.src = reader.result;
                                };
                                reader.readAsDataURL(file);
                            }}
                            className="w-full max-w-full flex-1 bg-white/80 border border-slate-200 rounded-xl p-2.5 text-slate-600 text-[11px] sm:text-sm file:mr-3 file:sm:mr-5 file:py-2 file:sm:py-2.5 file:px-4 file:sm:px-6 file:rounded-full file:border-0 file:text-[10px] file:sm:text-sm file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 hover:file:shadow-md hover:file:-translate-y-0.5 file:transition-all cursor-pointer shadow-sm hover:border-slate-300 transition-all font-medium"
                        />
                        {value.logoUrl && (
                            <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden border-2 border-rose-200 relative group bg-white/90 border border-slate-200 shadow-sm text-slate-8000 border border-white shadow-lg/80">
                                <img src={value.logoUrl} alt="Logo" className="h-full w-full object-cover" />
                                <button
                                    onClick={() => {
                                        onChange({ ...value, logoUrl: null });
                                        const input = document.getElementById('logoImageInput');
                                        if (input) input.value = '';
                                    }}
                                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                                >
                                    削除
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">
                        <strong>自動で「綺麗な丸型（真円）」に切り抜かれ、軽量化されます（上限10MB）。</strong><br />
                        生成された画像の右下に自動でロゴとして合成されます。<br />
                        <span className="text-slate-400">※四角い画像を入れても自動で丸く加工されます。</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
