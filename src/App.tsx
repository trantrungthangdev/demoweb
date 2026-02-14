import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Play, Trash2, RotateCcw, UploadCloud, X, Shield, Film, Check, Image as ImageIcon } from 'lucide-react';

// Cấu hình thông số từ dự án của bạn
const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';
const ACCESS_KEY = '2400H';
const TIMEOUT_DURATION = 5 * 60 * 1000;

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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState("");
  
  const tableName = type === 'video' ? 'private_videos' : 'private_images';
  const channelRef = useRef<any>(null);

  const fetchMedia = useCallback(async () => {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('is_deleted', tab === 'trash')
      .order('created_at', { ascending: false });
    if (data) setMedia(data as Media[]);
  }, [tab, type, tableName]);

  // --- REALTIME SYNC ---
  useEffect(() => {
    if (!isLogged) return;

    const channel = supabase
      .channel('media_vault_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_videos' }, () => fetchMedia())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_images' }, () => fetchMedia())
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isLogged, fetchMedia]);

  // --- XOÁ VĨNH VIỄN ---
  const deletePermanently = async (item: Media) => {
    if (!confirm(`Xác nhận xóa vĩnh viễn: ${item.name}?`)) return;

    try {
      const getFileName = (url: string) => url.split('/').pop()?.split('?')[0];
      const mainFile = getFileName(item.url);
      const thumbFile = item.thumbnail_url ? getFileName(item.thumbnail_url) : null;

      const filesToRemove = [mainFile].filter(Boolean) as string[];
      if (thumbFile && thumbFile !== mainFile) filesToRemove.push(thumbFile);

      if (filesToRemove.length > 0) {
        await supabase.storage.from('videos').remove(filesToRemove);
      }

      const { error } = await supabase.from(tableName).delete().eq('id', item.id);
      if (error) throw error;

      fetchMedia();
    } catch (err: any) {
      alert("Lỗi khi xóa: " + err.message);
    }
  };

  // --- TẠO THUMBNAIL ---
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

  // --- UPLOAD (SỬA LỖI TYPE ERROR CHO VERCEL) ---
 const startUpload = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    setUploadProgress(1);
    const ts = Date.now();
    const ext = file.name.split('.').pop();
    const cleanName = `${ts}.${ext}`;

    try {
      // Sửa lỗi TS2353 bằng cách ép kiểu 'as any' cho object cấu hình
      await supabase.storage.from('videos').upload(cleanName, file, {
        cacheControl: '3600',
        upsert: false,
        // Sửa lỗi TS7006 bằng cách khai báo kiểu (p: any)
        onUploadProgress: (p: any) => {
          setUploadProgress(Math.round((p.loaded / p.total) * 100));
        }
      } as any); 

      const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(cleanName);

      let thumbUrl = '';
      if (type === 'video') {
        const thumbBlob = await generateThumbnail(file);
        const thumbName = `thumb_${ts}.jpg`;
        await supabase.storage.from('videos').upload(thumbName, thumbBlob);
        thumbUrl = supabase.storage.from('videos').getPublicUrl(thumbName).data.publicUrl;
      }

      await supabase.from(tableName).insert([{
        name: customName || file.name,
        url: publicUrl,
        thumbnail_url: thumbUrl || publicUrl,
        is_deleted: false
      }]);
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setTimeout(() => setUploadProgress(0), 1000); 
    }
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
          <div className="flex bg-zinc-900 p-1 rounded-xl shadow-inner">
            <button onClick={() => setType('video')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${type === 'video' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600'}`}>
              PHIM
            </button>
            <button onClick={() => setType('image')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${type === 'image' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600'}`}>
              <ImageIcon size={14}/> ẢNH
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 p-1 rounded-xl">
            <button onClick={() => setTab('main')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${tab === 'main' ? 'bg-zinc-700' : 'text-zinc-600'}`}>KHO</button>
            <button onClick={() => setTab('trash')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${tab === 'trash' ? 'bg-red-900 text-white' : 'text-zinc-600'}`}>RÁC</button>
          </div>
          <label className="relative cursor-pointer bg-red-600 hover:bg-red-700 px-6 py-2 rounded-xl text-[10px] font-black transition active:scale-95 flex items-center gap-2 uppercase overflow-hidden min-w-[120px] justify-center">
            {uploadProgress > 0 ? <span>{uploadProgress}%</span> : <><UploadCloud size={16}/> Tải lên</>}
            <input type="file" className="hidden" accept={type === 'video' ? "video/*" : "image/*"} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { setPendingFile(file); setCustomName(file.name.split('.').slice(0,-1).join('.')); }
            }} disabled={uploadProgress > 0} />
            {uploadProgress > 0 && <div className="absolute bottom-0 left-0 h-1 bg-white transition-all" style={{ width: `${uploadProgress}%` }} />}
          </label>
        </div>
      </nav>

      {pendingFile && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-6 italic text-red-600 uppercase tracking-widest">Tên hiển thị</h3>
            <input autoFocus type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 mb-6" />
            <div className="flex gap-3">
              <button onClick={() => setPendingFile(null)} className="flex-1 bg-zinc-800 py-4 rounded-2xl font-black text-[10px] uppercase">Hủy</button>
              <button onClick={startUpload} className="flex-1 bg-red-600 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2"><Check size={14}/> Bắt đầu tải</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {media.map(m => (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden group hover:border-red-900/40 transition duration-500 shadow-xl">
              <div onClick={() => setViewing(m)} className="aspect-video bg-black flex items-center justify-center cursor-pointer relative overflow-hidden">
                <img src={m.thumbnail_url || m.url} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition duration-500" alt="" />
                {type === 'video' && <Play className="absolute text-white/40 group-hover:text-red-600 z-10" size={32} />}
              </div>
              <div className="p-4 bg-zinc-900/50 flex justify-between items-center">
                <span className="text-[9px] font-black text-zinc-500 truncate w-24 uppercase tracking-tighter">{m.name}</span>
                <div className="flex gap-2">
                  {tab === 'main' ? (
                    <button onClick={() => supabase.from(tableName).update({ is_deleted: true }).eq('id', m.id)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  ) : (
                    <>
                      <button onClick={() => supabase.from(tableName).update({ is_deleted: false }).eq('id', m.id)} className="text-green-600 transition-colors"><RotateCcw size={16}/></button>
                      <button onClick={() => deletePermanently(m)} className="text-red-600 hover:scale-110 transition-transform"><Trash2 size={16}/></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col p-4 md:p-10 animate-in fade-in">
          <button onClick={() => setViewing(null)} className="self-end bg-red-600 text-white p-2 rounded-full mb-4 shadow-xl hover:rotate-90 transition-all"><X size={20}/></button>
          <div className="flex-1 w-full max-w-5xl mx-auto rounded-[2rem] overflow-hidden border border-zinc-900 bg-black flex items-center justify-center shadow-2xl">
            {type === 'video' ? <video src={viewing.url} controls autoPlay playsInline className="max-h-full" /> : <img src={viewing.url} className="max-h-full object-contain" alt="" />}
          </div>
        </div>
      )}
    </div>
  );
}