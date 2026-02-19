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

  const isVideoFile = (url: string) => url?.match(/\.(mp4|webm|ogg|mov|m4v)/i);
  const isImageFile = (url: string) => url?.match(/\.(jpg|jpeg|png|gif|webp)/i);

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
        const isTrash = item.is_deleted === true;
        if (tab === 'trash') return isTrash;
        if (isTrash) return false;
        if (type === 'video') return item.origin_table === 'private_videos';
        if (type === 'image') return item.origin_table === 'private_images';
        return true;
      });
      setMedia(filtered);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [tab, type]);

  useEffect(() => { if (isLogged) fetchMedia(); }, [isLogged, fetchMedia, type, tab]);

  // --- VÔ HIỆU HOÁ CHUỘT PHẢI ---
  useEffect(() => {
    const handleContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', handleContext);
    return () => window.removeEventListener('contextmenu', handleContext);
  }, []);

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
          contentType: file.type,
          onUploadProgress: (p) => setUploadProgress(Math.round((p.bytesTransferred / p.totalBytes) * 100))
        });
        if (storageError) throw storageError;
        const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        await supabase.from(tableName).insert([{ name: file.name, url: publicUrl, is_deleted: false }]);
      } catch (error: any) { alert("Lỗi: " + error.message); }
    }
    setUploading(false); fetchMedia();
  };

  // --- ACTIONS: THÙNG RÁC ---
  const handleMoveToTrash = async (item: any) => {
    setIsLoading(true);
    const isImg = item.origin_table === 'private_images';
    const sourceBucket = isImg ? 'images' : 'videos';
    const oldFileName = item.url.split('/').pop().split('?')[0];
    const trashFileName = `trash_${Date.now()}_${oldFileName}`;

    try {
      const { data: fileBlob, error: dlError } = await supabase.storage.from(sourceBucket).download(oldFileName);
      if (dlError) throw dlError;

      if (fileBlob) {
        const { error: upError } = await supabase.storage.from('trash').upload(trashFileName, fileBlob, {
          contentType: isImg ? 'image/jpeg' : 'video/mp4',
          upsert: true
        });
        if (upError) throw upError;

        await supabase.storage.from(sourceBucket).remove([oldFileName]);
        const { data: { publicUrl } } = supabase.storage.from('trash').getPublicUrl(trashFileName);
        
        await supabase.from(item.origin_table).update({ 
          url: publicUrl,
          is_deleted: true 
        }).eq('id', item.id);
      }
      setViewing(null);
    } catch (e: any) { alert("Lỗi di chuyển: " + e.message); }
    setLongPressedId(null); await fetchMedia();
  };

  const handleRestore = async (item: any) => {
    setIsLoading(true);
    const isImg = item.origin_table === 'private_images';
    const targetBucket = isImg ? 'images' : 'videos';
    const trashFileName = item.url.split('/').pop().split('?')[0];
    const originalFileName = `restored_${Date.now()}_${trashFileName.replace('trash_', '')}`;

    try {
      const { data: fileBlob, error: dlError } = await supabase.storage.from('trash').download(trashFileName);
      if (dlError) throw dlError;

      if (fileBlob) {
        const { error: upError } = await supabase.storage.from(targetBucket).upload(originalFileName, fileBlob, {
          contentType: isImg ? 'image/jpeg' : 'video/mp4',
          upsert: true
        });
        if (upError) throw upError;

        await supabase.storage.from('trash').remove([trashFileName]);
        const { data: { publicUrl } } = supabase.storage.from(targetBucket).getPublicUrl(originalFileName);
        
        await supabase.from(item.origin_table).update({ 
          url: publicUrl, 
          is_deleted: false 
        }).eq('id', item.id);
      }
    } catch (e: any) { alert("Lỗi khôi phục: " + e.message); }
    setLongPressedId(null); await fetchMedia();
  };

  const handlePermanentDelete = async (id: string, itemUrl: string, table: string) => {
    if (confirm("Xoá vĩnh viễn tệp này?")) {
      setIsLoading(true);
      const fileName = itemUrl.split('/').pop()?.split('?')[0];
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
        const fileName = item.url.split('/').pop()?.split('?')[0];
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
    <div className="flex h-screen w-full bg-[#070707] text-zinc-100 font-sans overflow-hidden select-none" onClick={() => setLongPressedId(null)}>
      {(isLoading || uploading) && <div className="fixed top-0 left-0 right-0 h-1 z-[110] bg-zinc-800 overflow-hidden"><div className="h-full bg-red-600 transition-all duration-300" style={{ width: uploading ? `${uploadProgress}%` : '50%' }}></div></div>}

      {/* SIDEBAR TỐI ƯU PC */}
      <nav className="fixed bottom-0 left-0 w-full h-16 bg-zinc-900/95 border-t border-white/5 flex items-center justify-around z-[60] md:static md:w-20 lg:w-64 md:h-full md:flex-col md:bg-black md:border-r md:border-t-0 md:px-4 md:py-8">
        <div className="hidden md:block mb-12">
            <Shield className="text-red-600" size={32} />
        </div>
        
        <div className="flex flex-row md:flex-col items-center justify-around w-full md:gap-4">
            <NavItem active={type === 'video' && tab === 'main'} onClick={() => {setType('video'); setTab('main');}} icon={<Film size={22}/>} label="Phim" />
            <NavItem active={type === 'image' && tab === 'main'} onClick={() => {setType('image'); setTab('main');}} icon={<ImageIcon size={22}/>} label="Ảnh" />
            <NavItem active={type === 'library' || tab === 'trash'} onClick={() => setType('library')} icon={<Library size={22}/>} label="Thư viện" />
        </div>

        <div className="md:mt-auto">
            <button onClick={() => setShowLogoutModal(true)} className="p-4 text-zinc-500 hover:text-red-500 transition-colors flex items-center gap-4">
                <LogOut size={22}/>
                <span className="hidden lg:block text-xs font-black uppercase italic">Thoát</span>
            </button>
        </div>
      </nav>

      {/* CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="flex-none bg-black/80 backdrop-blur-md px-6 py-5 flex items-center justify-between border-b border-white/5">
          <h2 className="text-xl font-black italic uppercase text-zinc-400 tracking-wider">
            {tab === 'trash' ? 'Thùng rác' : (type === 'video' ? 'Phim' : 'Ảnh')}
          </h2>
          <div className="flex items-center gap-3">
            {tab === 'trash' && media.length > 0 && <button onClick={handleClearTrash} className="bg-red-600/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"><Trash2 size={16}/> Xoá hết</button>}
            <label className={`cursor-pointer ${uploading ? 'bg-zinc-800' : 'bg-white text-black'} px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all hover:scale-105 active:scale-95`}>
              {uploading ? <Loader2 className="animate-spin" size={16}/> : <Plus size={18}/>}
              <span>{uploading ? `${uploadProgress}%` : 'Tải lên'}</span>
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="video/*,image/*" disabled={uploading} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {type === 'library' ? (
            <div className="max-w-2xl mx-auto space-y-4">
              <div onClick={() => {setTab('trash'); setType('video');}} className="flex items-center justify-between p-8 bg-zinc-900/50 rounded-[2.5rem] border border-white/5 cursor-pointer hover:bg-zinc-800 hover:border-red-600/30 transition-all group">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                        <Trash2 size={28}/>
                    </div>
                    <div>
                        <p className="text-lg font-black uppercase italic">Thùng rác</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{media.length} tệp đã xoá</p>
                    </div>
                </div>
                <ChevronRight className="text-zinc-600 group-hover:text-red-500 transition-colors" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
              {media.length === 0 && !isLoading && <div className="col-span-full py-40 text-center opacity-10 uppercase font-black italic text-6xl text-white select-none">Trống trơn</div>}
              {media.map((m) => (
                <div 
                  key={m.id} 
                  onMouseDown={() => touchTimer.current = setTimeout(() => setLongPressedId(m.id), 600)} 
                  onMouseUp={() => clearTimeout(touchTimer.current)} 
                  onTouchStart={() => touchTimer.current = setTimeout(() => setLongPressedId(m.id), 600)} 
                  onTouchEnd={() => clearTimeout(touchTimer.current)} 
                  onClick={(e) => { e.stopPropagation(); setViewing(m); }} 
                  className="relative aspect-[3/4] group cursor-pointer overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 shadow-xl transition-all hover:border-white/20"
                >
                  {m.origin_table === 'private_videos' ? (
                    <video src={`${m.url}#t=0.5`} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="metadata" />
                  ) : (
                    <img src={m.url} className="w-full h-full object-cover" loading="lazy" />
                  )}

                  {/* OVERLAY HOVER/LONGPRESS */}
                  <div className={`absolute inset-0 bg-black/70 backdrop-blur-[3px] flex flex-col items-center justify-center gap-4 z-10 transition-all duration-300 
                    ${longPressedId === m.id ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'}`}>
                    
                    {tab === 'trash' && (
                      <button onClick={(e) => {e.stopPropagation(); handleRestore(m)}} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-transform">
                        <RotateCcw size={22}/>
                      </button>
                    )}
                    
                    <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(m.id, m.url, m.origin_table) : handleMoveToTrash(m)}} className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-transform">
                      <Trash2 size={22}/>
                    </button>
                  </div>

                  {m.origin_table === 'private_videos' && (
                    <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border border-white/10 transition-opacity group-hover:opacity-0">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                      Video
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL ĐĂNG XUẤT */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-xs bg-zinc-900 border border-white/10 p-10 rounded-[3rem] text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="w-20 h-20 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce"><AlertCircle size={40}/></div>
            <h3 className="text-2xl font-black italic uppercase mb-2 tracking-tighter">Đăng xuất?</h3>
            <p className="text-zinc-500 text-xs uppercase font-bold mb-8">Bạn sẽ phải nhập mã lại</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowLogoutModal(false)} className="py-5 bg-zinc-800 rounded-2xl text-[10px] font-black uppercase hover:bg-zinc-700 transition-colors">Huỷ</button>
              <button onClick={handleConfirmLogout} className="py-5 bg-red-600 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all">Đồng ý</button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER MODAL */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300" onMouseMove={handleUserActivity} onClick={handleUserActivity}>
          <header className={`absolute top-0 inset-x-0 z-20 flex justify-between items-start p-6 md:p-10 bg-gradient-to-b from-black/95 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-4 overflow-hidden mr-6">
              <div className="w-1.5 h-10 bg-red-600 rounded-full shrink-0 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
              <h2 className="text-sm md:text-2xl font-black uppercase italic truncate text-zinc-100 tracking-tight">{viewing.name.replace('_trash','')}</h2>
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(viewing.id, viewing.url, viewing.origin_table) : handleMoveToTrash(viewing); setViewing(null);}} className="w-12 h-12 md:w-16 md:h-16 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center transition-all hover:bg-red-600 hover:text-white"><Trash2 size={26}/></button>
              <a href={viewing.url} download className="w-12 h-12 md:w-16 md:h-16 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all text-white border border-white/5"><Download size={26}/></a>
              <button onClick={() => setViewing(null)} className="w-12 h-12 md:w-16 md:h-16 bg-white/5 hover:bg-red-600 rounded-2xl flex items-center justify-center transition-all text-white border border-white/5"><X size={26}/></button>
            </div>
          </header>

          <div ref={playerContainerRef} className="flex-1 flex items-center justify-center relative bg-black overflow-hidden group/player">
            {viewing.origin_table === 'private_images' ? <img src={viewing.url} className="max-h-full max-w-full object-contain shadow-2xl" /> : (
              <>
                <video ref={videoRef} src={viewing.url} autoPlay playsInline preload="auto" crossOrigin="anonymous" className="w-full h-full object-contain" onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)} onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)} onClick={togglePlay} />
                <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-6 md:p-16 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="flex items-center gap-5 mb-8 md:mb-12">
                    <span className="text-[11px] md:text-sm font-black text-zinc-400 w-16 text-right tracking-tighter">{formatTime(currentTime)}</span>
                    <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={handleSeek} className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-600 shadow-inner" />
                    <span className="text-[11px] md:text-sm font-black text-zinc-400 w-16 tracking-tighter">{formatTime(duration)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-6 md:gap-14 text-white">
                      <div className="flex items-center gap-4 md:gap-10">
                        <button onClick={(e) => {e.stopPropagation(); skipTime(-10);}} className="text-zinc-500 hover:text-white transition-all hover:scale-125"><Rewind size={28} /></button>
                        <button onClick={(e) => {e.stopPropagation(); togglePlay();}} className="text-white hover:scale-110 transition-transform bg-white/5 p-4 rounded-full border border-white/10">{isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" />}</button>
                        <button onClick={(e) => {e.stopPropagation(); skipTime(10);}} className="text-zinc-500 hover:text-white transition-all hover:scale-125"><FastForward size={28} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 md:gap-10 text-white">
                      <div className="flex bg-zinc-900/90 rounded-2xl p-1.5 border border-white/10">
                        {[1, 1.5, 2].map(speed => (<button key={speed} onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.playbackRate = speed; setPlaybackRate(speed); }} className={`px-5 py-2 text-[10px] md:text-xs font-black rounded-xl transition-all ${playbackRate === speed ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>{speed}x</button>))}
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); if (playerContainerRef.current) { if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen(); else document.exitFullscreen(); }}} className="text-zinc-400 hover:text-red-500 transition-all hover:scale-110"><Maximize size={26} /></button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        .grid { scrollbar-gutter: stable; }
      `}</style>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col md:flex-row items-center gap-5 p-4 md:p-5 rounded-[1.5rem] transition-all w-full relative group ${active ? 'bg-red-600/10 text-red-500 shadow-[inset_0_0_20px_rgba(220,38,38,0.05)]' : 'text-zinc-600 hover:text-white hover:bg-white/5'}`}>
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
      <span className="text-[10px] md:text-xs font-black uppercase italic lg:block hidden tracking-widest">{label}</span>
      {active && <div className="absolute right-0 w-1.5 h-10 bg-red-600 rounded-l-full hidden lg:block shadow-[0_0_15px_rgba(220,38,38,0.5)]" />}
    </button>
  );
}