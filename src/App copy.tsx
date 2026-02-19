import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Play, Trash2, RotateCcw, UploadCloud, X, Shield, 
  Film, Image as ImageIcon, LogOut, Info, Check, 
  Maximize, Volume2, Pause, ChevronRight, FastForward, Rewind, VolumeX,
  AlertTriangle, Flame, Plus, FolderPlus, Library
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
  collection_id?: string | null;
}

interface Collection {
  id: string;
  name: string;
  created_at: string;
}

export default function CinemaVault() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [type, setType] = useState<'video' | 'image' | 'collection'>('video'); 
  const [tab, setTab] = useState<'main' | 'trash'>('main');
  const [viewing, setViewing] = useState<Media | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // --- STATES VIẾT THÊM ---
  const [confirmModal, setConfirmModal] = useState<{show: boolean, target: Media | 'all' | null}>({ show: false, target: null });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedColId, setSelectedColId] = useState<string | null>(null);

  // --- STATES VIẾT THÊM CHO MOBILE (LONG PRESS) ---
  const [longPressMenu, setLongPressMenu] = useState<{ show: boolean, target: Media | null }>({ show: false, target: null });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  
  // XÁC ĐỊNH BẢNG CHUẨN DỰA TRÊN TYPE ĐỂ FIX LỖI LỌC CHUNG
  const tableName = type === 'image' ? 'private_images' : 'private_videos';

  // --- LOGIC NHẤN GIỮ ---
  const handleTouchStart = (m: Media) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressMenu({ show: true, target: m });
      if (navigator.vibrate) navigator.vibrate(50); 
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // --- LOGIC TẠO THUMBNAIL (GIỮ NGUYÊN) ---
  const generateVideoThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      video.style.display = 'none';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.play();
      video.onloadeddata = () => { video.currentTime = 1; };
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          URL.revokeObjectURL(video.src);
        }, 'image/jpeg', 0.9);
      };
    });
  };

  // --- AUTH LOGIC (GIỮ NGUYÊN) ---
  const handleLogout = useCallback(() => {
    setIsLogged(false);
    localStorage.removeItem('vault_session');
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('vault_session');
    if (session === ACCESS_KEY) setIsLogged(true);
  }, []);

  // --- DATA FETCHING (ĐÃ FIX LỖI LỌC CHUNG) ---
  const fetchCollections = async () => {
    const { data } = await supabase.from('collections').select('*').order('created_at', { ascending: false });
    if (data) setCollections(data);
  };

const fetchMedia = useCallback(async () => {
  if (type === 'collection') return;

  // Xác định bảng dựa trên type hiện tại
  const activeTable = type === 'image' ? 'private_images' : 'private_videos';

  let query = supabase
    .from(activeTable)
    .select('*')
    .eq('is_deleted', tab === 'trash');

  // Lọc theo bộ sưu tập nếu có selectedColId
  if (selectedColId && tab === 'main') {
    query = query.eq('collection_id', selectedColId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error("Lỗi lấy dữ liệu:", error.message);
    return;
  }
  
  if (data) setMedia(data as Media[]);
}, [tab, type, selectedColId]); // tableName đã được tính toán bên trong nên không cần bỏ vào dependency [tab, type, tableName, selectedColId]);

  useEffect(() => {
    if (isLogged) {
      fetchMedia();
      fetchCollections();
    }
  }, [isLogged, fetchMedia, tab, type, selectedColId]);

  // --- COLLECTION LOGIC ---
  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    await supabase.from('collections').insert([{ name: newCollectionName }]);
    setNewCollectionName("");
    setShowAddCollection(false);
    fetchCollections();
  };

  const addToCollection = async (mediaId: string, colId: string | null) => {
    await supabase.from(tableName).update({ collection_id: colId }).eq('id', mediaId);
    fetchMedia();
    if (viewing) setViewing({ ...viewing, collection_id: colId });
  };

  // --- DELETE LOGIC ---
  const executeDelete = async () => {
    const target = confirmModal.target;
    if (!target) return;
    if (target === 'all') {
      for (const item of media) {
        const fileName = item.url.split('/').pop();
        const thumbName = item.thumbnail_url?.split('/').pop();
        if (fileName) await supabase.storage.from('videos').remove([fileName]);
        if (thumbName && thumbName !== fileName) await supabase.storage.from('videos').remove([thumbName]);
      }
      await supabase.from(tableName).delete().eq('is_deleted', true);
    } else {
      const fileName = target.url.split('/').pop();
      const thumbName = target.thumbnail_url?.split('/').pop();
      if (fileName) await supabase.storage.from('videos').remove([fileName]);
      if (thumbName && thumbName !== fileName) await supabase.storage.from('videos').remove([thumbName]);
      await supabase.from(tableName).delete().eq('id', target.id);
    }
    setConfirmModal({ show: false, target: null });
    fetchMedia();
  };

  // --- UPLOAD LOGIC (FIXED: LÀM SẠCH TÊN FILE) ---
  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      try {
        setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));
        await supabase.storage.from('videos').upload(safeName, file);
        const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(safeName);
        let finalThumbnailUrl = publicUrl;
        if (type === 'video' && file.type.startsWith('video/')) {
          try {
            const thumbBlob = await generateVideoThumbnail(file);
            const thumbName = `thumb_${safeName}.jpg`;
            await supabase.storage.from('videos').upload(thumbName, thumbBlob);
            const { data: { publicUrl: thumbUrl } } = supabase.storage.from('videos').getPublicUrl(thumbName);
            finalThumbnailUrl = thumbUrl;
          } catch (tErr) { console.error(tErr); }
        } else {
          finalThumbnailUrl = publicUrl;
        }
        await supabase.from(tableName).insert([{
          name: file.name.split('.')[0],
          url: publicUrl,
          thumbnail_url: finalThumbnailUrl,
          is_deleted: false,
          collection_id: selectedColId
        }]);
      } catch (err) { console.error(err); }
    }
    setUploading(false);
    setUploadProgress(0);
    fetchMedia();
  };

  // --- VIDEO PLAYER LOGIC (GIỮ NGUYÊN) ---
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
      else { videoRef.current.pause(); setIsPlaying(false); }
    }
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) { videoRef.current.currentTime = parseFloat(e.target.value); setCurrentTime(videoRef.current.currentTime); }
  };
  const skipTime = (amount: number) => { if (videoRef.current) videoRef.current.currentTime += amount; };
  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen().catch(err => console.error(err));
    else document.exitFullscreen();
  };
  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000);
  };
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isLogged) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900/40 backdrop-blur-3xl border border-white/5 p-12 rounded-[3rem] shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-600/20">
          <Shield className="text-red-500" size={40} strokeWidth={1.5} />
        </div>
        <h1 className="text-white text-3xl font-bold mb-2 tracking-tight uppercase italic">Cinema Vault</h1>
        <p className="text-zinc-500 text-sm mb-10 tracking-widest">ENCRYPTED STORAGE</p>
        <input 
          type="password" autoFocus placeholder="••••"
          className="w-full bg-black/40 border border-zinc-800 p-5 rounded-2xl mb-6 text-center text-white outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all text-2xl tracking-[1em]"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value === ACCESS_KEY) { setIsLogged(true); localStorage.setItem('vault_session', ACCESS_KEY); }}}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-200 font-sans selection:bg-red-600/30 overflow-x-hidden">
      
      {/* MODAL XÁC NHẬN UI */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmModal({show: false, target: null})} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500"><AlertTriangle size={32} /></div>
            <h2 className="text-white text-2xl font-black mb-3 italic uppercase tracking-tighter">Xác nhận xoá vĩnh viễn?</h2>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">Hành động này sẽ xoá sạch dữ liệu khỏi Database và Storage.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setConfirmModal({show: false, target: null})} className="py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-2xl transition-all">HUỶ BỎ</button>
              <button onClick={executeDelete} className="py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 transition-all uppercase italic">Xoá sạch</button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE CONTEXT MENU (NHẤN GIỮ) */}
      {longPressMenu.show && longPressMenu.target && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLongPressMenu({ show: false, target: null })} />
          <div className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-6 border-b border-white/5 flex items-center gap-4">
               <img src={longPressMenu.target.thumbnail_url || longPressMenu.target.url} className="w-16 h-10 object-cover rounded-lg border border-white/10" alt="" />
               <div className="flex-1 overflow-hidden">
                 <p className="text-white font-bold truncate uppercase italic text-sm">{longPressMenu.target.name}</p>
                 <p className="text-zinc-500 text-[10px] tracking-widest uppercase">Tùy chọn nhanh</p>
               </div>
               <button onClick={() => setLongPressMenu({ show: false, target: null })} className="p-2 text-zinc-500"><X size={20}/></button>
            </div>
            
            <div className="p-2 grid grid-cols-1 gap-1">
              <div className="p-4">
                <p className="text-zinc-500 text-[10px] font-black uppercase mb-3 px-2 tracking-widest">Thêm vào bộ sưu tập</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                   <button onClick={() => { addToCollection(longPressMenu.target!.id, null); setLongPressMenu({ show: false, target: null }); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase border ${!longPressMenu.target.collection_id ? 'bg-white text-black border-white' : 'bg-zinc-800 border-white/5 text-zinc-400'}`}>Mặc định</button>
                   {collections.map(c => (
                     <button key={c.id} onClick={() => { addToCollection(longPressMenu.target!.id, c.id); setLongPressMenu({ show: false, target: null }); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase border ${longPressMenu.target?.collection_id === c.id ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-800 border-white/5 text-red-400'}`}>
                       {c.name}
                     </button>
                   ))}
                </div>
              </div>

              <div className="h-px bg-white/5 mx-4" />

              <button 
                onClick={async () => {
                  if (tab === 'main') {
                    await supabase.from(tableName).update({ is_deleted: true }).eq('id', longPressMenu.target!.id);
                    fetchMedia();
                  } else {
                    setConfirmModal({ show: true, target: longPressMenu.target! });
                  }
                  setLongPressMenu({ show: false, target: null });
                }}
                className="flex items-center gap-4 p-4 w-full text-left hover:bg-red-600/10 transition-colors group"
              >
                <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <Trash2 size={18} />
                </div>
                <div>
                  <p className="text-red-500 font-bold text-sm uppercase italic">Xóa mục này</p>
                  <p className="text-zinc-600 text-[10px]">{tab === 'main' ? 'Chuyển vào thùng rác' : 'Xóa vĩnh viễn khỏi mây'}</p>
                </div>
              </button>
            </div>
            <div className="h-6 sm:hidden" />
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 md:w-24 bg-black/50 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-8 gap-8 z-[60] max-sm:w-full max-sm:h-16 max-sm:flex-row max-sm:bottom-0 max-sm:top-auto max-sm:border-r-0 max-sm:border-t max-sm:justify-around max-sm:py-0">

        <div className="flex flex-col gap-6 flex-1 max-sm:flex-row max-sm:gap-2">
          {/* NÚT PHIM: Reset bộ sưu tập về trang chính khi nhấn */}
          <button onClick={() => { setType('video'); setTab('main'); setSelectedColId(null); }} className={`p-4 rounded-2xl transition-all ${type === 'video' && tab === 'main' && !selectedColId ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.4)]' : 'text-zinc-600 hover:text-zinc-300'}`}><Film size={22} /></button>
          
          {/* NÚT ẢNH: Reset bộ sưu tập về trang chính khi nhấn */}
          <button onClick={() => { setType('image'); setTab('main'); setSelectedColId(null); }} className={`p-4 rounded-2xl transition-all ${type === 'image' && tab === 'main' && !selectedColId ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.4)]' : 'text-zinc-600 hover:text-zinc-300'}`}><ImageIcon size={22} /></button>
          
          <button onClick={() => setType('collection')} className={`p-4 rounded-2xl transition-all ${type === 'collection' ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.4)]' : 'text-zinc-600 hover:text-zinc-300'}`}><Library size={22} /></button>

          <div className="h-px w-8 bg-zinc-800 my-2 mx-auto max-sm:hidden" />
          <button onClick={() => { setTab('trash'); setType('video'); setSelectedColId(null); }} className={`p-4 rounded-2xl transition-all ${tab === 'trash' ? 'bg-zinc-800 text-red-500' : 'text-zinc-600 hover:text-zinc-300'}`}><Trash2 size={22} /></button>
        </div>
        <button onClick={handleLogout} className="p-4 text-zinc-600 hover:text-red-500 transition-colors"><LogOut size={22} /></button>
      </nav>

      <main className="pl-20 md:pl-24 max-sm:pl-0 max-sm:pb-24">
        
        {type === 'collection' ? (
          <div className="p-12 animate-in fade-in duration-500">
             <div className="flex items-center justify-between mb-12">
                <h3 className="text-4xl font-black italic uppercase tracking-tighter">Bộ sưu tập</h3>
                <button onClick={() => setShowAddCollection(!showAddCollection)} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl hover:border-red-600 transition-all font-black text-xs uppercase tracking-widest">
                  <FolderPlus size={18}/> {showAddCollection ? 'Huỷ' : 'Tạo mới'}
                </button>
             </div>

             {showAddCollection && (
               <div className="mb-12 flex gap-4 animate-in slide-in-from-top duration-300">
                  <input type="text" placeholder="Tên bộ sưu tập..." value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex-1 outline-none focus:border-red-600 text-white font-bold"/>
                  <button onClick={createCollection} className="bg-red-600 px-10 rounded-2xl font-black uppercase text-sm">Lưu</button>
               </div>
             )}

             <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {collections.map(col => (
                  <div key={col.id} onClick={() => { setSelectedColId(col.id); setType('video'); }} className="aspect-square bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-red-600 cursor-pointer group transition-all relative overflow-hidden">
                    <Library size={48} className="text-zinc-700 group-hover:text-red-600 transition-colors" />
                    <span className="font-black uppercase tracking-tighter text-lg px-4 text-center truncate w-full">{col.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); supabase.from('collections').delete().eq('id', col.id).then(() => fetchCollections()); }} className="absolute top-4 right-4 p-2 text-zinc-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <>
            {/* HERO SECTION */}
            {media.length > 0 && tab === 'main' && !selectedColId && (
              <div className="relative h-[50vh] md:h-[70vh] w-full overflow-hidden group">
                <img src={media[0].thumbnail_url} className="w-full h-full object-cover scale-105 blur-[2px] opacity-40 transition-all duration-[2000ms] group-hover:scale-100 group-hover:blur-0 group-hover:opacity-60" alt="featured" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-black/20" />
                <div className="absolute bottom-10 left-6 md:bottom-20 md:left-12 max-w-3xl animate-in slide-in-from-left duration-700">
                  <div className="flex items-center gap-2 mb-2 md:mb-4"><span className="bg-red-600 text-[8px] md:text-[10px] font-black px-2 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-[0.2em]">New Release</span></div>
                  <h2 className="text-4xl md:text-7xl font-black mb-4 md:mb-6 tracking-tighter uppercase leading-[0.9] italic drop-shadow-2xl">{media[0].name}</h2>
                  <button onClick={() => { setViewing(media[0]); setIsPlaying(true); }} className="bg-white text-black px-6 py-3 md:px-10 md:py-4 rounded-xl md:rounded-2xl font-black flex items-center gap-2 md:gap-3 hover:bg-red-600 hover:text-white transition-all scale-100 active:scale-95 text-xs md:text-base"><Play size={20} fill="currentColor" /> {type === 'video' ? 'PHÁT NGAY' : 'XEM ẢNH'}</button>
                </div>
              </div>
            )}

            <div className="p-6 md:p-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-4">
                <div className="flex items-center gap-6">
                  {/* TIÊU ĐỀ THAY ĐỔI THEO SELECTED COLLECTION VÀ TYPE */}
                  <h3 className="text-2xl md:text-4xl font-black tracking-tighter italic uppercase flex items-center gap-2">
                    {tab === 'main' ? (selectedColId ? `${collections.find(c => c.id === selectedColId)?.name} (${type === 'video' ? 'Phim' : 'Ảnh'})` : `Thư viện ${type === 'video' ? 'Phim' : 'Ảnh'}`) : 'Thùng rác'}
                    <ChevronRight className="text-red-600" size={24} />
                  </h3>
                  <span className="text-zinc-600 font-bold text-[10px] md:text-sm tracking-[0.3em] mt-1">[{media.length}]</span>
                  {tab === 'trash' && media.length > 0 && (<button onClick={() => setConfirmModal({show: true, target: 'all'})} className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic"><Flame size={14} /> Dọn sạch rác</button>)}
                </div>
                <label className="cursor-pointer bg-zinc-900 border border-zinc-800 px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-[1.5rem] hover:border-red-600 transition-all active:scale-95 text-center">
                  <div className="flex items-center justify-center gap-3 font-black text-[10px] md:text-xs uppercase tracking-widest">{uploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" /> : <UploadCloud size={18} />}{uploading ? `Đang tải ${uploadProgress}%` : 'Upload Media'}</div>
                  <input type="file" className="hidden" multiple onChange={handleMultipleUpload} disabled={uploading} />
                </label>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-10">
                {media.map(m => (
                  <div 
                    key={m.id} 
                    className="group relative flex flex-col gap-3 touch-none"
                    onTouchStart={() => handleTouchStart(m)}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => { e.preventDefault(); setLongPressMenu({ show: true, target: m }); }}
                  >
                    <div className="relative aspect-video rounded-xl md:rounded-[2rem] overflow-hidden bg-zinc-900 border border-white/5 group-hover:border-red-600 transition-all duration-500 shadow-xl">
                      <img src={m.thumbnail_url || m.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700" alt="" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"><button onClick={() => { setViewing(m); setIsPlaying(true); }} className="w-10 h-10 md:w-16 md:h-16 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform"><Play size={24} fill="currentColor" className="ml-1" /></button></div>
                      <button onClick={async () => { if (tab === 'main') { await supabase.from(tableName).update({ is_deleted: true }).eq('id', m.id); fetchMedia(); } else { setConfirmModal({ show: true, target: m }); } }} className="absolute top-2 right-2 p-2 bg-black/60 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 max-sm:hidden">{tab === 'main' ? <Trash2 size={16} /> : <X size={16} />}</button>
                      {tab === 'trash' && (<button onClick={async () => { await supabase.from(tableName).update({ is_deleted: false }).eq('id', m.id); fetchMedia(); }} className="absolute top-2 right-12 p-2 bg-black/60 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-600 max-sm:hidden"><RotateCcw size={16} /></button>)}
                    </div>
                    <h4 className="font-bold text-zinc-400 truncate text-[10px] md:text-xs uppercase tracking-widest px-1">{m.name}</h4>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* PLAYER MODAL (Đã sửa lỗi tiêu đề quá dài làm ẩn nút tắt) */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300" onMouseMove={handleUserActivity} onClick={handleUserActivity}>
          <div className={`absolute top-0 inset-x-0 z-20 flex justify-between items-start p-4 md:p-8 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col gap-2 flex-1 min-w-0 pr-4"> {/* Thêm flex-1 và min-w-0 để tiêu đề không đẩy nút X */}
               <div className="flex items-center gap-3">
                 <div className="w-1 h-6 md:h-10 bg-red-600 rounded-full flex-shrink-0" />
                 <h2 className="text-lg md:text-3xl font-black uppercase tracking-tighter italic truncate"> {/* Thêm truncate */}
                   {viewing.name}
                 </h2>
               </div>
               
               {/* THANH CHỌN BỘ SƯU TẬP TRONG PLAYER */}
               <div className="flex gap-2 overflow-x-auto max-w-sm no-scrollbar pb-2">
                  <button onClick={() => addToCollection(viewing.id, null)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${!viewing.collection_id ? 'bg-white text-black border-white' : 'border-white/20 text-white/40 hover:border-white hover:text-white'}`}>Mặc định</button>
                  {collections.map(c => (
                    <button key={c.id} onClick={() => addToCollection(viewing.id, c.id)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${viewing.collection_id === c.id ? 'bg-red-600 border-red-600 text-white' : 'border-white/20 text-white/40 hover:border-white hover:text-white'}`}>{c.name}</button>
                  ))}
               </div>
            </div>
            {/* Nút X thêm flex-shrink-0 để luôn giữ kích thước */}
            <button onClick={() => setViewing(null)} className="w-10 h-10 md:w-14 md:h-14 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center transition-all self-start flex-shrink-0">
              <X size={24} />
            </button>
          </div>
          
          <div ref={playerContainerRef} className="flex-1 flex items-center justify-center relative bg-black overflow-hidden group/player">
            {type === 'image' || viewing.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <div className="relative max-w-full max-h-full flex flex-col items-center justify-center p-4">
                <img src={viewing.url} className="rounded-[2.5rem] shadow-2xl object-contain max-h-[85vh] max-w-full border border-white/5 animate-in zoom-in duration-500" alt={viewing.name} />
                <div className={`mt-8 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}><a href={viewing.url} download className="bg-red-600 px-10 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-110 active:scale-90 transition-all">DOWNLOAD IMAGE</a></div>
              </div>
            ) : (
              <>
                <video ref={videoRef} src={viewing.url} autoPlay playsInline preload="auto" crossOrigin="anonymous" className="w-full h-full object-contain" onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }} onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }} onClick={togglePlay} />
                <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 md:p-12 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="flex items-center gap-4 mb-6 md:mb-10">
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12 text-right">{formatTime(currentTime)}</span>
                    <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={handleSeek} className="flex-1 h-1 md:h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-600" />
                    <span className="text-[10px] md:text-xs font-mono text-zinc-400 w-12">{formatTime(duration)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-10">
                      <div className="flex items-center gap-2 md:gap-6">
                        <button onClick={() => skipTime(-10)} className="text-zinc-400 hover:text-white transition-colors"><Rewind size={24} /></button>
                        <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">{isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}</button>
                        <button onClick={() => skipTime(10)} className="text-zinc-400 hover:text-white transition-colors"><FastForward size={24} /></button>
                      </div>
                      <div className="hidden md:flex items-center gap-3 group/vol">
                        <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white">{isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
                        <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={(e) => { const val = parseFloat(e.target.value); setVolume(val); if (videoRef.current) videoRef.current.volume = val; }} className="w-0 group-hover/vol:w-20 transition-all appearance-none bg-zinc-700 h-1 rounded-full accent-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8">
                      <div className="flex bg-zinc-900/80 rounded-lg md:rounded-xl p-1 border border-white/5">
                        {[1, 1.5, 2].map(speed => (<button key={speed} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = speed; setPlaybackRate(speed); }} className={`px-3 py-1 md:px-4 md:py-1.5 text-[9px] md:text-[11px] font-black rounded-md transition-all ${playbackRate === speed ? 'bg-red-600 text-white' : 'text-zinc-500'}`}>{speed}x</button>))}
                      </div>
                      <button onClick={toggleFullScreen} className="text-zinc-400 hover:text-white transition-colors"><Maximize size={22} /></button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CSS STYLE VIẾT THÊM */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}