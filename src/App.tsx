import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Play, Trash2, RotateCcw, UploadCloud, X, Shield, Film, Check, Image as ImageIcon } from 'lucide-react';

const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';
const ACCESS_KEY = '2400H';
const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 phút (tính bằng miligiây)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Media {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string;
  is_deleted: boolean;
}

export default function App() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [type, setType] = useState<'video' | 'image'>('video');
  const [tab, setTab] = useState<'main' | 'trash'>('main');
  const [viewing, setViewing] = useState<Media | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  const tableName = type === 'video' ? 'private_videos' : 'private_images';
  const channelRef = useRef<any>(null);

  // --- HÀM ĐĂNG XUẤT ---
  const handleLogout = useCallback(() => {
    setIsLogged(false);
    localStorage.removeItem('vault_session');
    localStorage.removeItem('last_activity');
  }, []);

  // --- KIỂM TRA SESSION KHI MỞ TRANG ---
  useEffect(() => {
    const savedSession = localStorage.getItem('vault_session');
    const lastActivity = localStorage.getItem('last_activity');

    if (savedSession === ACCESS_KEY && lastActivity) {
      const now = Date.now();
      if (now - parseInt(lastActivity) < TIMEOUT_DURATION) {
        setIsLogged(true);
        localStorage.setItem('last_activity', now.toString());
      } else {
        handleLogout();
      }
    }
  }, [handleLogout]);

  // --- THEO DÕI HOẠT ĐỘNG NGƯỜI DÙNG (AUTO LOGOUT) ---
  useEffect(() => {
    if (!isLogged) return;

    const updateActivity = () => {
      localStorage.setItem('last_activity', Date.now().toString());
    };

    // Lắng nghe các sự kiện để reset thời gian 5 phút
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));

    // Kiểm tra mỗi 30 giây xem đã hết hạn chưa
    const interval = setInterval(() => {
      const last = localStorage.getItem('last_activity');
      if (last && Date.now() - parseInt(last) > TIMEOUT_DURATION) {
        handleLogout();
      }
    }, 30000);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [isLogged, handleLogout]);

  const fetchMedia = useCallback(async () => {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('is_deleted', tab === 'trash')
      .order('created_at', { ascending: false });
    if (data) setMedia(data as Media[]);
  }, [tab, type, tableName]);

  useEffect(() => {
    if (!isLogged) return;
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_videos' }, () => fetchMedia())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_images' }, () => fetchMedia())
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [isLogged, fetchMedia]);

  const generateThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => { video.currentTime = 1; };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { if (blob) resolve(blob); URL.revokeObjectURL(video.src); }, 'image/jpeg', 0.7);
      };
    });
  };

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const ts = Date.now();
      const cleanName = `${ts}_${file.name.replace(/\s+/g, '_')}`;

      try {
        await supabase.storage.from('videos').upload(cleanName, file, {
          onUploadProgress: (p: any) => {
            const currentFileProgress = (p.loaded / p.total) * 100;
            setUploadProgress(Math.round(((i / totalFiles) * 100) + (currentFileProgress / totalFiles)));
          }
        } as any);

        const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(cleanName);
        let thumbUrl = '';
        if (type === 'video') {
          const thumbBlob = await generateThumbnail(file);
          const thumbName = `thumb_${cleanName}.jpg`;
          await supabase.storage.from('videos').upload(thumbName, thumbBlob);
          thumbUrl = supabase.storage.from('videos').getPublicUrl(thumbName).data.publicUrl;
        }

        await supabase.from(tableName).insert([{
          name: file.name.split('.').slice(0, -1).join('.'),
          url: publicUrl,
          thumbnail_url: thumbUrl || publicUrl,
          is_deleted: false
        }]);
      } catch (err: any) { console.error(err.message); }
    }
    setUploading(false);
    setUploadProgress(0);
    fetchMedia();
  };

  const deletePermanently = async (item: Media) => {
    if (!confirm(`Xác nhận xóa vĩnh viễn?`)) return;
    try {
      const getFileName = (url: string) => url.split('/').pop()?.split('?')[0];
      const mainFile = getFileName(item.url);
      if (mainFile) await supabase.storage.from('videos').remove([mainFile]);
      await supabase.from(tableName).delete().eq('id', item.id);
      fetchMedia();
    } catch (err: any) { alert(err.message); }
  };

  useEffect(() => { if (isLogged) fetchMedia(); }, [isLogged, fetchMedia]);

  if (!isLogged) return (
    <div className="h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl">
        <Shield className="text-red-600 mx-auto mb-6" size={32} />
        <h2 className="text-white font-black text-2xl mb-8 italic uppercase tracking-tighter">Private Vault</h2>
        <input 
          type="password" placeholder="••••••••" 
          className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl mb-6 text-center text-white outline-none focus:border-red-600"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value === ACCESS_KEY) {
            setIsLogged(true);
            localStorage.setItem('vault_session', ACCESS_KEY);
            localStorage.setItem('last_activity', Date.now().toString());
          }}}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <div className="text-red-600 font-black italic text-xl flex items-center gap-2 uppercase tracking-tighter"><Film size={22}/> VAULT</div>
          <div className="flex bg-zinc-900 p-1 rounded-xl">
            <button onClick={() => setType('video')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${type === 'video' ? 'bg-zinc-800' : 'text-zinc-600'}`}>PHIM</button>
            <button onClick={() => setType('image')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${type === 'image' ? 'bg-zinc-800' : 'text-zinc-600'}`}>ẢNH</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 p-1 rounded-xl">
            <button onClick={() => setTab('main')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${tab === 'main' ? 'bg-zinc-700' : 'text-zinc-600'}`}>KHO</button>
            <button onClick={() => setTab('trash')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${tab === 'trash' ? 'bg-red-900 text-white' : 'text-zinc-600'}`}>RÁC</button>
          </div>
          <label className="relative cursor-pointer bg-red-600 hover:bg-red-700 px-6 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 uppercase overflow-hidden min-w-[120px] justify-center">
            {uploading ? <span>{uploadProgress}%</span> : <><UploadCloud size={16}/> Tải lên</>}
            <input type="file" className="hidden" multiple accept={type === 'video' ? "video/*" : "image/*"} onChange={handleMultipleUpload} disabled={uploading} />
          </label>
          <button onClick={handleLogout} className="p-2 text-zinc-600 hover:text-white transition-colors"><X size={20}/></button>
        </div>
      </nav>

      <main className="flex-1 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {media.map(m => (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden group hover:border-red-900/40 transition duration-500 shadow-xl">
              <div onClick={() => setViewing(m)} className="aspect-video bg-black flex items-center justify-center cursor-pointer relative overflow-hidden">
                <img src={m.thumbnail_url || m.url} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition duration-500" alt="" />
                {type === 'video' && <Play className="absolute text-white/40 group-hover:text-red-600 z-10" size={32} />}
              </div>
              <div className="p-4 bg-zinc-900/50 flex justify-between items-center">
                <span className="text-[9px] font-black text-zinc-500 truncate w-24 uppercase">{m.name}</span>
                <div className="flex gap-2">
                  {tab === 'main' ? (
                    <button onClick={() => supabase.from(tableName).update({ is_deleted: true }).eq('id', m.id)} className="text-zinc-700 hover:text-red-500"><Trash2 size={16}/></button>
                  ) : (
                    <>
                      <button onClick={() => supabase.from(tableName).update({ is_deleted: false }).eq('id', m.id)} className="text-green-600"><RotateCcw size={16}/></button>
                      <button onClick={() => deletePermanently(m)} className="text-red-600"><Trash2 size={16}/></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col p-4 md:p-10">
          <button onClick={() => setViewing(null)} className="self-end bg-red-600 text-white p-2 rounded-full mb-4"><X size={20}/></button>
          <div className="flex-1 w-full max-w-5xl mx-auto rounded-[2rem] overflow-hidden border border-zinc-900 bg-black flex items-center justify-center">
            {type === 'video' ? <video src={viewing.url} controls autoPlay className="max-h-full" /> : <img src={viewing.url} className="max-h-full object-contain" alt="" />}
          </div>
        </div>
      )}
    </div>
  );
}