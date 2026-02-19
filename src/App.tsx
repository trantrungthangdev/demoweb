import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Play, Trash2, RotateCcw, X, Shield, 
  Film, Image as ImageIcon, LogOut, 
  Maximize, Volume2, Pause, ChevronRight, FastForward, Rewind, VolumeX,
  Plus, Library, Download, Loader2, AlertCircle
} from 'lucide-react';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';
const ACCESS_KEY = '2400H';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function CinemaVault() {
  // --- STATES ĐĂNG NHẬP ---
  const [isLogged, setIsLogged] = useState<boolean>(() => localStorage.getItem('vault_logged_in') === 'true');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- STATES DỮ LIỆU ---
  const [media, setMedia] = useState<any[]>([]);
  const [type, setType] = useState<'video' | 'image' | 'library'>('video'); 
  const [tab, setTab] = useState<'main' | 'trash'>('main');
  const [viewing, setViewing] = useState<any | null>(null);
  
  // --- STATES TẢI LÊN & LOADING ---
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const touchTimer = useRef<any>(null);

  // --- STATES PLAYER (GIỮ NGUYÊN 100% - CẤM XOÁ) ---
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const isVideoFile = (url: string) => url?.match(/\.(mp4|webm|ogg|mov|m4v)$/i);
  const isImageFile = (url: string) => url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  const sanitizeFileName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  };

  // --- FETCH DỮ LIỆU ---
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
        const itemName = item.name || "";
        const isTrash = itemName.includes('_trash') || item.is_deleted === true;
        if (tab === 'trash') return isTrash;
        if (isTrash) return false;
        if (type === 'video') return isVideoFile(item.url) || item.origin_table === 'private_videos';
        if (type === 'image') return isImageFile(item.url) || item.origin_table === 'private_images';
        return true;
      });
      setMedia(filtered);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [tab, type]);

  useEffect(() => { if (isLogged) fetchMedia(); }, [isLogged, fetchMedia, type, tab]);

  // --- ACTIONS: ĐĂNG XUẤT ---
  const handleConfirmLogout = () => {
    localStorage.removeItem('vault_logged_in');
    setIsLogged(false);
    setShowLogoutModal(false);
  };

  // --- ACTIONS: TẢI LÊN ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const bucketName = isVideo ? 'videos' : 'images'; 
      const tableName = isVideo ? 'private_videos' : 'private_images';
      const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
      try {
        const { error: storageError } = await supabase.storage.from(bucketName).upload(fileName, file, {
          onUploadProgress: (p) => setUploadProgress(Math.round((p.bytesTransferred / p.totalBytes) * 100))
        });
        if (storageError) throw storageError;
        const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        await supabase.from(tableName).insert([{ name: file.name, url: publicUrl, is_deleted: false }]);
      } catch (error: any) { alert("Lỗi: " + error.message); }
    }
    setUploading(false); fetchMedia();
  };

  // --- ACTIONS: THÙNG RÁC (FIX LỖI URL KHÔNG XEM ĐƯỢC) ---
  const handleMoveToTrash = async (item: any) => {
    setIsLoading(true);
    const sourceBucket = item.origin_table === 'private_images' ? 'images' : 'videos';
    const oldFileName = item.url.split('/').pop();
    const trashFileName = `${oldFileName}_trash`;
    try {
      const { data: fileBlob } = await supabase.storage.from(sourceBucket).download(oldFileName);
      if (fileBlob) {
        await supabase.storage.from('trash').upload(trashFileName, fileBlob);
        await supabase.storage.from(sourceBucket).remove([oldFileName]);
        
        // Lấy URL mới từ bucket trash
        const { data: { publicUrl } } = supabase.storage.from('trash').getPublicUrl(trashFileName);
        
        // Cập nhật Database với URL mới để video có thể xem được trong thùng rác
        await supabase.from(item.origin_table).update({ 
          name: `${item.name}_trash`, 
          url: publicUrl,
          is_deleted: true 
        }).eq('id', item.id);
      }
      setViewing(null);
    } catch (e: any) { alert("Lỗi: Kiểm tra Policy của bucket 'trash' đã Public chưa?"); }
    setLongPressedId(null); await fetchMedia();
  };

  const handleRestore = async (item: any) => {
    setIsLoading(true);
    const targetBucket = item.origin_table === 'private_images' ? 'images' : 'videos';
    const trashFileName = item.url.split('/').pop();
    const originalFileName = trashFileName.replace('_trash', '');
    try {
      const { data: fileBlob } = await supabase.storage.from('trash').download(trashFileName);
      if (fileBlob) {
        await supabase.storage.from(targetBucket).upload(originalFileName, fileBlob);
        await supabase.storage.from('trash').remove([trashFileName]);
        
        const { data: { publicUrl } } = supabase.storage.from(targetBucket).getPublicUrl(originalFileName);
        
        await supabase.from(item.origin_table).update({ 
          name: item.name.replace('_trash', ''), 
          url: publicUrl, 
          is_deleted: false 
        }).eq('id', item.id);
      }
    } catch (e: any) { alert("Lỗi khôi phục"); }
    setLongPressedId(null); await fetchMedia();
  };

  const handlePermanentDelete = async (id: string, itemUrl: string, table: string) => {
    if (confirm("Xoá vĩnh viễn tệp này?")) {
      setIsLoading(true);
      const fileName = itemUrl.split('/').pop();
      try {
        await Promise.all([
          supabase.storage.from('trash').remove([fileName || ""]),
          supabase.from(table).delete().eq('id', id)
        ]);
        await fetchMedia();
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); setLongPressedId(null); }
    }
  };

  const handleClearTrash = async () => {
    if (media.length === 0) return;
    if (!confirm(`Xoá sạch ${media.length} tệp?`)) return;
    setIsLoading(true);
    try {
      await Promise.all(media.map(async (item) => {
        const fileName = item.url.split('/').pop();
        return Promise.all([
          supabase.storage.from('trash').remove([fileName || ""]),
          supabase.from(item.origin_table).delete().eq('id', item.id)
        ]);
      }));
      await fetchMedia();
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  // --- PLAYER LOGIC ---
  const togglePlay = () => { if (videoRef.current) { if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); } else { videoRef.current.pause(); setIsPlaying(false); } } };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { if (videoRef.current) { videoRef.current.currentTime = parseFloat(e.target.value); setCurrentTime(videoRef.current.currentTime); } };
  const skipTime = (amount: number) => { if (videoRef.current) videoRef.current.currentTime += amount; };
  const handleUserActivity = () => { setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000); };
  const formatTime = (seconds: number) => { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = Math.floor(seconds % 60); return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`; };

  if (!isLogged) return (
    <div className="h-screen bg-black flex items-center justify-center p-6 text-white text-center">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl">
        <Shield className="text-red-600 mx-auto mb-6" size={48} />
        <h1 className="text-2xl font-black italic uppercase mb-8 tracking-widest">Cinema Vault</h1>
        <input type="password" autoFocus placeholder="••••" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-center text-white text-2xl tracking-[0.5em] outline-none focus:border-red-600" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as any).value === ACCESS_KEY) { setIsLogged(true); localStorage.setItem('vault_logged_in', 'true'); }}} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col md:flex-row font-sans overflow-hidden" onClick={() => setLongPressedId(null)}>
      {(isLoading || uploading) && <div className="fixed top-0 left-0 right-0 h-1 z-[110] bg-zinc-800 overflow-hidden"><div className="h-full bg-red-600 transition-all duration-300" style={{ width: uploading ? `${uploadProgress}%` : '50%' }}></div></div>}

      <nav className="fixed bottom-0 left-0 w-full h-16 bg-zinc-900/95 border-t border-white/5 flex items-center justify-around z-[60] md:relative md:w-20 lg:w-64 md:h-screen md:flex-col md:bg-black md:px-4 md:py-8">
        <NavItem active={type === 'video' && tab === 'main'} onClick={() => {setType('video'); setTab('main');}} icon={<Film size={22}/>} label="Phim" />
        <NavItem active={type === 'image' && tab === 'main'} onClick={() => {setType('image'); setTab('main');}} icon={<ImageIcon size={22}/>} label="Ảnh" />
        <NavItem active={type === 'library' || tab === 'trash'} onClick={() => setType('library')} icon={<Library size={22}/>} label="Thư viện" />
        <button onClick={() => setShowLogoutModal(true)} className="p-4 text-zinc-500 hover:text-red-500 transition-colors"><LogOut size={22}/></button>
      </nav>

      <main className="flex-1 h-screen overflow-y-auto pb-20 md:pb-0">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-white/5">
          <h2 className="text-xl font-black italic uppercase text-zinc-400">{tab === 'trash' ? 'Thùng rác' : (type === 'video' ? 'Phim' : 'Ảnh')}</h2>
          <div className="flex items-center gap-3">
            {tab === 'trash' && media.length > 0 && <button onClick={handleClearTrash} className="bg-red-600/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"><Trash2 size={16}/> Xoá hết</button>}
            <label className={`cursor-pointer ${uploading ? 'bg-zinc-800' : 'bg-white text-black'} px-5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all`}>
              {uploading ? <Loader2 className="animate-spin" size={16}/> : <Plus size={18}/>}
              <span>{uploading ? `${uploadProgress}%` : 'Tải lên'}</span>
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="video/*,image/*" disabled={uploading} />
            </label>
          </div>
        </header>

        <div className="p-2 md:p-6">
          {type === 'library' ? (
            <div className="max-w-xl mx-auto space-y-3">
              <div onClick={() => {setTab('trash'); setType('video');}} className="flex items-center justify-between p-6 bg-zinc-900 rounded-[2rem] border border-white/5 cursor-pointer hover:bg-zinc-800 transition-all">
                <div className="flex items-center gap-4"><div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-500"><Trash2/></div><div><p className="font-black uppercase italic">Thùng rác</p><p className="text-[10px] text-zinc-500 uppercase">{media.length} tệp</p></div></div><ChevronRight/>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-2">
              {media.length === 0 && !isLoading && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black italic text-4xl text-white">Trống trơn</div>}
              {media.map((m) => (
                <div key={m.id} onMouseDown={() => touchTimer.current = setTimeout(() => setLongPressedId(m.id), 600)} onMouseUp={() => clearTimeout(touchTimer.current)} onTouchStart={() => touchTimer.current = setTimeout(() => setLongPressedId(m.id), 600)} onTouchEnd={() => clearTimeout(touchTimer.current)} onClick={(e) => { e.stopPropagation(); setViewing(m); }} className="relative aspect-square group cursor-pointer overflow-hidden rounded-lg bg-zinc-900">
                  {isVideoFile(m.url) ? (
                    <video src={`${m.url}#t=0.5`} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                  ) : (
                    <img src={m.url} className="w-full h-full object-cover" />
                  )}
                  {longPressedId === m.id && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 animate-in fade-in">
                      {tab === 'trash' && <button onClick={(e) => {e.stopPropagation(); handleRestore(m)}} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"><RotateCcw size={20}/></button>}
                      <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(m.id, m.url, m.origin_table) : handleMoveToTrash(m)}} className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"><Trash2 size={20}/></button>
                    </div>
                  )}
                  {isVideoFile(m.url) && <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[8px] font-black uppercase flex items-center gap-1"><Play size={8} fill="currentColor"/> Video</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL ĐĂNG XUẤT */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-xs bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32}/></div>
            <h3 className="text-xl font-black italic uppercase mb-2">Đăng xuất?</h3>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={() => setShowLogoutModal(false)} className="py-4 bg-zinc-800 rounded-2xl text-[10px] font-black uppercase">Huỷ</button>
              <button onClick={handleConfirmLogout} className="py-4 bg-red-600 rounded-2xl text-[10px] font-black uppercase text-white">Có</button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER MODAL (GIỮ NGUYÊN) */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in" onMouseMove={handleUserActivity} onClick={handleUserActivity}>
          <header className={`absolute top-0 inset-x-0 z-20 flex justify-between items-start p-4 md:p-8 bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-3 overflow-hidden mr-4">
              <div className="w-1 h-8 bg-red-600 rounded-full shrink-0" />
              <h2 className="text-xs md:text-xl font-black uppercase italic truncate max-w-[150px] text-zinc-100">{viewing.name.replace('_trash','')}</h2>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(viewing.id, viewing.url, viewing.origin_table) : handleMoveToTrash(viewing); setViewing(null);}} className="w-10 h-10 md:w-14 md:h-14 bg-red-600/20 text-red-500 rounded-xl flex items-center justify-center transition-all hover:bg-red-600 hover:text-white"><Trash2 size={24}/></button>
              <a href={viewing.url} download className="w-10 h-10 md:w-14 md:h-14 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all text-white"><Download size={24}/></a>
              <button onClick={() => setViewing(null)} className="w-10 h-10 md:w-14 md:h-14 bg-white/10 hover:bg-red-600 rounded-xl flex items-center justify-center transition-all text-white"><X size={24}/></button>
            </div>
          </header>

          <div ref={playerContainerRef} className="flex-1 flex items-center justify-center relative bg-black overflow-hidden group/player">
            {!isVideoFile(viewing.url) ? <img src={viewing.url} className="max-h-full max-w-full object-contain" /> : (
              <>
                <video ref={videoRef} src={viewing.url} autoPlay playsInline preload="auto" crossOrigin="anonymous" className="w-full h-full object-contain" onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)} onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)} onClick={togglePlay} />
                <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 md:p-12 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="flex items-center gap-4 mb-6 md:mb-10">
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12 text-right">{formatTime(currentTime)}</span>
                    <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={handleSeek} className="flex-1 h-1 md:h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-600" />
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12">{formatTime(duration)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-10 text-white">
                      <div className="flex items-center gap-2 md:gap-6">
                        <button onClick={(e) => {e.stopPropagation(); skipTime(-10);}} className="text-zinc-400 hover:text-white transition-colors"><Rewind size={24} /></button>
                        <button onClick={(e) => {e.stopPropagation(); togglePlay();}} className="text-white hover:scale-110 transition-transform">{isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}</button>
                        <button onClick={(e) => {e.stopPropagation(); skipTime(10);}} className="text-zinc-400 hover:text-white transition-colors"><FastForward size={24} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8 text-white">
                      <div className="flex bg-zinc-900/80 rounded-lg md:rounded-xl p-1 border border-white/5">
                        {[1, 1.5, 2].map(speed => (<button key={speed} onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.playbackRate = speed; setPlaybackRate(speed); }} className={`px-3 py-1 md:px-4 md:py-1.5 text-[9px] md:text-[11px] font-black rounded-md transition-all ${playbackRate === speed ? 'bg-red-600 text-white' : 'text-zinc-500'}`}>{speed}x</button>))}
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); if (playerContainerRef.current) { if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen(); else document.exitFullscreen(); }}} className="text-zinc-400 hover:text-white transition-colors"><Maximize size={22} /></button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}</style>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl transition-all w-full relative ${active ? 'bg-red-600/10 text-red-500' : 'text-zinc-600 hover:text-white'}`}>
      <div className={`${active ? 'scale-110' : ''}`}>{icon}</div>
      <span className="text-[9px] md:text-xs font-black uppercase italic lg:block hidden tracking-tighter">{label}</span>
      {active && <div className="absolute right-0 w-1 h-8 bg-red-600 rounded-l-full hidden lg:block" />}
    </button>
  );
}