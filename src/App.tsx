import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Play, Trash2, RotateCcw, X, Shield, 
  Film, Image as ImageIcon, LogOut, 
  Maximize, Pause, ChevronRight, FastForward, Rewind,
  Plus, Library, Download, Loader2, AlertCircle
} from 'lucide-react';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';
const ACCESS_KEY = '2400H';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function CinemaVault() {
  // --- STATES ĐĂNG NHẬP (GIỮ NGUYÊN) ---
  const [isLogged, setIsLogged] = useState<boolean>(() => localStorage.getItem('vault_logged_in') === 'true');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- STATES DỮ LIỆU (GIỮ NGUYÊN) ---
  const [media, setMedia] = useState<any[]>([]);
  const [type, setType] = useState<'video' | 'image' | 'library'>('video'); 
  const [tab, setTab] = useState<'main' | 'trash'>('main');
  const [viewing, setViewing] = useState<any | null>(null);
  
  // --- STATES TẢI LÊN & LOADING (GIỮ NGUYÊN) ---
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const touchTimer = useRef<any>(null);

  // --- STATES PLAYER (CẤM XOÁ - GIỮ NGUYÊN 100%) ---
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const sanitizeFileName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  };

  // --- FETCH DỮ LIỆU (GIỮ NGUYÊN LOGIC) ---
  const fetchMedia = useCallback(async () => {
    if (type === 'library') return;
    setIsLoading(true);
    const tables = tab === 'trash' ? ['private_videos', 'private_images'] : (type === 'image' ? ['private_images'] : ['private_videos']);
    let allData: any[] = [];
    try {
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
        if (!error && data) allData = [...allData, ...data.map(item => ({ ...item, origin_table: table }))];
      }
      const filtered = allData.filter((item: any) => {
        const isTrash = item.is_deleted === true;
        if (tab === 'trash') return isTrash;
        if (isTrash) return false;
        return type === 'video' ? item.origin_table === 'private_videos' : item.origin_table === 'private_images';
      });
      setMedia(filtered);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [tab, type]);

  useEffect(() => { if (isLogged) fetchMedia(); }, [isLogged, fetchMedia, type, tab]);

  useEffect(() => {
    const handleContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', handleContext);
    return () => window.removeEventListener('contextmenu', handleContext);
  }, []);

  const handleConfirmLogout = () => {
    localStorage.removeItem('vault_logged_in');
    setIsLogged(false);
    setShowLogoutModal(false);
  };

  // --- ACTIONS: TẢI LÊN (FIX LỖI BUILD) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(10);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const bucketName = isVideo ? 'videos' : 'images'; 
      const tableName = isVideo ? 'private_videos' : 'private_images';
      const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
      try {
        const { error: storageError } = await supabase.storage.from(bucketName).upload(fileName, file, { contentType: file.type } as any);
        if (storageError) throw storageError;
        const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        await supabase.from(tableName).insert([{ name: file.name, url: publicUrl, is_deleted: false }]);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (error: any) { alert("Lỗi: " + error.message); }
    }
    setUploading(false); fetchMedia();
  };

  // --- ACTIONS: THÙNG RÁC (GIỮ NGUYÊN) ---
  const handleMoveToTrash = async (item: any) => {
    setIsLoading(true);
    const isImg = item.origin_table === 'private_images';
    const sourceBucket = isImg ? 'images' : 'videos';
    const oldFileName = item.url.split('/').pop()?.split('?')[0] || "";
    const trashFileName = `trash_${Date.now()}_${oldFileName}`;
    try {
      const { data: fileBlob } = await supabase.storage.from(sourceBucket).download(oldFileName);
      if (fileBlob) {
        await supabase.storage.from('trash').upload(trashFileName, fileBlob, { contentType: isImg ? 'image/jpeg' : 'video/mp4' });
        await supabase.storage.from(sourceBucket).remove([oldFileName]);
        const { data: { publicUrl } } = supabase.storage.from('trash').getPublicUrl(trashFileName);
        await supabase.from(item.origin_table).update({ url: publicUrl, is_deleted: true }).eq('id', item.id);
      }
      setViewing(null);
    } catch (e: any) { alert("Lỗi: " + e.message); }
    setLongPressedId(null); fetchMedia();
  };

  const handleRestore = async (item: any) => {
    setIsLoading(true);
    const isImg = item.origin_table === 'private_images';
    const targetBucket = isImg ? 'images' : 'videos';
    const trashFileName = item.url.split('/').pop()?.split('?')[0] || "";
    const originalFileName = `restored_${Date.now()}_${trashFileName.replace('trash_', '')}`;
    try {
      const { data: fileBlob } = await supabase.storage.from('trash').download(trashFileName);
      if (fileBlob) {
        await supabase.storage.from(targetBucket).upload(originalFileName, fileBlob, { contentType: isImg ? 'image/jpeg' : 'video/mp4' });
        await supabase.storage.from('trash').remove([trashFileName]);
        const { data: { publicUrl } } = supabase.storage.from(targetBucket).getPublicUrl(originalFileName);
        await supabase.from(item.origin_table).update({ url: publicUrl, is_deleted: false }).eq('id', item.id);
      }
    } catch (e: any) { alert("Lỗi: " + e.message); }
    setLongPressedId(null); fetchMedia();
  };

  const handlePermanentDelete = async (id: string, itemUrl: string, table: string) => {
    if (confirm("Xoá vĩnh viễn?")) {
      setIsLoading(true);
      const fileName = itemUrl.split('/').pop()?.split('?')[0] || "unknown";
      try {
        await supabase.storage.from('trash').remove([fileName]);
        await supabase.from(table).delete().eq('id', id);
        fetchMedia();
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); setLongPressedId(null); }
    }
  };

  const togglePlay = () => { if (videoRef.current) { if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); } else { videoRef.current.pause(); setIsPlaying(false); } } };
  const skipTime = (amount: number) => { if (videoRef.current) videoRef.current.currentTime += amount; };
  const handleUserActivity = () => { setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000); };
  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; };

  if (!isLogged) return (
    <div className="h-screen bg-black flex items-center justify-center p-6 text-white select-none">
      <div className="w-full max-w-sm bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-xl">
        <Shield className="text-red-600 mx-auto mb-6" size={48} />
        <h1 className="text-xl font-black italic uppercase mb-8 text-center tracking-widest">Vault Access</h1>
        <input type="password" autoFocus className="w-full bg-black border border-white/10 p-4 rounded-2xl text-center text-white text-2xl tracking-[0.5em] outline-none focus:border-red-600" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as any).value === ACCESS_KEY) { setIsLogged(true); localStorage.setItem('vault_logged_in', 'true'); }}} />
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#070707] text-zinc-100 font-sans overflow-hidden select-none flex-col md:flex-row">
      {(isLoading || uploading) && <div className="fixed top-0 left-0 right-0 h-1 z-[110] bg-zinc-800"><div className="h-full bg-red-600 transition-all" style={{ width: uploading ? `${uploadProgress}%` : '50%' }}></div></div>}

      {/* NAV (BOTTOM ON MOBILE, SIDE ON PC) */}
      <nav className="order-2 md:order-1 flex-none h-16 md:h-full w-full md:w-20 lg:w-64 bg-zinc-900 md:bg-black border-t md:border-t-0 md:border-r border-white/5 flex md:flex-col items-center justify-around md:justify-start md:pt-10 z-[60]">
        <div className="hidden md:flex mb-10"><Shield className="text-red-600" size={32} /></div>
        <NavItem active={type === 'video' && tab === 'main'} onClick={() => {setType('video'); setTab('main');}} icon={<Film size={22}/>} label="Phim" />
        <NavItem active={type === 'image' && tab === 'main'} onClick={() => {setType('image'); setTab('main');}} icon={<ImageIcon size={22}/>} label="Ảnh" />
        <NavItem active={type === 'library' || tab === 'trash'} onClick={() => setType('library')} icon={<Library size={22}/>} label="Thư viện" />
        <button onClick={() => setShowLogoutModal(true)} className="p-4 text-zinc-500 hover:text-red-500"><LogOut size={22}/></button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="order-1 md:order-2 flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="px-5 py-4 flex items-center justify-between bg-black/50 backdrop-blur-md border-b border-white/5">
          <h2 className="text-lg font-black italic uppercase text-zinc-400 tracking-tighter">{tab === 'trash' ? 'Thùng rác' : (type === 'video' ? 'Phim' : 'Ảnh')}</h2>
          <label className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 active:scale-95 transition-transform">
            {uploading ? <Loader2 className="animate-spin" size={14}/> : <Plus size={16}/>}
            <span>{uploading ? `${uploadProgress}%` : 'Tải lên'}</span>
            <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="video/*,image/*" disabled={uploading} />
          </label>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scroll">
          {type === 'library' ? (
            <div className="max-w-md mx-auto py-10">
              <div onClick={() => {setTab('trash'); setType('video');}} className="p-6 bg-zinc-900/50 rounded-3xl border border-white/5 flex items-center justify-between group active:bg-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center"><Trash2 size={24}/></div>
                  <p className="font-black uppercase italic">Thùng rác</p>
                </div>
                <ChevronRight className="text-zinc-600"/>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {media.map((m) => (
                <div key={m.id} 
                  onContextMenu={(e) => e.preventDefault()}
                  onTouchStart={() => touchTimer.current = setTimeout(() => setLongPressedId(m.id), 500)}
                  onTouchEnd={() => clearTimeout(touchTimer.current)}
                  onMouseDown={() => touchTimer.current = setTimeout(() => setLongPressedId(m.id), 500)}
                  onMouseUp={() => clearTimeout(touchTimer.current)}
                  onClick={() => setViewing(m)}
                  className="relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden group border border-white/5"
                >
                  {m.origin_table === 'private_videos' ? (
                    <video src={`${m.url}#t=0.5`} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={m.url} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <div className={`absolute inset-0 bg-black/60 flex items-center justify-center gap-4 transition-opacity ${longPressedId === m.id ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
                    {tab === 'trash' && <button onClick={(e) => {e.stopPropagation(); handleRestore(m)}} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center"><RotateCcw size={20}/></button>}
                    <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(m.id, m.url, m.origin_table) : handleMoveToTrash(m)}} className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center"><Trash2 size={20}/></button>
                  </div>
                  {m.origin_table === 'private_videos' && <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1"><Play size={8} fill="currentColor"/> Video</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* PLAYER MODAL - MOBILE OPTIMIZED (KHÔNG CÒN BỊ NÁT) */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col" onMouseMove={handleUserActivity} onClick={handleUserActivity}>
          {/* HEADER TRONG PLAYER: Đã tách riêng ra khỏi nội dung để không bị đè */}
          <header className={`absolute top-0 inset-x-0 z-[110] flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 invisible'}`}>
            <h2 className="text-xs font-black uppercase italic truncate max-w-[60%] text-zinc-100">{viewing.name}</h2>
            <div className="flex gap-2">
              <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(viewing.id, viewing.url, viewing.origin_table) : handleMoveToTrash(viewing); setViewing(null);}} className="w-9 h-9 bg-red-600 text-white rounded-xl flex items-center justify-center"><Trash2 size={18}/></button>
              <button onClick={() => setViewing(null)} className="w-9 h-9 bg-white/10 text-white rounded-xl flex items-center justify-center"><X size={20}/></button>
            </div>
          </header>

          <div ref={playerContainerRef} className="flex-1 flex items-center justify-center relative bg-black">
            {viewing.origin_table === 'private_images' ? <img src={viewing.url} className="max-h-full max-w-full object-contain" /> : (
              <>
                <video ref={videoRef} src={viewing.url} autoPlay playsInline crossOrigin="anonymous" className="w-full max-h-full object-contain" 
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} 
                  onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} 
                  onClick={(e) => {e.stopPropagation(); togglePlay();}} 
                />
                
                {/* CONTROLS TRONG PLAYER: Fix khoảng cách để ngón tay dễ bấm */}
                <div className={`absolute inset-x-0 bottom-0 p-6 md:p-12 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 invisible'}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-mono text-zinc-400 w-10">{formatTime(currentTime)}</span>
                    <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={(e) => {if(videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value)}} className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-red-600" />
                    <span className="text-[10px] font-mono text-zinc-400 w-10">{formatTime(duration)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8 text-white">
                      <button onClick={(e) => {e.stopPropagation(); skipTime(-10);}}><Rewind size={24}/></button>
                      <button onClick={(e) => {e.stopPropagation(); togglePlay();}} className="bg-white/10 p-4 rounded-full">{isPlaying ? <Pause size={32} fill="currentColor"/> : <Play size={32} fill="currentColor"/>}</button>
                      <button onClick={(e) => {e.stopPropagation(); skipTime(10);}}><FastForward size={24}/></button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex bg-zinc-900 rounded-lg p-1">
                        {[1, 1.5, 2].map(s => (<button key={s} onClick={(e) => {e.stopPropagation(); if(videoRef.current) videoRef.current.playbackRate = s; setPlaybackRate(s);}} className={`px-2 py-1 text-[10px] font-black rounded ${playbackRate === s ? 'bg-red-600 text-white' : 'text-zinc-500'}`}>{s}x</button>))}
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); if(!document.fullscreenElement) playerContainerRef.current?.requestFullscreen(); else if(document.exitFullscreen) document.exitFullscreen();}}><Maximize size={20}/></button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL ĐĂNG XUẤT (GIỮ NGUYÊN) */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-xs bg-zinc-900 p-8 rounded-[2.5rem] text-center">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={40}/>
            <p className="font-black uppercase italic mb-6">Thoát Vault?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-4 bg-zinc-800 rounded-2xl text-[10px] font-black uppercase">Huỷ</button>
              <button onClick={handleConfirmLogout} className="flex-1 py-4 bg-red-600 rounded-2xl text-[10px] font-black uppercase text-white">Có</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        input[type='range']::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; background: #dc2626; border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 rounded-2xl transition-all w-full md:mb-2 relative ${active ? 'bg-red-600/10 text-red-500' : 'text-zinc-500 hover:text-white'}`}>
      {icon}
      <span className="text-[8px] md:text-xs font-black uppercase italic lg:block hidden">{label}</span>
      {active && <div className="absolute right-0 w-1 h-8 bg-red-600 rounded-l-full hidden lg:block" />}
    </button>
  );
}