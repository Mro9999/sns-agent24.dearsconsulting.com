"use client";

import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

// Pro Max Plan 個別相談申込モーダル
// エンタープライズフロー: 相談 → 個別設定 → 契約 の入口となるフォーム
export default function ProMaxInquiryModal({ isOpen, onClose, defaultEmail = '', defaultName = '' }) {
    const [form, setForm] = useState({
        company_name: '',
        contact_name: defaultName,
        email: defaultEmail,
        phone: '',
        business_description: '',
        inquiry_details: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSubmitted(false);
            setError('');
            setForm(prev => ({
                ...prev,
                email: defaultEmail || prev.email,
                contact_name: defaultName || prev.contact_name
            }));
        }
    }, [isOpen, defaultEmail, defaultName]);

    if (!isOpen) return null;

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.company_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
            setError('必須項目をすべてご入力ください');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/pro-max-inquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'お申込みの送信に失敗しました');
            }
            setSubmitted(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-rose-500" />
                        <h2 className="font-bold text-gray-900">Pro Max Plan 個別相談</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
                        aria-label="閉じる"
                    >
                        <X size={18} />
                    </button>
                </div>

                {submitted ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 size={32} className="text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">お申込みを承りました</h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-6">
                            ご入力いただいたメールアドレスに<br />
                            受付完了のご連絡をお送りしました。<br />
                            2営業日以内に担当者よりご返信いたします。
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-900 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-gray-800"
                        >
                            閉じる
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3">
                            Pro Max Plan はお客様の事業特性に合わせたカスタム設定をご提供するため、個別相談からご契約までをお受けしております。まずは以下のフォームよりご連絡ください。
                        </p>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">会社名 <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={form.company_name}
                                onChange={handleChange('company_name')}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                                placeholder="株式会社サンプル"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">お名前 <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={form.contact_name}
                                onChange={handleChange('contact_name')}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                                placeholder="山田 太郎"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">メールアドレス <span className="text-rose-500">*</span></label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={handleChange('email')}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                                placeholder="contact@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">電話番号</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={handleChange('phone')}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                                placeholder="03-1234-5678"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">事業内容</label>
                            <textarea
                                value={form.business_description}
                                onChange={handleChange('business_description')}
                                rows={2}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 resize-none"
                                placeholder="例: 美容サロン経営、BtoBコンサルティング 等"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">ご相談内容</label>
                            <textarea
                                value={form.inquiry_details}
                                onChange={handleChange('inquiry_details')}
                                rows={4}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 resize-none"
                                placeholder="現在のSNS運用の課題や、Pro Maxで実現したい運用体制などをお聞かせください"
                            />
                        </div>

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
                                {error}
                            </div>
                        )}

                        <div className="pt-2 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="flex-1 py-3 rounded-full text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-[1.5] py-3 rounded-full text-sm font-bold bg-gradient-to-r from-rose-500 to-[#D4A373] text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting && <Loader2 size={16} className="animate-spin" />}
                                {submitting ? '送信中...' : '相談を申し込む'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
