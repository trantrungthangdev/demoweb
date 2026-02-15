import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Play, Trash2, RotateCcw, UploadCloud, X, Shield, 
  Film, Image as ImageIcon, LogOut, Info, Check, 
  Maximize, Volume2, Pause, ChevronRight, FastForward, Rewind, VolumeX
} from 'lucide-react';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';
const ACCESS_KEY = '2400H';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Media {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string;
  is_deleted: boolean;
  created_at?: string;
}

export default function CinemaVault() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [type, setType] = useState<'video' | 'image'>('video');
  const [tab, setTab] = useState<'main' | 'trash'>('main');
  const [viewing, setViewing] = useState<Media | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // --- VIDEO PLAYER STATES ---
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableName = type === 'video' ? 'private_videos' : 'private_images';

  // --- AUTH LOGIC ---
  const handleLogout = useCallback(() => {
    setIsLogged(false);
    localStorage.removeItem('vault_session');
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('vault_session');
    if (session === ACCESS_KEY) setIsLogged(true);
  }, []);

  // --- DATA FETCHING ---
  const fetchMedia = useCallback(async () => {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('is_deleted', tab === 'trash')
      .order('created_at', { ascending: false });
    if (data) setMedia(data as Media[]);
  }, [tab, type, tableName]);

  useEffect(() => {
    if (isLogged) fetchMedia();
  }, [isLogged, fetchMedia]);

  // --- VIDEO CONTROLS LOGIC ---
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
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

  // --- KEYBOARD & GLOBAL EVENTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewing) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') skipTime(10);
      if (e.code === 'ArrowLeft') skipTime(-10);
      if (e.code === 'Escape') setViewing(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewing, isPlaying]);

  // --- COMPONENT RENDER ---
  if (!isLogged) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900/40 backdrop-blur-3xl border border-white/5 p-12 rounded-[3rem] shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-600/20">
          <Shield className="text-red-500" size={40} strokeWidth={1.5} />
        </div>
        <h1 className="text-white text-3xl font-bold mb-2 tracking-tight uppercase italic">Cinema Vault</h1>
        <p className="text-zinc-500 text-sm mb-10 tracking-widest">ENCRYPTED STORAGE</p>
        <input 
          type="password" autoFocus
          placeholder="••••"
          className="w-full bg-black/40 border border-zinc-800 p-5 rounded-2xl mb-6 text-center text-white outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all text-2xl tracking-[1em]"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value === ACCESS_KEY) {
            setIsLogged(true);
            localStorage.setItem('vault_session', ACCESS_KEY);
          }}}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-200 font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* SIDEBAR NAVIGATION - Hidden on very small screens, visible as bottom bar or side */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 md:w-24 bg-black/50 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-8 gap-8 z-[60] max-sm:w-full max-sm:h-16 max-sm:flex-row max-sm:bottom-0 max-sm:top-auto max-sm:border-r-0 max-sm:border-t max-sm:justify-around max-sm:px-4 max-sm:py-0">
        <div className="text-red-600 mb-4 cursor-pointer hover:scale-110 transition-transform max-sm:mb-0">
          <Film size={28} />
        </div>
        
        <div className="flex flex-col gap-6 flex-1 max-sm:flex-row max-sm:gap-2">
          <button onClick={() => setType('video')} className={`p-4 rounded-2xl transition-all ${type === 'video' ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.4)]' : 'text-zinc-600 hover:text-zinc-300'}`}>
            <Film size={22} />
          </button>
          <button onClick={() => setType('image')} className={`p-4 rounded-2xl transition-all ${type === 'image' ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.4)]' : 'text-zinc-600 hover:text-zinc-300'}`}>
            <ImageIcon size={22} />
          </button>
          <div className="h-px w-8 bg-zinc-800 my-2 mx-auto max-sm:hidden" />
          <button onClick={() => setTab('trash')} className={`p-4 rounded-2xl transition-all ${tab === 'trash' ? 'bg-zinc-800 text-red-500' : 'text-zinc-600 hover:text-zinc-300'}`}>
            <Trash2 size={22} />
          </button>
        </div>

        <button onClick={handleLogout} className="p-4 text-zinc-600 hover:text-red-500 transition-colors">
          <LogOut size={22} />
        </button>
      </nav>

      <main className="pl-20 md:pl-24 max-sm:pl-0 max-sm:pb-20">
        {/* HERO SECTION */}
        {media.length > 0 && tab === 'main' && (
          <div className="relative h-[50vh] md:h-[70vh] w-full overflow-hidden group">
            <img 
              src={media[0].thumbnail_url} 
              className="w-full h-full object-cover scale-105 blur-[2px] opacity-40 transition-all duration-[2000ms] group-hover:scale-100 group-hover:blur-0 group-hover:opacity-60" 
              alt="featured" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-black/20" />
            <div className="absolute bottom-10 left-6 md:bottom-20 md:left-12 max-w-3xl animate-in slide-in-from-left duration-700">
              <div className="flex items-center gap-2 mb-2 md:mb-4">
                <span className="bg-red-600 text-[8px] md:text-[10px] font-black px-2 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-[0.2em]">New Release</span>
              </div>
              <h2 className="text-4xl md:text-7xl font-black mb-4 md:mb-6 tracking-tighter uppercase leading-[0.9] italic drop-shadow-2xl">{media[0].name}</h2>
              <div className="flex gap-3 md:gap-4">
                <button onClick={() => { setViewing(media[0]); setIsPlaying(true); }} className="bg-white text-black px-6 py-3 md:px-10 md:py-4 rounded-xl md:rounded-2xl font-black flex items-center gap-2 md:gap-3 hover:bg-red-600 hover:text-white transition-all scale-100 active:scale-95 text-xs md:text-base">
                  <Play size={20} fill="currentColor" /> PHÁT NGAY
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT GRID */}
        <div className="p-6 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl md:text-4xl font-black tracking-tighter italic uppercase flex items-center gap-2">
                {tab === 'main' ? `Thư viện ${type}` : 'Thùng rác'}
                <ChevronRight className="text-red-600" size={24} />
              </h3>
              <span className="text-zinc-600 font-bold text-[10px] md:text-sm tracking-[0.3em] mt-1">[{media.length}]</span>
            </div>
            
            <label className="cursor-pointer bg-zinc-900 border border-zinc-800 px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-[1.5rem] hover:border-red-600 transition-all active:scale-95 text-center">
              <div className="flex items-center justify-center gap-3 font-black text-[10px] md:text-xs uppercase tracking-widest">
                {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" /> : <UploadCloud size={18} />}
                {uploading ? `Đang tải ${uploadProgress}%` : 'Upload Media'}
              </div>
              <input type="file" className="hidden" multiple disabled={uploading} />
            </label>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-10">
            {media.map(m => (
              <div key={m.id} className="group relative flex flex-col gap-3">
                <div className="relative aspect-video rounded-xl md:rounded-[2rem] overflow-hidden bg-zinc-900 border border-white/5 group-hover:border-red-600 transition-all duration-500 shadow-xl">
                  <img src={m.thumbnail_url || m.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700" alt="" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <button onClick={() => { setViewing(m); setIsPlaying(true); }} className="w-10 h-10 md:w-16 md:h-16 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                      <Play size={24} fill="currentColor" className="ml-1" />
                    </button>
                  </div>
                </div>
                <h4 className="font-bold text-zinc-400 truncate text-[10px] md:text-xs uppercase tracking-widest px-1">{m.name}</h4>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ENHANCED CINEMA PLAYER */}
      {viewing && (
        <div 
          className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300"
          onMouseMove={handleUserActivity}
          onClick={handleUserActivity}
        >
          {/* HEADER */}
          <div className={`absolute top-0 inset-x-0 z-10 flex justify-between items-center p-4 md:p-8 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-3">
               <div className="w-1 h-6 md:h-10 bg-red-600 rounded-full" />
               <h2 className="text-lg md:text-3xl font-black uppercase tracking-tighter italic">{viewing.name}</h2>
            </div>
            <button onClick={() => setViewing(null)} className="w-10 h-10 md:w-14 md:h-14 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center transition-all">
              <X size={24} />
            </button>
          </div>
          
          {/* PLAYER CONTENT */}
          <div ref={playerContainerRef} className="flex-1 flex items-center justify-center relative bg-black group/player overflow-hidden">
            {type === 'video' ? (
              <>
                <video 
                  ref={videoRef}
                  src={viewing.url} 
                  autoPlay 
                  playsInline
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setDuration(videoRef.current.duration);
                  }}
                  onClick={togglePlay}
                />

                {/* DOUBLE TAP OVERLAYS (Invisible targets) */}
                <div className="absolute inset-y-0 left-0 w-1/4 z-0" onDoubleClick={() => skipTime(-10)} />
                <div className="absolute inset-y-0 right-0 w-1/4 z-0" onDoubleClick={() => skipTime(10)} />

                {/* CONTROLS UI */}
                <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 md:p-12 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  
                  {/* PROGRESS BAR */}
                  <div className="flex items-center gap-4 mb-6 md:mb-10">
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12 text-right">{formatTime(currentTime)}</span>
                    <input 
                      type="range" min="0" max={duration || 0} step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 h-1 md:h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-600"
                    />
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12">{formatTime(duration)}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-10">
                      <div className="flex items-center gap-2 md:gap-6">
                        <button onClick={() => skipTime(-10)} className="text-zinc-400 hover:text-white transition-colors"><Rewind size={24} /></button>
                        <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                          {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
                        </button>
                        <button onClick={() => skipTime(10)} className="text-zinc-400 hover:text-white transition-colors"><FastForward size={24} /></button>
                      </div>
                      
                      {/* VOLUME - Desktop only mostly */}
                      <div className="hidden md:flex items-center gap-3 group/vol">
                        <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white">
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
                      {/* SPEED */}
                      <div className="flex bg-zinc-900/80 rounded-lg md:rounded-xl p-1 border border-white/5">
                         {[1, 1.5, 2].map(speed => (
                           <button 
                             key={speed}
                             onClick={() => { if (videoRef.current) videoRef.current.playbackRate = speed; setPlaybackRate(speed); }}
                             className={`px-3 py-1 md:px-4 md:py-1.5 text-[9px] md:text-[11px] font-black rounded-md transition-all ${playbackRate === speed ? 'bg-red-600 text-white' : 'text-zinc-500'}`}
                           >
                             {speed}x
                           </button>
                         ))}
                      </div>

                      <button onClick={toggleFullScreen} className="text-zinc-400 hover:text-white transition-colors">
                        <Maximize size={22} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <img src={viewing.url} className="max-w-full max-h-screen object-contain p-4" alt="" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}