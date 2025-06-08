import { createClient } from '@supabase/supabase-js'
import {Database} from "../../models/supabaseDefinitions.ts";

export const db = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
