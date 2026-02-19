import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Play, Trash2, RotateCcw, UploadCloud, X, Shield, 
  Film, Image as ImageIcon, LogOut, Check, 
  Maximize, Volume2, Pause, ChevronRight, FastForward, Rewind, VolumeX,
  AlertTriangle, Flame, Plus, FolderPlus, Library, Download, CheckCircle2, EyeOff, Eye
} from 'lucide-react';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';
const ACCESS_KEY = '2400H';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function CinemaVault() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [media, setMedia] = useState<any[]>([]);
  const [type, setType] = useState<'video' | 'image' | 'library'>('video'); 
  const [tab, setTab] = useState<'main' | 'trash' | 'collection'>('main');
  const [viewing, setViewing] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- LONG PRESS STATE ---
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const touchTimer = useRef<any>(null);

  // --- GIỮ NGUYÊN TOÀN BỘ PLAYER STATES CŨ ---
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

  // Hàm kiểm tra định dạng tệp để phân loại (SỬA LỖI NẰM CHUNG)
  const isVideoFile = (url: string) => url?.match(/\.(mp4|webm|ogg|mov|m4v)$/i);
  const isImageFile = (url: string) => url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  // --- LOGIC DỮ LIỆU ---
  const fetchMedia = useCallback(async () => {
    if (type === 'library') return;
    const activeTable = type === 'image' ? 'private_images' : 'private_videos';

    const { data, error } = await supabase.from(activeTable)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return;

    if (data) {
      const filtered = data.filter((item: any) => {
        let statusMatch = false;
        if (tab === 'trash') statusMatch = item.is_deleted === true;
        else if (tab === 'collection') statusMatch = item.is_archived === true && !item.is_deleted;
        else statusMatch = !item.is_deleted && item.is_archived !== true;

        if (!statusMatch) return false;
        if (type === 'video') return isVideoFile(item.url);
        if (type === 'image') return isImageFile(item.url);
        return true;
      });
      setMedia(filtered);
    }
  }, [tab, type]);

  useEffect(() => {
    if (isLogged) fetchMedia();
  }, [isLogged, fetchMedia, type, tab]);

  // --- ACTIONS ---
  const handleToggleArchive = async (id: string, currentStatus: boolean) => {
    const activeTable = type === 'image' ? 'private_images' : 'private_videos';
    await supabase.from(activeTable).update({ is_archived: !currentStatus }).eq('id', id);
    setLongPressedId(null);
    fetchMedia();
  };

  const handleMoveToTrash = async (id: string) => {
    const activeTable = type === 'image' ? 'private_images' : 'private_videos';
    await supabase.from(activeTable).update({ is_deleted: true }).eq('id', id);
    setLongPressedId(null);
    fetchMedia();
  };

  const handlePermanentDelete = async (id: string) => {
    const activeTable = type === 'image' ? 'private_images' : 'private_videos';
    if (confirm("Xoá vĩnh viễn mục này?")) {
      await supabase.from(activeTable).delete().eq('id', id);
      setLongPressedId(null);
      fetchMedia();
    }
  };

  // --- GIỮ NGUYÊN LOGIC PLAYER CŨ ---
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
      else { videoRef.current.pause(); setIsPlaying(false); }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      videoRef.current.currentTime = parseFloat(e.target.value);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const skipTime = (amount: number) => {
    if (videoRef.current) videoRef.current.currentTime += amount;
  };

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLogout = () => {
    setIsLogged(false);
    localStorage.removeItem('vault_session');
  };

  if (!isLogged) return (
    <div className="h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/5 p-10 rounded-[3rem] text-center shadow-2xl">
        <Shield className="text-red-600 mx-auto mb-6" size={48} />
        <h1 className="text-white text-2xl font-black italic uppercase mb-8">Cinema Vault</h1>
        <input 
          type="password" autoFocus placeholder="••••"
          className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-center text-white text-2xl tracking-[0.5em] outline-none focus:border-red-600 transition-all"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as any).value === ACCESS_KEY) setIsLogged(true); }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col md:flex-row font-sans overflow-hidden" onClick={() => setLongPressedId(null)}>
      
      <nav className="fixed bottom-0 left-0 w-full h-16 bg-zinc-900/95 backdrop-blur-2xl border-t border-white/5 flex flex-row items-center justify-around z-[60] 
                      md:relative md:w-20 lg:w-64 md:h-screen md:flex-col md:border-t-0 md:border-r md:bg-black md:px-4 md:py-8">
        <div className="hidden md:flex items-center gap-3 px-4 mb-10 w-full">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/40"><Shield size={18}/></div>
          <span className="text-xl font-black italic tracking-tighter lg:block hidden uppercase">VAULT</span>
        </div>
        <div className="flex flex-row md:flex-col gap-1 md:gap-2 w-full flex-1 items-center md:items-start">
          <NavItem active={type === 'video' && tab === 'main'} onClick={() => {setType('video'); setTab('main');}} icon={<Film size={22}/>} label="Phim" />
          <NavItem active={type === 'image' && tab === 'main'} onClick={() => {setType('image'); setTab('main');}} icon={<ImageIcon size={22}/>} label="Ảnh" />
          <NavItem active={type === 'library' || tab === 'trash' || tab === 'collection'} onClick={() => setType('library')} icon={<Library size={22}/>} label="Thư viện" />
          <button onClick={handleLogout} className="flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 rounded-2xl transition-all w-full text-zinc-500 hover:text-red-500">
            <LogOut size={22} /><span className="text-[9px] md:text-xs font-black uppercase italic lg:block hidden tracking-tighter">Thoát</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 h-screen overflow-y-auto pb-20 md:pb-0">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-white/5">
          <h2 className="text-xl font-black italic uppercase tracking-widest text-zinc-400">
            {tab === 'trash' ? 'Thùng rác' : tab === 'collection' ? 'Bộ sưu tập' : (type === 'library' ? 'Tiện ích' : (type === 'video' ? 'Phim' : 'Ảnh'))}
          </h2>
          <label className="cursor-pointer bg-white text-black px-5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2">
            <Plus size={18}/> <span>Tải lên</span>
            <input type="file" multiple className="hidden" />
          </label>
        </header>

        <div className="p-2 md:p-6">
          {type === 'library' ? (
            <div className="max-w-xl mx-auto space-y-3">
              <div onClick={() => {setTab('collection'); setType('video');}} className="flex items-center justify-between p-6 bg-zinc-900 rounded-[2rem] border border-white/5 hover:bg-zinc-800 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500"><FolderPlus/></div>
                  <div><p className="font-black uppercase italic">Bộ sưu tập</p></div>
                </div>
                <ChevronRight className="text-zinc-700"/>
              </div>
              <div onClick={() => {setTab('trash'); setType('video');}} className="flex items-center justify-between p-6 bg-zinc-900 rounded-[2rem] border border-white/5 hover:bg-zinc-800 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-500"><Trash2/></div>
                  <div><p className="font-black uppercase italic">Thùng rác</p></div>
                </div>
                <ChevronRight className="text-zinc-700"/>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-2">
              {media.map((m) => (
                <div 
                  key={m.id}
                  onMouseDown={() => { touchTimer.current = setTimeout(() => setLongPressedId(m.id), 600); }}
                  onMouseUp={() => clearTimeout(touchTimer.current)}
                  onTouchStart={() => { touchTimer.current = setTimeout(() => setLongPressedId(m.id), 600); }}
                  onTouchEnd={() => clearTimeout(touchTimer.current)}
                  onClick={(e) => { e.stopPropagation(); setViewing(m); }}
                  className="relative aspect-square group cursor-pointer overflow-hidden rounded-lg bg-zinc-900"
                >
                  <img src={m.thumbnail_url || m.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {longPressedId === m.id && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 animate-in fade-in zoom-in-95">
                      <button onClick={(e) => {e.stopPropagation(); handleToggleArchive(m.id, m.is_archived)}} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                        {m.is_archived ? <Eye size={20}/> : <EyeOff size={20}/>}
                      </button>
                      <button onClick={(e) => {e.stopPropagation(); tab === 'trash' ? handlePermanentDelete(m.id) : handleMoveToTrash(m.id)}} className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                        <Trash2 size={20}/>
                      </button>
                    </div>
                  )}
                  {isVideoFile(m.url) && (
                    <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Play size={8} fill="currentColor"/> Video
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in" onMouseMove={handleUserActivity} onClick={handleUserActivity}>
          <header className={`absolute top-0 inset-x-0 z-20 flex justify-between items-start p-4 md:p-8 bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-3 overflow-hidden mr-4">
              <div className="w-1 h-8 bg-red-600 rounded-full shrink-0" />
              <h2 className="text-xs md:text-xl font-black uppercase italic truncate max-w-[120px] sm:max-w-[200px] md:max-w-xl text-zinc-100">{viewing.name}</h2>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={(e) => {e.stopPropagation(); handleMoveToTrash(viewing.id); setViewing(null);}} className="w-10 h-10 md:w-14 md:h-14 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all"><Trash2 size={20}/></button>
              <a href={viewing.url} download className="w-10 h-10 md:w-14 md:h-14 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"><Download size={22}/></a>
              <button onClick={() => setViewing(null)} className="w-10 h-10 md:w-14 md:h-14 bg-white/10 hover:bg-red-600 rounded-xl flex items-center justify-center transition-all"><X size={22}/></button>
            </div>
          </header>

          <div ref={playerContainerRef} className="flex-1 flex items-center justify-center relative bg-black overflow-hidden group/player">
            {!isVideoFile(viewing.url) ? (
              <img src={viewing.url} className="max-h-full max-w-full object-contain" alt="" />
            ) : (
              <>
                <video 
                  ref={videoRef} src={viewing.url} autoPlay playsInline preload="auto" crossOrigin="anonymous" 
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
                  onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
                  onClick={togglePlay}
                />
                
                <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 md:p-12 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="flex items-center gap-4 mb-6 md:mb-10">
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12 text-right">{formatTime(currentTime)}</span>
                    <input 
                      type="range" min="0" max={duration || 0} step="0.1" value={currentTime} 
                      onChange={handleSeek} 
                      className="flex-1 h-1 md:h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-600" 
                    />
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12">{formatTime(duration)}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-10">
                      <div className="flex items-center gap-2 md:gap-6">
                        <button onClick={(e) => {e.stopPropagation(); skipTime(-10);}} className="text-zinc-400 hover:text-white transition-colors"><Rewind size={24} /></button>
                        <button onClick={(e) => {e.stopPropagation(); togglePlay();}} className="text-white hover:scale-110 transition-transform">
                          {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
                        </button>
                        <button onClick={(e) => {e.stopPropagation(); skipTime(10);}} className="text-zinc-400 hover:text-white transition-colors"><FastForward size={24} /></button>
                      </div>

                      <div className="hidden md:flex items-center gap-3 group/vol">
                        <button onClick={(e) => {e.stopPropagation(); setIsMuted(!isMuted);}} className="text-zinc-400 hover:text-white">
                          {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input 
                          type="range" min="0" max="1" step="0.1" 
                          value={isMuted ? 0 : volume} 
                          onChange={(e) => { 
                            const val = parseFloat(e.target.value); 
                            setVolume(val); 
                            if (videoRef.current) videoRef.current.volume = val; 
                          }} 
                          className="w-0 group-hover/vol:w-20 transition-all appearance-none bg-zinc-700 h-1 rounded-full accent-white" 
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-8">
                      <div className="flex bg-zinc-900/80 rounded-lg md:rounded-xl p-1 border border-white/5">
                        {[1, 1.5, 2].map(speed => (
                          <button 
                            key={speed} 
                            onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.playbackRate = speed; setPlaybackRate(speed); }} 
                            className={`px-3 py-1 md:px-4 md:py-1.5 text-[9px] md:text-[11px] font-black rounded-md transition-all ${playbackRate === speed ? 'bg-red-600 text-white' : 'text-zinc-500'}`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); toggleFullScreen();}} className="text-zinc-400 hover:text-white transition-colors"><Maximize size={22} /></button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}</style>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 rounded-2xl transition-all w-full relative 
                 ${active ? 'bg-red-600/10 text-red-500' : 'text-zinc-600 hover:text-white'}`}
    >
      <div className={`${active ? 'scale-110' : ''}`}>{icon}</div>
      <span className="text-[9px] md:text-xs font-black uppercase italic lg:block hidden tracking-tighter">{label}</span>
      {active && <div className="absolute right-0 w-1 h-8 bg-red-600 rounded-l-full hidden lg:block" />}
      {active && <div className="absolute bottom-1 w-1 h-1 bg-red-600 rounded-full md:hidden" />}
    </button>
  );
}