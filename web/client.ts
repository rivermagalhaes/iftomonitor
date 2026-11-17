import {createClient} from '@supabase/supabase-js';
export const makeWebClient=(url:string,key:string)=>createClient(url,key,{db:{schema:'ifto_monitor'}});
export type WebClient=ReturnType<typeof makeWebClient>;
