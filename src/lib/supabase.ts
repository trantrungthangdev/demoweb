import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cmxvxxkgggmiibaybztcq.supabase.co'; // Sửa đúng 4 chữ g
const SUPABASE_ANON_KEY = 'sb_publishable_7CrnCBglYawn7vIU8z6oqQ_yntv7K4W';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);