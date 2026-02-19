import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cmxvxxkgggmibaybztcq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7CrnCBgIYawn7vIU8z6oqQ_yntv7K4W';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const ACCESS_KEY = '2400H';

export interface Media {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string;
  is_deleted: boolean;
  created_at?: string;
  collection_id?: string | null;
}

export interface Collection {
  id: string;
  name: string;
  created_at: string;
}