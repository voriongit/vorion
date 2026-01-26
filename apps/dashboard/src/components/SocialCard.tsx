export default function SocialCard({ platform, content }: { platform: 'twitter' | 'linkedin', content: string }) {
    if (platform === 'twitter') {
        return (
            <div className="max-w-md bg-black border border-[#2f3336] rounded-xl p-4 my-2 font-sans">
                <div className="flex gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-700" />
                    <div>
                        <div className="font-bold text-slate-200 text-sm">Vorion Inc. <span className="text-slate-500 font-normal">@VorionAI · 1m</span></div>
                    </div>
                </div>
                <div className="text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap">
                    {content}
                </div>
                <div className="flex justify-between mt-4 text-slate-500 text-sm">
                    <span>💬 12</span>
                    <span>⚡ 48</span>
                    <span>❤️ 156</span>
                    <span>📊 1.2k</span>
                </div>
            </div>
        );
    }
    
    // LinkedIn
    return (
        <div className="max-w-lg bg-white text-black border border-slate-300 rounded-lg my-2 font-sans overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex gap-2 items-center">
                 <div className="w-8 h-8 rounded bg-slate-200" />
                 <div>
                     <div className="text-sm font-bold">Vorion Inc.</div>
                     <div className="text-xs text-slate-500">Autonomous Ecosystem</div>
                 </div>
            </div>
            <div className="p-4 py-6 text-sm leading-relaxed whitespace-pre-wrap">
                {content}
            </div>
            <div className="bg-slate-50 p-2 flex gap-4 text-slate-500 text-sm border-t border-slate-100">
                <span>👍 Like</span>
                <span>💬 Comment</span>
                <span>🔁 Repost</span>
                <span>🚀 Send</span>
            </div>
        </div>
    );
}
